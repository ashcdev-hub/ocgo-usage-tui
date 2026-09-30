# oc-model-speed

An [opencode](https://opencode.ai) TUI plugin that shows how fast the model is responding in the sidebar: time to first token (TTFT) and tokens per second for the latest turn.

```
Model Speed
TTFT 1.2s
TPS  25.3 t/s
```

## Requirements

- opencode 1.18 or newer

## Install

```bash
opencode plugin oc-model-speed --global
```

This installs the package and adds it to your `tui.json`. Restart opencode.

## How it works

Timing is derived entirely from persisted message and part data, so it works for turns that already happened as well as the one currently streaming, and it survives a restart:

- `TTFT` = the first output part's start time minus the message's creation time
- `TPS` = output tokens divided by the turn's streaming window (first token to completion)

The panel shows `prompt processing...` while the model has not produced output yet.

## Configure

The colours sit at the top of `speed.tsx` in the `HEX` table; the panel otherwise follows the active theme.

## License

MIT
