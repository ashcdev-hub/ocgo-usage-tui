# oc-session-context

An [opencode](https://opencode.ai) TUI plugin that shows how much of the model's context window the current session is using, in the sidebar, along with the session cost.

It reads the prompt size from the most recent completed assistant turn and looks the model's context limit up from the live provider list, falling back to opencode's cached model catalogue.

```
Session Context
█████░░░░░░░░░░░░░░░░░░░ 42%
86,120 of 200,000 / $0.42
```

## Requirements

- opencode 1.18 or newer

## Install

```bash
opencode plugin oc-session-context --global
```

This installs the package and adds it to your `tui.json`. Restart opencode.

## Configure

The settings sit at the top of `context.tsx`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `BAR_WIDTH` | `24` | Progress bar width in cells |

Bar colours track how full the context window is:

| Used | Colour |
| --- | --- |
| 0 to 69% | green |
| 70 to 89% | amber |
| 90% and above | red |

## License

MIT
