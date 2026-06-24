import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { LineupDto } from "../data/types";

// A tiny, time-independent lineup: the MAINSTAGE set spans 2020→2030 so "now" is always inside it.
const lineup: LineupDto = {
  festival: { id: "f1", name: "Tomorrowland", slug: "tml", timezone: "Europe/Brussels", revision: 1 },
  weekends: [{ id: "w1", name: "Weekend 1", startDate: null, endDate: null }],
  stages: [
    { id: "s1", sourceStageId: "S1", name: "MAINSTAGE", sortOrder: 0 },
    { id: "s2", sourceStageId: "S2", name: "CORE", sortOrder: 1 },
  ],
  performances: [
    {
      id: "p1", sourcePerformanceId: "P1", name: "Big Act", day: "FRIDAY", dateLocal: null,
      weekendId: "w1", stageId: "s1", startAtUtc: "2020-01-01T00:00:00Z", endAtUtc: "2030-01-01T00:00:00Z",
      isPlaceholder: false, artists: [{ id: "a1", name: "Big Act", imageUrl: null }],
    },
  ],
};

vi.mock("../data/api", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public path: string) { super(message); }
  }
  return {
    ApiError,
    api: {
      listFestivals: vi.fn().mockResolvedValue([lineup.festival]),
      getLineup: vi.fn().mockResolvedValue(lineup),
    },
  };
});

const transform = {
  festival: "tomorrowland-deschorre",
  venue: "De Schorre",
  canvas: { width: 1000, height: 1291 },
  bbox: { west: 0, east: 1, south: 0, north: 1 },
  affine: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 },
  stages: [
    { name: "MAINSTAGE", lng: 400, lat: 600, matched: true },
    { name: "CORE", lng: 500, lat: 700, matched: true },
    { name: "CAGE", lng: 300, lat: 500, matched: true },
  ],
  source: "OpenStreetMap contributors (ODbL)",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(transform) }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MapView — interactive vector stage overlay (DEC-050 / R2.2)", () => {
  it("renders one tappable overlay node per stage, inside the SVG overlay (not the base)", async () => {
    const { MapView } = await import("./MapView");
    render(<MapView />);

    const main = await screen.findByRole("button", { name: /^MAINSTAGE/ });
    // The marker is a vector overlay node — inside <svg class="overlay">, not the raster <img>.
    expect(main.closest("svg.overlay")).not.toBeNull();
    expect(main.closest("img")).toBeNull();

    // One pin per stage in the transform.
    const pins = screen.getAllByRole("button", { name: /MAINSTAGE|CORE|CAGE/ });
    expect(pins).toHaveLength(transform.stages.length);

    // Stage names are crisp overlay <text>, never baked: each name renders as text in the overlay.
    const overlay = main.closest("svg.overlay")!;
    expect(within(overlay as HTMLElement).getByText("MAINSTAGE")).toBeInTheDocument();
  });

  it("opens the stage info sheet on tap, with now-playing from the lineup", async () => {
    const { MapView } = await import("./MapView");
    render(<MapView />);

    const main = await screen.findByRole("button", { name: /^MAINSTAGE/ });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(main, { clientX: 10, clientY: 10 });

    const sheet = await screen.findByRole("dialog", { name: /MAINSTAGE info/ });
    expect(within(sheet).getByText("Big Act")).toBeInTheDocument();
    expect(within(sheet).getByText("● now")).toBeInTheDocument();
  });

  it("does not open the sheet when the gesture is a drag, not a tap", async () => {
    const { MapView } = await import("./MapView");
    render(<MapView />);

    const main = await screen.findByRole("button", { name: /^MAINSTAGE/ });
    fireEvent.pointerDown(main, { clientX: 10, clientY: 10 });
    fireEvent.click(main, { clientX: 80, clientY: 90 }); // released far → pan, not tap
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
