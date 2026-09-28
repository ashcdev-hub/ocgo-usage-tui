/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"
const REFRESH_MS = 60_000
const BAR_WIDTH = 16

// Explicit fallbacks so the panel still colours correctly even if the
// active theme does not expose these roles.
const HEX = {
  good: "#7bd88f",
  warn: "#ffca85",
  bad: "#ff6b6b",
  track: "#4c5566",
  dim: "#8b93a1",
  text: "#ffffff",
}

// Whole-cell blocks only. Partial blocks (u258f..u2589) leave the rest of the
// cell unpainted, which shows the terminal background as a black notch.
type Window = { status?: string; percent?: number; resetsAt?: string }
type Usage = { rolling?: Window; weekly?: Window; monthly?: Window }

function authPath(): string {
  const base = process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "opencode")
    : join(homedir(), ".local", "share", "opencode")
  return join(base, "auth.json")
}

function readGoKey(): string | undefined {
  try {
    const auth = JSON.parse(readFileSync(authPath(), "utf8")) as Record<string, { key?: string }>
    const key = auth["opencode-go"]?.key
    return typeof key === "string" && key.length > 0 ? key : undefined
  } catch {
    return undefined
  }
}

function barParts(percent: number): { filled: string; track: string } {
  const p = Math.max(0, Math.min(100, percent))
  let filled = Math.round((p / 100) * BAR_WIDTH)
  if (p > 0 && filled === 0) filled = 1
  filled = Math.max(0, Math.min(BAR_WIDTH, filled))
  return { filled: "\u2588".repeat(filled), track: "\u2591".repeat(BAR_WIDTH - filled) }
}

function shortReset(iso: string | undefined, now: number): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  let s = Math.max(0, Math.floor((t - now) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

const tui: TuiPlugin = async (api) => {
  const [usage, setUsage] = createSignal<Usage | undefined>(undefined)
  const [error, setError] = createSignal<string | undefined>(undefined)
  const [tick, setTick] = createSignal(0)

  const log = (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => {
    try {
      void (api.client as any)?.app?.log?.({ body: { service: "ocgo-usage-tui", level, message, extra } })
    } catch {
      // never let logging break the sidebar
    }
  }

  const key = readGoKey()
  log("info", "ocgo-usage-tui loaded", { key: key ? "found" : "missing" })

  async function refresh() {
    if (!key) {
      setError("no key")
      return
    }
    try {
      const res = await fetch(USAGE_URL, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        log("warn", "usage fetch failed", { status: res.status })
        return
      }
      const body = (await res.json()) as { usage?: Usage } & Usage
      setUsage(body?.usage ?? body)
      setError(undefined)
    } catch {
      setError("offline")
      log("warn", "usage fetch error")
    }
  }

  void refresh()
  const refreshTimer = setInterval(() => void refresh(), REFRESH_MS)
  const tickTimer = setInterval(() => setTick((t) => t + 1), 1000)

  api.lifecycle.onDispose(() => {
    clearInterval(refreshTimer)
    clearInterval(tickTimer)
  })

  api.slots.register({
    order: 500,
    slots: {
      sidebar_content(ctx) {
        const theme = ctx.theme
        const dim = () => theme?.current?.textMuted ?? HEX.dim
        const text = () => theme?.current?.text ?? HEX.text
        const accent = (percent: number) => {
          const c = theme?.current
          if (percent >= 90) return c?.error ?? HEX.bad
          if (percent >= 50) return c?.warning ?? HEX.warn
          return c?.success ?? HEX.good
        }

        const row = (label: string, w: Window | undefined) => {
          const pct = Math.round(w?.percent ?? 0)
          const reset = shortReset(w?.resetsAt, Date.now())
          const colour = accent(pct)
          const { filled, track } = barParts(pct)
          return (
            <text fg={colour}>
              <span fg={text()}>{label.padEnd(8)}</span>
              <span fg={colour}>{filled}</span>
              <span fg={dim()}>{track}</span>
              <span fg={colour}>{` ${String(pct).padStart(3)}%`}</span>
              <span fg={colour}>{reset ? `  ${reset}` : ""}</span>
            </text>
          )
        }

        return (
          <box flexDirection="column">
            <text fg={text()}>
              <b>OCGO Usage</b>
            </text>
            {(() => {
              tick()
              const u = usage()
              if (!u) {
                return <text fg={dim()}>{`usage ${error() ?? "loading..."}`}</text>
              }
              return (
                <>
                  {row("Rolling", u.rolling)}
                  {row("Weekly", u.weekly)}
                  {row("Monthly", u.monthly)}
                </>
              )
            })()}
          </box>
        )
      },
    },
  })
}

export default { id: "ocgo-usage-tui", tui }
