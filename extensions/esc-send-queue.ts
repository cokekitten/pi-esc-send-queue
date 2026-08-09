/**
 * Esc + queued messages → abort current run and immediately send the queue.
 *
 * Default pi Esc behavior while streaming:
 *   1. restore queued messages into the editor
 *   2. abort the agent
 *
 * This extension keeps that restore+abort path, then after the agent goes idle
 * it submits the restored editor text as a new user message — so Esc means
 * "stop what you're doing and act on my queued instructions now".
 *
 * No queued messages → normal Esc (abort / double-Esc tree).
 *
 * Note: uses setEditorComponent(). Another extension that also replaces the
 * editor will conflict (last loaded wins).
 */

import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

const IDLE_POLL_MS = 25;
const IDLE_TIMEOUT_MS = 30_000;

export default function (pi: ExtensionAPI) {
	let latestCtx: ExtensionContext | undefined;
	let flushing = false;
	// Set while a flush-abort is in flight: the upcoming aborted assistant
	// message is replaced with a plain stop so the TUI shows no notice.
	let suppressAbortNotice = false;

	const rememberCtx = (_event: unknown, ctx: ExtensionContext) => {
		latestCtx = ctx;
	};

	// Keep a fresh ctx so Esc can call isIdle/hasPendingMessages/getEditorText
	pi.on("session_start", rememberCtx);
	pi.on("agent_start", rememberCtx);
	pi.on("agent_end", rememberCtx);
	pi.on("agent_settled", rememberCtx);
	pi.on("turn_start", rememberCtx);
	pi.on("turn_end", rememberCtx);

	const shouldFlushOnEsc = (): boolean => {
		const ctx = latestCtx;
		if (!ctx || flushing) return false;
		if (ctx.isIdle()) return false;
		return ctx.hasPendingMessages();
	};

	const flushAfterAbort = async (): Promise<void> => {
		if (flushing) return;
		flushing = true;
		const ctx = latestCtx;
		try {
			if (!ctx) return;

			const started = Date.now();
			while (!ctx.isIdle() && Date.now() - started < IDLE_TIMEOUT_MS) {
				await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
			}

			if (!ctx.isIdle()) {
				ctx.ui.notify("Abort still running; queued text left in editor", "warning");
				return;
			}

			const text = ctx.ui.getEditorText().trim();
			if (!text) return;

			ctx.ui.setEditorText("");
			// Agent is idle → sendUserMessage starts a new turn immediately
			pi.sendUserMessage(text);
		} catch (err) {
			latestCtx?.ui.notify(
				`Esc-send-queue failed: ${err instanceof Error ? err.message : String(err)}`,
				"error",
			);
		} finally {
			flushing = false;
		}
	};

	class EscSendQueueEditor extends CustomEditor {
		handleInput(data: string): void {
			const isInterrupt = this.keybindings.matches(data, "app.interrupt");
			const autocompleteOpen =
				typeof (this as { isShowingAutocomplete?: () => boolean }).isShowingAutocomplete ===
				"function"
					? (this as { isShowingAutocomplete: () => boolean }).isShowingAutocomplete()
					: false;

			// Snapshot before default Esc clears the queue into the editor
			const capture = isInterrupt && !autocompleteOpen && shouldFlushOnEsc();

			super.handleInput(data);

			if (capture) {
				// The default Esc path aborts the agent, which would surface an
				// "Operation aborted" notice. Suppress it for this flush abort.
				suppressAbortNotice = true;
				void flushAfterAbort();
			}
		}
	}

	// For flush aborts: rewrite the aborted assistant message to a plain stop
	// (no tool calls involved) so the TUI renders no "Operation aborted" line.
	// Real aborts (no queued messages) keep pi's default notice.
	pi.on("message_end", (event) => {
		if (!suppressAbortNotice) return;
		const msg = event.message;
		if (msg.role !== "assistant" || msg.stopReason !== "aborted") return;

		suppressAbortNotice = false;

		// Don't mask aborts that happened mid tool call — rewriting those as
		// successful would be misleading. Those keep pi's default rendering.
		if (msg.content.some((c) => c.type === "toolCall")) return;

		return {
			message: {
				...msg,
				stopReason: "stop",
				errorMessage: undefined,
			},
		};
	});

	// Safety net: never leak the flag into a later, real message_end.
	pi.on("agent_end", () => {
		suppressAbortNotice = false;
	});

	pi.on("session_start", (_event, ctx) => {
		latestCtx = ctx;
		if (ctx.mode !== "tui") return;

		ctx.ui.setEditorComponent(
			(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) =>
				new EscSendQueueEditor(tui, theme, keybindings),
		);
	});
}
