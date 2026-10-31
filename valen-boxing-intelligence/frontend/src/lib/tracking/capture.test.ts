import { describe, expect, it } from "vitest"
import { resolveVideoStream } from "./capture"

describe("video stream URL for canvas capture", () => {
  it("uses a same-origin path in development", () => {
    const r = resolveVideoStream("vid-1", {
      dev: true,
      apiBase: "http://localhost:8000",
      pageOrigin: "http://localhost:5173",
    })
    expect(r.url).toBe("/api/v1/videos/vid-1/stream")
    expect(r.useCors).toBe(false)
  })

  it("streams from the API origin in production so Range requests skip Vercel", () => {
    const r = resolveVideoStream("vid-1", {
      dev: false,
      apiBase: "https://valen-api.onrender.com",
      pageOrigin: "https://valen.vercel.app",
    })
    expect(r.url).toBe("https://valen-api.onrender.com/api/v1/videos/vid-1/stream")
    expect(r.useCors).toBe(true)
  })

  it("stays same-origin when the API is reverse-proxied on the page origin", () => {
    const r = resolveVideoStream("vid-1", {
      dev: false,
      apiBase: "https://valen.vercel.app",
      pageOrigin: "https://valen.vercel.app",
    })
    expect(r.useCors).toBe(false)
  })
})
