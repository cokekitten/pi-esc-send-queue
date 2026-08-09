# pi-esc-send-queue

A [pi](https://github.com/earendil-works/pi-coding-agent) editor extension that
changes Esc behavior when there are queued messages.

## Behavior

Default pi Esc behavior while streaming:

1. restore queued messages into the editor
2. abort the agent

This extension keeps that restore+abort path, then after the agent goes idle it
submits the restored editor text as a new user message — so **Esc means "stop
what you're doing and act on my queued instructions now"**.

- No queued messages → normal Esc (abort / double-Esc tree).
- Flush aborts are rendered as a plain stop (no "Operation aborted" notice);
  real aborts keep pi's default rendering.

## Install

Add to `~/.pi/agent/settings.json` `packages`:

```json
"../../dev/pi-expansion/pi-esc-send-queue"
```

Activate with `/reload` (or restart pi).

## Notes

Uses `setEditorComponent()`. Another extension that also replaces the editor
will conflict (last loaded wins).
