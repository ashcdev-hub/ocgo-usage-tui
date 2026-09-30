/** @jsxImportSource @opentui/solid */
import { createMemo } from "solid-js"
import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Whole-cell blocks only. Partial blocks leave the rest of the cell unpainted,
// which shows the terminal background as a black notch.
const BAR_WIDTH = 24

const HEX = {
  good: "#7bd88f",
  warn: "#ffca85",
  bad: "#ff6b6b",
  track: "#4c5566",
  dim: "#8b93a1",
  text: "#ffffff",
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)))
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

// Every assistant message records the prompt size it sent, so the newest one is
// the current context. `total` is what the status bar shows; fall back to summing
// the parts when it is absent. A message that is still streaming has all-zero
// tokens and must be skipped so the meter shows the last completed turn.
function contextTokens(message: any): number {
  const t = message?.tokens
  const total = num(t?.total)
  if (total > 0) return total
  return (
    num(t?.input) +
    num(t?.output) +
    num(t?.reasoning) +
    num(t?.cache?.read) +
    num(t?.cache?.write)
  )
}

function bar(percent: number): { filled: string; track: string } {
  const p = Math.max(0, Math.min(100, percent))
  let filled = Math.round((p / 100) * BAR_WIDTH)
  if (p > 0 && filled === 0) filled = 1
  filled = Math.max(0, Math.min(BAR_WIDTH, filled))
  return { filled: "\u2588".repeat(filled), track: "\u2591".repeat(BAR_WIDTH - filled) }
}

// opencode's provider/model catalogue as it ships on disk. Used only when the
// live provider list does not carry a context limit.
type Catalogue = Record<string, { models?: Record<string, { limit?: { context?: number } }> }>
let catalog: Catalogue | undefined
let catalogTried = false

function modelsPath(): string {
  const base = process.env.XDG_CACHE_HOME
    ? join(process.env.XDG_CACHE_HOME, "opencode")
    : join(homedir(), ".cache", "opencode")
  return join(base, "models.json")
}

function readCatalog(): Catalogue | undefined {
  if (catalogTried) return catalog
  catalogTried = true
  try {
    catalog = JSON.parse(readFileSync(modelsPath(), "utf8")) as Catalogue
  } catch {
    catalog = undefined
  }
  return catalog
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(ctx, props) {
        const theme = ctx.theme

        const messages = createMemo(
          () => api.state.session.messages(props.session_id) as any[],
        )

        const usage = createMemo(() => {
          const list = messages()
          // Newest assistant message that actually reported usage.
          const latest = list.findLast(
            (m) => (m?.role ?? m?.info?.role) === "assistant" && contextTokens(m) > 0,
          )
          if (!latest) return { tokens: 0, limit: 0, percent: 0 }

          const providerID = latest?.providerID ?? latest?.info?.providerID
          const modelID = latest?.modelID ?? latest?.info?.modelID
          const tokens = contextTokens(latest)

          const live = api.state.provider.find((p) => p.id === providerID)
            ?.models?.[modelID]?.limit?.context
          const fromCatalogue = readCatalog()?.[providerID]?.models?.[modelID]?.limit?.context
          const limit = num(live) || num(fromCatalogue)

          return { tokens, limit, percent: limit > 0 ? (tokens / limit) * 100 : 0 }
        })

        // The session row's own total is authoritative — it accumulates every
        // turn ever persisted. Summing the in-memory message list underreports
        // (it misses turns not currently loaded), so it is only a fallback.
        const cost = createMemo(() => {
          const session = api.state.session.get(props.session_id) as any
          const total = num(session?.cost)
          if (total > 0) return total
          return messages()
            .filter((m) => (m?.role ?? m?.info?.role) === "assistant")
            .reduce((sum, m) => sum + num(m?.cost ?? m?.info?.cost), 0)
        })

        const colour = () => {
          const pct = usage().percent
          const c = theme?.current
          if (pct >= 90) return c?.error ?? HEX.bad
          if (pct >= 70) return c?.warning ?? HEX.warn
          return c?.success ?? HEX.good
        }

        const text = () => theme?.current?.text ?? HEX.text
        const dim = () => theme?.current?.textMuted ?? HEX.dim

        const detail = () => {
          const u = usage()
          const limitText = u.limit > 0 ? formatInt(u.limit) : "--"
          return `${formatInt(u.tokens)} of ${limitText} / ${formatMoney(cost())}`
        }

        return (
          <box flexDirection="column">
            <text fg={text()}>
              <b>Session Context</b>
            </text>
            {(() => {
              const u = usage()
              if (u.tokens === 0) {
                return <text fg={dim()}>{"no usage yet"}</text>
              }
              const { filled, track } = bar(u.percent)
              return (
                <text fg={colour()}>
                  <span fg={colour()}>{filled}</span>
                  <span fg={dim()}>{track}</span>
                  <span fg={text()}>{` ${Math.round(u.percent)}%`}</span>
                </text>
              )
            })()}
            <text fg={dim()}>{detail()}</text>
          </box>
        )
      },
    },
  })
}

export default { id: "session-context", tui }
