# ocgo-usage-tui

A small [opencode](https://opencode.ai) TUI plugin that shows your [OpenCode Go](https://opencode.ai/go) usage limits in the sidebar — rolling (5-hour), weekly and monthly — with progress bars, percentages and time until each window resets.

It reads your existing OpenCode Go API key, so there's nothing extra to configure.

```
OpenCode Go
Rolling  █░░░░░░░░░░░░░░░    3%  2h19m
Weekly   █░░░░░░░░░░░░░░░    3%  6d4h
Monthly  ███████████░░░░░   69%  5d23h
```

## How it works

It calls the official usage endpoint with the API key already stored in your opencode auth file:

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <your opencode-go key>
```

Data refreshes every 60 seconds. The countdowns tick every second.

Colours are based on how much of the limit you've used:

| Usage   | Colour |
| ------- | ------ |
| 0–49%   | green  |
| 50–89%  | amber  |
| 90%+    | red    |

## Requirements

- opencode 1.18 or newer (TUI plugin support)
- An [OpenCode Go](https://opencode.ai/go) subscription
- The key must already be connected in opencode (run `/connect` and pick **OpenCode Go**)

## Install

**1. Clone it somewhere opencode can read:**

```bash
git clone https://github.com/ashcdev-hub/ocgo-usage-tui.git ~/.config/opencode/tui-plugins/ocgo-usage-tui
```

**2. Register it as a TUI plugin.** Create `~/.config/opencode/tui.json` (or add to it if it exists):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/Users/you/.config/opencode/tui-plugins/ocgo-usage-tui"]
}
```

Use your real absolute path. Tilde (`~`) is not expanded here.

**3. Restart opencode.** The panel appears at the bottom of the sidebar.

## Configuration

Edit the constants at the top of `usage.tsx`:

| Constant     | Default | Meaning                        |
| ------------ | ------- | ------------------------------ |
| `USAGE_URL`  | the Go usage endpoint | Where usage is fetched from |
| `REFRESH_MS` | `60000` | How often to re-fetch (ms)     |
| `BAR_WIDTH`  | `16`    | Progress bar width in cells    |

Bar colours fall back to fixed hex values if your theme doesn't define the `success`/`warning`/`error` roles.

## Troubleshooting

If the panel doesn't show up, check the log for the plugin's breadcrumb:

```bash
grep -i "ocgo-usage-tui" ~/.local/share/opencode/log/opencode.log
```

The panel shows a short status instead of bars when something's wrong:

| Shown      | Meaning                                    |
| ---------- | ------------------------------------------ |
| `no key`   | No `opencode-go` key in your auth file     |
| `offline`  | The request failed (network/DNS)           |
| `HTTP 401` | The key was rejected                       |

## Notes

- Read-only. It never writes anything and only sends your own key to opencode's own endpoint.
- This is separate from [ocgo-usage-menubar](https://github.com/ashcdev-hub/ocgo-usage-menubar), which shows the same data in the macOS menu bar.

## License

MIT

## Author

Ash Eskrett
