import type { LossInterval, TrackingSample, TrackStatus } from "./types"
import { frameDisplacement } from "./geometry"

export interface MovementState {
  samples: TrackingSample[]
  totalMovement: number
  validSampleCount: number
  lastValid: TrackingSample | null
  lossIntervals: LossInterval[]
  openLoss: LossInterval | null
}

export function createMovementState(): MovementState {
  return {
    samples: [],
    totalMovement: 0,
    validSampleCount: 0,
    lastValid: null,
    lossIntervals: [],
    openLoss: null,
  }
}

export function shouldCountDisplacement(args: {
  prev: TrackingSample | null
  status: TrackStatus
  skipDisplacement: boolean
  timestamp: number
}): boolean {
  if (args.skipDisplacement) return false
  if (args.status !== "TRACKING") return false
  if (!args.prev) return false
  if (args.prev.status !== "TRACKING") return false
  if (!(args.timestamp > args.prev.t)) return false
  return true
}

export function appendSample(
  state: MovementState,
  sample: TrackingSample,
  videoWidth: number,
  videoHeight: number,
  skipDisplacement: boolean,
): MovementState {
  let displacement = 0
  const count = shouldCountDisplacement({
    prev: state.lastValid,
    status: sample.status,
    skipDisplacement,
    timestamp: sample.t,
  })
  if (count && state.lastValid) {
    displacement = frameDisplacement(
      { cx: state.lastValid.cx, cy: state.lastValid.cy },
      { cx: sample.cx, cy: sample.cy },
      videoWidth,
      videoHeight,
    )
    if (!Number.isFinite(displacement) || displacement < 0) displacement = 0
  }
  const recorded: TrackingSample = { ...sample, displacement }

  const samples = state.samples.length >= 8000
    ? [...state.samples.slice(-7999), recorded]
    : [...state.samples, recorded]

  let openLoss = state.openLoss
  let lossIntervals = state.lossIntervals
  if (recorded.status === "LOST" || recorded.status === "UNCERTAIN") {
    if (!openLoss) openLoss = { start: recorded.t, end: null, reason: recorded.status }
  } else if (openLoss) {
    lossIntervals = [...lossIntervals, { ...openLoss, end: recorded.t }]
    openLoss = null
  }

  const lastValid = recorded.status === "TRACKING" ? recorded : null

  return {
    samples,
    totalMovement: state.totalMovement + displacement,
    validSampleCount: state.validSampleCount + (recorded.status === "TRACKING" ? 1 : 0),
    lastValid,
    lossIntervals,
    openLoss,
  }
}

export function resetBaseline(state: MovementState): MovementState {
  return { ...state, lastValid: null }
}

export function chartSeries(samples: TrackingSample[]): { t: number; v: number; d: number }[] {
  let cum = 0
  return samples.map(s => {
    cum += s.displacement
    return { t: s.t, v: Math.round(cum * 10000) / 10000, d: s.displacement }
  })
}
