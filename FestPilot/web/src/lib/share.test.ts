// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatPlanText } from "./share";
import type { PlanSlot } from "../domain/types";

const MIN = 60_000;
function slot(label: string, startMin: number, stage = "MAINSTAGE"): PlanSlot {
  return {
    setId: label,
    actKey: label,
    label,
    stageId: stage,
    stageName: stage,
    startMs: startMin * MIN,
    endMs: (startMin + 60) * MIN,
    cutMs: null,
  };
}

describe("formatPlanText", () => {
  const tz = "UTC";

  it("orders sets by start time under a day heading", () => {
    const text = formatPlanText("Saturday 26", [slot("Adriatique", 120, "FREEDOM"), slot("Charlotte", 60, "CORE")], tz);
    const lines = text.split("\n");
    expect(lines[0]).toBe("My FestPilot plan · Saturday 26");
    expect(lines[1]).toContain("Charlotte"); // earlier set first
    expect(lines[1]).toContain("— CORE");
    expect(lines[2]).toContain("Adriatique");
  });

  it("appends the app link when an URL is provided", () => {
    const text = formatPlanText("Saturday", [slot("A", 0)], tz, "https://festpilot.app");
    expect(text).toContain("Build your own → https://festpilot.app");
  });

  it("omits the link footer when no URL is given", () => {
    const text = formatPlanText("Saturday", [slot("A", 0)], tz);
    expect(text).not.toContain("Build your own");
  });
});
