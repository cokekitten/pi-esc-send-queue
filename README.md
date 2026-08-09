# pi-esc-send-queue

Esc + queued messages -> abort the current run and immediately send the queue, for [pi](https://github.com/earendil-works/pi-coding-agent).

**Repo:** https://github.com/cokekitten/pi-esc-send-queue

## Behavior

Default pi Esc behavior while streaming:

1. restore queued messages into the editor
2. abort the agent

This extension keeps that restore+abort path, then after the agent goes idle it submits the restored editor text as a new user message - so **Esc means "stop what you're doing and act on my queued instructions now"**.

- No queued messages -> normal Esc (abort / double-Esc tree).
- Flush aborts are rendered as a plain stop (no "Operation aborted" notice); real aborts keep pi's default rendering.

## Install

From GitHub:

```bash
pi install git:github.com/cokekitten/pi-esc-send-queue
```

Or try it for one run without installing:

```bash
pi -e git:github.com/cokekitten/pi-esc-send-queue
```

Local checkout:

```bash
# e.g. in ~/.pi/agent/settings.json packages:
#   "../../dev/pi-expansion/pi-esc-send-queue"
pi install /path/to/pi-esc-send-queue
# or
pi -e /path/to/pi-esc-send-queue
```

After installing, restart pi or run `/reload`.

## Notes

Uses `setEditorComponent()`. Another extension that also replaces the editor will conflict (last loaded wins).

## Development

Package entry: `package.json` -> `pi.extensions` -> `./extensions/esc-send-queue.ts`.

## License

MIT
