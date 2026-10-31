import { describe, expect, it } from "vitest"
import { coachingSuggestions, isConfirmedPunch, punchBreakdown } from "./punches"
import type { ActionEvent } from "../../api/analysis"

describe("coach punch counts", () => {
  it("counts only confirmed punch annotations", () => {
    const events: ActionEvent[] = [
      { id: "1", timestamp: 1, action_type: "jab", label: "Jab", boxer_label: "A", confirmed: true, target_area: "head" },
      { id: "2", timestamp: 2, action_type: "block", label: "Block", boxer_label: "A", confirmed: true },
    ]
    const b = punchBreakdown(events, "A")
    expect(b.punches).toBe(1)
    expect(b.defense).toBe(1)
    expect(events.filter(isConfirmedPunch)).toHaveLength(1)
  })

  it("does not invent automatic punch detections", () => {
    expect(punchBreakdown([], "A").empty).toBe(true)
    expect(punchBreakdown([], "A").candidatesUnverified).toBe(0)
  })

  it("supports suggestions with evidence", () => {
    const s = coachingSuggestions({
      punches: 8, jabs: 1, missed: 4, defense: 0, coveragePercent: 20, roundMovements: [0.4, 0.1],
    })
    expect(s.some(x => x.evidence.includes("coverage"))).toBe(true)
    expect(s.some(x => x.evidence.includes("Jabs"))).toBe(true)
  })
})
