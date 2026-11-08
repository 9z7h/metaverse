import { describe, expect, it } from "vitest";
import { gardenDaylight } from "./gardenTime";

describe("gardenDaylight", () => {
  it.each([
    ["2026-06-01T20:59:00Z", 0], // 서울 05:59
    ["2026-06-01T22:00:00Z", 0.5], // 서울 07:00
    ["2026-06-01T03:00:00Z", 1], // 서울 12:00
    ["2026-06-01T10:00:00Z", 0.5], // 서울 19:00
    ["2026-06-01T11:00:00Z", 0], // 서울 20:00
  ])("uses Korean local time at %s", (time, expected) => {
    expect(gardenDaylight(new Date(time))).toBe(expected);
  });
});
