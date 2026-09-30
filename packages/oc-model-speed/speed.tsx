/** @jsxImportSource @opentui/solid */
import { createMemo } from "solid-js"
import type { TuiPlugin } from "@opencode-ai/plugin/tui"

const HEX = {
  good: "#7bd88f",
  warn: "#ffca85",
  bad: "#ff6b6b",
  dim: "#8b93a1",
  text: "#ffffff",
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function seconds(ms: number): string {
  if (!ms || ms <= 0) return "--"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  return `${Math.round(s)}s`
}

function rate(tps: number): string {
  if (!tps || tps <= 0) return "--"
  return `${tps.toFixed(1)} t/s`
}

type Sample = {
  ttfp: number
  tps: number
  output: number
  model: string
}

// Timing is derived entirely from persisted part/message data:
//
//   ttfp = first output part's time.start  -  message.time.created
//   tps  = tokens.output / (streaming window in seconds)
//
// This means it works for turns that already happened as well as the one
// currently streaming, and it survives a restart.
function sampleFor(api: any, message: any): Sample | undefined {
  if (!message) return undefined
  if ((message?.role ?? message?.info?.role) !== "assistant") return undefined

  const created = num(message?.time?.created ?? message?.info?.time?.created)
  if (!created) return undefined

  const output = num(message?.tokens?.output ?? message?.info?.tokens?.output)
  const completed = num(message?.time?.completed ?? message?.info?.time?.completed)

  // The part lookup needs the message id. It lives on the object in the live
  // API, but a message hydrated from storage may not carry it, so fall back to
  // the part timings we can derive another way rather than blanking out.
  const id = message?.id ?? message?.info?.id
  let parts: any[] = []
  if (id) {
    try {
      parts = (api.state.part(id) as any[]) ?? []
    } catch {
      parts = []
    }
  }

  let firstStart = 0
  for (const part of parts) {
    const type = part?.type
    if (type !== "text" && type !== "reasoning") continue
    const start = num(part?.time?.start)
    if (start && (!firstStart || start < firstStart)) firstStart = start
  }

  // No timed parts available: fall back to the message window.
  if (!firstStart) {
    if (!completed || completed <= created || output <= 0) return undefined
    const fallbackMs = completed - created
    return {
      ttfp: 0,
      tps: output / (fallbackMs / 1000),
      output,
      model: message?.modelID ?? message?.info?.modelID ?? "",
    }
  }

  const ttfp = firstStart - created

  // Rate over the whole turn, first output to completion. Deliberately NOT
  // first-part-to-last-part: text part timings start after any reasoning or
  // tool gap, so that window only captures the final sprint and reports a
  // nonsense rate (e.g. 130 t/s where the real figure is ~25 t/s).
  const turnMs = completed > firstStart ? completed - firstStart : 0
  const tps = output > 0 && turnMs > 0 ? output / (turnMs / 1000) : 0

  const model = message?.modelID ?? message?.info?.modelID ?? ""

  return { ttfp, tps, output, model }
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 500,
    slots: {
      sidebar_content(ctx, props) {
        const theme = ctx.theme
        const text = () => theme?.current?.text ?? HEX.text
        const dim = () => theme?.current?.textMuted ?? HEX.dim
        const colour = () => theme?.current?.success ?? HEX.good

        // Read straight from live state inside the memo, exactly as the
        // built-in sidebar panel does. Solid tracks the state reads, so the
        // panel re-renders as messages and parts update. No event plumbing.
        const current = createMemo<Sample | undefined>(() => {
          const sessionID = props.session_id
          if (!sessionID) return undefined
          const list = api.state.session.messages(sessionID) as any[]
          const latest = list.findLast((m) => {
            const role = m?.role ?? m?.info?.role
            return role === "assistant" && num(m?.tokens?.output ?? m?.info?.tokens?.output) > 0
          })
          return sampleFor(api, latest)
        })

        // Status while the model is working, i.e. still prompt processing.
        const status = createMemo(() => {
          const sessionID = props.session_id
          if (!sessionID) return undefined
          return api.state.session.status(sessionID)?.type
        })

        return (
          <box flexDirection="column">
            <text fg={text()}>
              <b>Model Speed</b>
            </text>
            {(() => {
              const s = current()
              const busy = status() === "busy"
              if (!s) {
                return (
                  <text fg={dim()}>
                    {busy ? "prompt processing..." : "no output yet"}
                  </text>
                )
              }
              return (
                <>
                  <text fg={colour()}>
                    <span fg={dim()}>TTFP </span>
                    <span fg={colour()}>{s.ttfp > 0 ? seconds(s.ttfp) : "--"}</span>
                  </text>
                  <text fg={colour()}>
                    <span fg={dim()}>TPS  </span>
                    <span fg={colour()}>{rate(s.tps)}</span>
                  </text>
                </>
              )
            })()}
          </box>
        )
      },
    },
  })
}

export default { id: "model-speed", tui }
