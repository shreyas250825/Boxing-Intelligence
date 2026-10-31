import type { ActionEvent } from "../../api/analysis"

export const PUNCH_TYPES = ["jab", "cross", "lead_hook", "rear_hook", "uppercut"] as const
export const DEFENSE_TYPES = ["block", "slip", "duck", "defensive", "head_move", "guard"] as const

export type TargetArea = "head" | "body" | "unclear"
export type TargetSide = "left" | "right" | "center" | "unclear"
export type PunchOutcome = "landed" | "blocked" | "missed" | "unclear"
export type PunchHand = "left" | "right" | "unclear"

export function isConfirmedPunch(e: ActionEvent): boolean {
  return PUNCH_TYPES.includes(e.action_type as (typeof PUNCH_TYPES)[number]) && e.confirmed !== false
}

export function isDefense(e: ActionEvent): boolean {
  return DEFENSE_TYPES.includes(e.action_type as (typeof DEFENSE_TYPES)[number])
}

export function targetZone(e: ActionEvent): string {
  const area = e.target_area || "unclear"
  const side = e.target_side || "unclear"
  if (area === "unclear") return "unclear"
  if (side === "left" || side === "right") return `${side}_${area}`
  return area
}

export function punchBreakdown(events: ActionEvent[], boxerLabel?: string) {
  const scoped = events.filter(e => !boxerLabel || !e.boxer_label || e.boxer_label === boxerLabel)
  const punches = scoped.filter(isConfirmedPunch)
  const defense = scoped.filter(isDefense)
  const byType: Record<string, number> = {}
  for (const id of PUNCH_TYPES) byType[id] = punches.filter(e => e.action_type === id).length
  const byZone: Record<string, number> = {}
  for (const e of punches) {
    const z = targetZone(e)
    byZone[z] = (byZone[z] || 0) + 1
  }
  const byOutcome: Record<string, number> = {}
  for (const e of punches) {
    const o = e.outcome || "unclear"
    byOutcome[o] = (byOutcome[o] || 0) + 1
  }
  const left = punches.filter(e => e.hand === "left").length
  const right = punches.filter(e => e.hand === "right").length
  return {
    punches: punches.length,
    defense: defense.length,
    byType,
    byZone,
    byOutcome,
    left,
    right,
    empty: punches.length === 0,
    candidatesUnverified: 0,
  }
}

export function coachingSuggestions(args: {
  punches: number
  jabs: number
  missed: number
  defense: number
  coveragePercent: number
  roundMovements: number[]
}): { text: string; evidence: string }[] {
  const out: { text: string; evidence: string }[] = []
  if (args.coveragePercent < 40) {
    out.push({
      text: "Tracking coverage is too low to treat movement findings as reliable. Review identification checkpoints and re-identify lost intervals before using movement totals in coaching.",
      evidence: `Tracking coverage ${args.coveragePercent.toFixed(1)}%.`,
    })
  }
  if (args.punches > 0 && args.jabs / args.punches < 0.25) {
    out.push({
      text: "Confirmed jabs are a small share of tagged punches. The coach may want to review jab practice and setup.",
      evidence: `Jabs ${args.jabs} of ${args.punches} confirmed punches.`,
    })
  }
  if (args.punches > 0 && args.missed / args.punches >= 0.35) {
    out.push({
      text: "A high share of tagged punches were marked missed. Review distance management and accuracy on those timestamps.",
      evidence: `Missed ${args.missed} of ${args.punches} confirmed punches.`,
    })
  }
  if (args.punches >= 4 && args.defense === 0) {
    out.push({
      text: "Offensive tags exist but no defensive actions were recorded. If that matches the session, review defensive drills; otherwise tag blocks, slips and ducks before drawing conclusions.",
      evidence: `Confirmed punches ${args.punches}, defensive tags ${args.defense}.`,
    })
  }
  if (args.roundMovements.length >= 2) {
    const max = Math.max(...args.roundMovements)
    const min = Math.min(...args.roundMovements)
    if (max > 0 && min < max * 0.45) {
      const hi = args.roundMovements.indexOf(max) + 1
      const lo = args.roundMovements.indexOf(min) + 1
      out.push({
        text: "Normalized movement varies considerably across intervals. Review the quieter interval for pacing, fatigue or tracking loss.",
        evidence: `Highest interval ${hi} (${max.toFixed(4)}) vs lowest ${lo} (${min.toFixed(4)}).`,
      })
    }
  }
  return out
}
