import { boxCenter } from "./geometry"
import type { NormBox } from "./types"

export type CheckpointSlot = "early" | "middle" | "late"

export interface IdentificationCheckpoint {
  slot: CheckpointSlot
  t: number
  bbox: NormBox
  videoWidth: number
  videoHeight: number
  thumbnail?: string
}

export interface TrackingCorrection {
  t: number
  slot: CheckpointSlot
  predictedCx: number
  predictedCy: number
  confirmedCx: number
  confirmedCy: number
  drift: number
}

export const CHECKPOINT_SLOTS: CheckpointSlot[] = ["early", "middle", "late"]

export function emptyCheckpoints(): Record<CheckpointSlot, IdentificationCheckpoint | null> {
  return { early: null, middle: null, late: null }
}

export function sortedCheckpoints(map: Record<CheckpointSlot, IdentificationCheckpoint | null>): IdentificationCheckpoint[] {
  return CHECKPOINT_SLOTS.map(s => map[s]).filter((c): c is IdentificationCheckpoint => !!c)
    .sort((a, b) => a.t - b.t)
}

export function firstCheckpoint(map: Record<CheckpointSlot, IdentificationCheckpoint | null>): IdentificationCheckpoint | null {
  const list = sortedCheckpoints(map)
  return list[0] ?? null
}

export function correctionDrift(predicted: NormBox | null, confirmed: NormBox): TrackingCorrection["drift"] {
  if (!predicted) return 1
  const a = boxCenter(predicted)
  const b = boxCenter(confirmed)
  return Math.hypot(a.cx - b.cx, a.cy - b.cy)
}

export function coverageLabel(count: number): string {
  if (count >= 3) return "three checkpoints"
  if (count === 2) return "two checkpoints — lower identity-verification coverage"
  if (count === 1) return "one checkpoint — lower identity-verification coverage"
  return "no checkpoints"
}
