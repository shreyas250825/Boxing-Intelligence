import { TrackingEngine } from "../lib/tracking/trackingEngine"
import { rgbaToGray } from "../lib/tracking/image"
import { detectCornersDistributed } from "../lib/tracking/lucasKanade"
import type { NormBox } from "../lib/tracking/types"
import { MIN_FEATURE_POINTS } from "../lib/tracking/types"

const engine = new TrackingEngine()

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data as { type: string }

  if (type === "PROBE") {
    const { pixels, width, height, bbox } = e.data as {
      pixels: Uint8ClampedArray; width: number; height: number; bbox: NormBox
    }
    const gray = rgbaToGray(pixels, width, height)
    const points = detectCornersDistributed(gray, width, height, {
      x: bbox.x * width,
      y: bbox.y * height,
      w: bbox.w * width,
      h: bbox.h * height,
    })
    self.postMessage({
      type: "PROBE_RESULT",
      count: points.length,
      ok: points.length >= MIN_FEATURE_POINTS,
      need: MIN_FEATURE_POINTS,
    })
    return
  }

  if (type === "REGISTER") {
    const boxers = e.data.boxers as { id: string; bbox: NormBox; identifyTime: number }[]
    engine.disposeAll()
    for (const b of boxers) engine.registerBoxer(b.id, b.bbox, b.identifyTime)
    self.postMessage({ type: "REGISTERED" })
    return
  }

  if (type === "INIT_BOXER" || type === "INIT_ALL") {
    const { pixels, width, height, timestamp } = e.data as {
      pixels: Uint8ClampedArray; width: number; height: number; timestamp: number
      id?: string; bbox?: NormBox
      boxers?: { id: string; bbox: NormBox; identifyTime?: number }[]
    }
    const gray = rgbaToGray(pixels, width, height)
    const list = type === "INIT_ALL" && e.data.boxers
      ? e.data.boxers as { id: string; bbox: NormBox }[]
      : [{ id: e.data.id as string, bbox: e.data.bbox as NormBox }]
    const results = list.map(b => engine.initBoxer(b.id, gray, width, height, b.bbox, timestamp))
    self.postMessage({ type: "TRACK_RESULT", results, timestamp, width, height })
    return
  }

  if (type === "REIDENTIFY") {
    const { id, pixels, width, height, bbox, timestamp } = e.data as {
      id: string; pixels: Uint8ClampedArray; width: number; height: number; bbox: NormBox; timestamp: number
    }
    const gray = rgbaToGray(pixels, width, height)
    const update = engine.reidentify(id, gray, width, height, bbox, timestamp)
    self.postMessage({ type: "TRACK_RESULT", results: [update], timestamp, width, height })
    return
  }

  if (type === "SEEK_RESET") {
    engine.markSeek()
    self.postMessage({ type: "SEEK_ACK" })
    return
  }

  if (type === "TRACK_FRAME") {
    const { pixels, width, height, timestamp, seekReset } = e.data as {
      pixels: Uint8ClampedArray; width: number; height: number; timestamp: number; seekReset: boolean
    }
    const gray = rgbaToGray(pixels, width, height)
    const result = engine.step(gray, width, height, timestamp, !!seekReset)
    self.postMessage({ type: "FRAME_TRACKED", ...result })
    return
  }

  if (type === "DISPOSE") {
    engine.disposeAll()
    self.postMessage({ type: "DISPOSED" })
  }
}
