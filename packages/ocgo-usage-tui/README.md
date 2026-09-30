# ocgo-usage-tui

An [opencode](https://opencode.ai) TUI plugin that shows your [OpenCode Go](https://opencode.ai/go) usage limits in the sidebar: rolling (5 hour), weekly and monthly, with progress bars and the time left until each window resets.

It uses the OpenCode Go API key you already have connected in opencode, so there is nothing else to set up.

```
OCGO Usage
Rolling  █░░░░░░░░░░░░░░░    3%  2h19m
Weekly   █░░░░░░░░░░░░░░░    3%  6d4h
Monthly  ███████████░░░░░   69%  5d23h
```

## Requirements

- opencode 1.18 or newer
- An [OpenCode Go](https://opencode.ai/go) subscription, connected in opencode with `/connect`

## Install

```bash
opencode plugin ocgo-usage-tui --global
```

This installs the package and adds it to your `tui.json`. Restart opencode; the panel shows at the bottom of the sidebar.

## Configure

The settings sit at the top of `usage.tsx`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `USAGE_URL` | `https://opencode.ai/zen/go/v1/usage` | Where usage is fetched from |
| `REFRESH_MS` | `60000` | How often to fetch, in milliseconds |
| `BAR_WIDTH` | `16` | Progress bar width in cells |

Bar colours track how much of the limit you have used:

| Usage | Colour |
| --- | --- |
| 0 to 49% | green |
| 50 to 89% | amber |
| 90% and above | red |

## License

MIT
