export type TrackStatus = "PENDING" | "TRACKING" | "LOST" | "UNCERTAIN"

export interface NormBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export interface TrackingSample {
  t: number
  cx: number
  cy: number
  x: number
  y: number
  w: number
  h: number
  confidence: number
  status: TrackStatus
  displacement: number
  valid_points: number
  camera_reliable: boolean
}

export interface LossInterval {
  start: number
  end: number | null
  reason: string
}

export interface TrackUpdate {
  id: string
  timestamp: number
  bbox: NormBox | null
  cx: number
  cy: number
  status: TrackStatus
  confidence: number
  validPoints: number
  attemptedPoints: number
  medianFbError: number
  displacement: number
  skipDisplacement: boolean
  inFrame: boolean
  cameraReliable: boolean
  initFailed?: boolean
  initReason?: string
  pendingInit?: boolean
  usedAffine?: boolean
  checkpointCorrection?: {
    slot: "early" | "middle" | "late"
    predictedCx: number
    predictedCy: number
    confirmedCx: number
    confirmedCy: number
    drift: number
  }
}

export interface DisplayRect {
  offsetX: number
  offsetY: number
  drawWidth: number
  drawHeight: number
  videoWidth: number
  videoHeight: number
  clientWidth: number
  clientHeight: number
}

export const MEASUREMENT_LABEL = "normalized_image_plane_movement"
export const TRACKING_VERSION = "lk-pyramid-v3"
export const MIN_FEATURE_POINTS = 5
export const STATIONARY_RATE_THRESHOLD = 0.015
export const RATE_WINDOW_SECONDS = 1
export const PROCESS_TARGET_WIDTH = 640
export const PROCESS_TARGET_HEIGHT = 360
