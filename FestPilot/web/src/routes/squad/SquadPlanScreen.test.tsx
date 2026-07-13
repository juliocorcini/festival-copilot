/**
 * Regression test for SquadPlanScreen.
 *
 * The original bug: two useMemo hooks were placed AFTER conditional early returns
 * (loading / error), violating React's Rules of Hooks. When the component re-rendered
 * from "loading" → "ready", the hook count changed, triggering a runtime crash caught
 * by the ErrorBoundary.
 *
 * These tests verify the component renders in every state WITHOUT crashing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SquadPlan, SquadBlock } from "../../domain/squadPlan";
import type { PlannableSet } from "../../domain/types";
import type { SquadPlanNotice } from "../../data/squadPlan";

/* ------------------------------------------------------------------ */
/*  Controllable mock state for all data hooks                         */
/* ------------------------------------------------------------------ */

let mockSquadPlan: {
  plan: SquadPlan | null;
  raw: unknown;
  daySets: PlannableSet[];
  meId: string | null;
  timezone: string;
  status: "loading" | "ready" | "error";
  reload: () => void;
};

let mockGroupEvents: { events: never[]; status: "loading" | "ready"; reload: () => void };

vi.mock("../../data/groups", () => ({
  useGroup: () => ({
    group: { id: "g1", name: "Test Squad", emoji: "🎶", memberCount: 3 },
    members: [],
    status: "ready" as const,
    reload: vi.fn(),
  }),
}));

vi.mock("../../data/groupEvents", () => ({
  useGroupEvents: () => mockGroupEvents,
}));

vi.mock("../../data/localStore", () => ({
  useOnboarding: () => ({
    onboarding: { festivalId: "f1", weekendIds: ["w1"], dayKeys: ["SAT"], completed: true },
    save: vi.fn(),
    reset: vi.fn(),
    acknowledgeLineup: vi.fn(),
  }),
}));

vi.mock("../../data/useLineup", () => ({
  useLineup: () => ({
    status: "ready" as const,
    lineup: {
      festival: { id: "f1", name: "Tomorrowland", slug: "tml", timezone: "Europe/Brussels", revision: 1, withTimetable: true },
      weekends: [{ id: "w1", name: "Weekend 1", startDate: null, endDate: null }],
      stages: [{ id: "s1", sourceStageId: "S1", name: "MAINSTAGE", sortOrder: 0 }],
      performances: [{
        id: "p1", sourcePerformanceId: "P1", name: "TestAct", day: "SAT", dateLocal: null,
        weekendId: "w1", stageId: "s1", startAtUtc: "2026-07-18T18:00:00Z", endAtUtc: "2026-07-18T19:00:00Z",
        isPlaceholder: false, artists: [{ id: "a1", name: "TestAct", imageUrl: null }],
      }],
      hasLineup: true,
      hasTimetable: true,
    },
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../../data/squadPlan", () => ({
  useSquadPlan: () => mockSquadPlan,
  useLivePlanSync: vi.fn(),
  useBulkPlanSync: vi.fn(),
  useSquadPlanNotice: (): SquadPlanNotice => ({
    count: 0,
    latest: null,
    changes: [],
    status: "ready" as const,
    reload: vi.fn(),
    markSeen: vi.fn(),
  }),
}));

vi.mock("../../i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("../../lib/format", () => ({
  stageColor: () => "#ccc",
  timeInZone: (_iso: string) => "12:00",
}));

vi.mock("../../lib/festival", () => ({
  daysForWeekends: () => [{ key: "SAT", weekdayShort: "Sat", startMs: Date.UTC(2026, 6, 18, 18, 0) }],
}));

vi.mock("./squadUi", () => ({
  blockSummary: () => "3 going",
  StatusPill: () => null,
}));

vi.mock("./eventsUi", () => ({
  durationLabel: () => "1h",
  eventLifecycleFromIso: () => "future",
}));

vi.mock("./CreateEventSheet", () => ({
  CreateEventSheet: () => null,
}));

import { SquadPlanScreen } from "./SquadPlanScreen";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MIN = 60_000;

function makePlannableSet(id: string, startMin: number, endMin: number): PlannableSet {
  return {
    id, actKey: id, label: id, stageId: "s1", stageName: "MAINSTAGE",
    startMs: startMin * MIN, endMs: endMin * MIN, day: "SAT", weekendId: "w1",
  };
}

function makeBlock(id: string, startMin: number, endMin: number): SquadBlock {
  return {
    set: makePlannableSet(id, startMin, endMin),
    going: [], goingCount: 3, splitCount: 0, split: [], method: "plurality",
    youStatus: "following", yourLock: null, fallback: null, pinned: false,
  };
}

function makeReadyPlan(): SquadPlan {
  return {
    blocks: [makeBlock("Adriatique", 1260, 1320), makeBlock("Tale of Us", 1320, 1380)],
    memberCount: 3,
    sharedCount: 3,
    members: [],
    enoughToBuild: true,
  };
}

function renderScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={["/squad/g1/plan"]}>
      <Routes>
        <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  mockSquadPlan = {
    plan: null, raw: null, daySets: [], meId: null,
    timezone: "Europe/Brussels", status: "loading", reload: vi.fn(),
  };
  mockGroupEvents = { events: [], status: "ready", reload: vi.fn() };
});

afterEach(() => cleanup());

describe("SquadPlanScreen hook-order regression", () => {
  it("renders in loading state without crashing", () => {
    mockSquadPlan.status = "loading";
    expect(() => renderScreen()).not.toThrow();
  });

  it("renders in error state without crashing", () => {
    mockSquadPlan.status = "error";
    expect(() => renderScreen()).not.toThrow();
  });

  it("renders in ready state with a full plan without crashing", () => {
    const plan = makeReadyPlan();
    mockSquadPlan = {
      plan, raw: { members: [], memberCount: 3, overrides: [] }, daySets: [],
      meId: "me", timezone: "Europe/Brussels", status: "ready", reload: vi.fn(),
    };
    expect(() => renderScreen()).not.toThrow();
  });

  it("REGRESSION: transitions from loading → ready without a hooks violation", () => {
    mockSquadPlan.status = "loading";

    const { rerender } = render(
      <MemoryRouter initialEntries={["/squad/g1/plan"]}>
        <Routes>
          <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const plan = makeReadyPlan();
    mockSquadPlan = {
      plan, raw: { members: [{ isYou: true, userId: "me", shared: true }], memberCount: 3, overrides: [] },
      daySets: [], meId: "me", timezone: "Europe/Brussels", status: "ready", reload: vi.fn(),
    };

    expect(() => {
      act(() => {
        rerender(
          <MemoryRouter initialEntries={["/squad/g1/plan"]}>
            <Routes>
              <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
            </Routes>
          </MemoryRouter>,
        );
      });
    }).not.toThrow();
  });

  it("REGRESSION: transitions from loading → error without a hooks violation", () => {
    mockSquadPlan.status = "loading";

    const { rerender } = render(
      <MemoryRouter initialEntries={["/squad/g1/plan"]}>
        <Routes>
          <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    mockSquadPlan.status = "error";

    expect(() => {
      act(() => {
        rerender(
          <MemoryRouter initialEntries={["/squad/g1/plan"]}>
            <Routes>
              <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
            </Routes>
          </MemoryRouter>,
        );
      });
    }).not.toThrow();
  });

  it("REGRESSION: transitions from error → ready without a hooks violation", () => {
    mockSquadPlan.status = "error";

    const { rerender } = render(
      <MemoryRouter initialEntries={["/squad/g1/plan"]}>
        <Routes>
          <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const plan = makeReadyPlan();
    mockSquadPlan = {
      plan, raw: { members: [], memberCount: 3, overrides: [] },
      daySets: [], meId: null, timezone: "Europe/Brussels", status: "ready", reload: vi.fn(),
    };

    expect(() => {
      act(() => {
        rerender(
          <MemoryRouter initialEntries={["/squad/g1/plan"]}>
            <Routes>
              <Route path="/squad/:id/plan" element={<SquadPlanScreen />} />
            </Routes>
          </MemoryRouter>,
        );
      });
    }).not.toThrow();
  });
});

describe("SquadPlanScreen content", () => {
  it("shows a loading indicator while data is loading", () => {
    mockSquadPlan.status = "loading";
    renderScreen();
    expect(screen.getByText("squad.planTitle")).toBeTruthy();
  });

  it("shows an error message when status is error", () => {
    mockSquadPlan.status = "error";
    renderScreen();
    expect(screen.getByText("squad.planLoadError")).toBeTruthy();
  });

  it("shows the empty state when plan has no blocks", () => {
    mockSquadPlan = {
      plan: { blocks: [], memberCount: 3, sharedCount: 1, members: [], enoughToBuild: false },
      raw: { members: [{ isYou: true, userId: "me", shared: false }], memberCount: 3, overrides: [] },
      daySets: [], meId: "me", timezone: "Europe/Brussels", status: "ready", reload: vi.fn(),
    };
    renderScreen();
    expect(screen.getByText("squad.notEnoughTitle")).toBeTruthy();
  });

  it("renders squad blocks when the plan is built", () => {
    const plan = makeReadyPlan();
    mockSquadPlan = {
      plan, raw: { members: [{ isYou: true, userId: "me", shared: true }], memberCount: 3, overrides: [] },
      daySets: [], meId: "me", timezone: "Europe/Brussels", status: "ready", reload: vi.fn(),
    };
    renderScreen();
    expect(screen.getByText("Adriatique")).toBeTruthy();
    expect(screen.getByText("Tale of Us")).toBeTruthy();
  });
});
