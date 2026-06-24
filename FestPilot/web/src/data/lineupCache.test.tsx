import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import type { LineupDto } from "./types";

const lineup: LineupDto = {
  festival: { id: "f1", name: "Tomorrowland", slug: "tml", timezone: "Europe/Brussels", revision: 1 },
  weekends: [{ id: "w1", name: "Weekend 1", startDate: null, endDate: null }],
  stages: [{ id: "s1", sourceStageId: "S1", name: "MAINSTAGE", sortOrder: 0 }],
  performances: [],
};

// Factory is hoisted above the consts, so it must be self-contained — resolved values are set in beforeEach.
vi.mock("./api", () => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public path: string) { super(message); }
  }
  return { ApiError, api: { listFestivals: vi.fn(), getLineup: vi.fn() } };
});

import { api } from "./api";
import { useLineup } from "./useLineup";
import { __resetLineupCache } from "./lineupCache";

const listFestivals = api.listFestivals as ReturnType<typeof vi.fn>;
const getLineup = api.getLineup as ReturnType<typeof vi.fn>;

function Consumer({ label }: { label: string }): JSX.Element {
  const { status, lineup: data, reload } = useLineup();
  return (
    <div data-testid={label}>
      <span>{status}:{data?.festival.name ?? "-"}</span>
      <button onClick={reload}>reload-{label}</button>
    </div>
  );
}

beforeEach(() => {
  cleanup();
  __resetLineupCache();
  vi.clearAllMocks();
  listFestivals.mockResolvedValue([lineup.festival]);
  getLineup.mockResolvedValue(lineup);
});

describe("shared lineup cache (R3)", () => {
  it("fetches once and shares the lineup across concurrent consumers", async () => {
    render(
      <>
        <Consumer label="a" />
        <Consumer label="b" />
      </>
    );

    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("ready:Tomorrowland"));
    expect(screen.getByTestId("b")).toHaveTextContent("ready:Tomorrowland");

    // Two consumers, ONE network round-trip — the in-flight request is shared.
    expect(listFestivals).toHaveBeenCalledTimes(1);
    expect(getLineup).toHaveBeenCalledTimes(1);
  });

  it("serves a switched-to tab from memory — no second network call", async () => {
    const { unmount } = render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("ready:Tomorrowland"));
    expect(getLineup).toHaveBeenCalledTimes(1);

    unmount(); // leave the "tab"

    render(<Consumer label="b" />);
    // Cached → ready immediately, with no extra fetch (the <300 ms instant tab switch).
    expect(screen.getByTestId("b")).toHaveTextContent("ready:Tomorrowland");
    expect(listFestivals).toHaveBeenCalledTimes(1);
    expect(getLineup).toHaveBeenCalledTimes(1);
  });

  it("reload forces a fresh fetch", async () => {
    render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("ready:Tomorrowland"));
    expect(getLineup).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("reload-a"));
    await waitFor(() => expect(getLineup).toHaveBeenCalledTimes(2));
  });

  it("surfaces an error on a cold failure", async () => {
    listFestivals.mockRejectedValueOnce(new Error("network down"));
    render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("error:-"));
  });

  it("keeps the stale lineup on a failed background revalidation", async () => {
    // 1 · cold load succeeds
    const { unmount } = render(<Consumer label="a" />);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("ready:Tomorrowland"));
    unmount();

    // 2 · force a reload that fails — the data already on screen must survive
    getLineup.mockRejectedValueOnce(new Error("flaky"));
    render(<Consumer label="b" />);
    fireEvent.click(screen.getByText("reload-b"));

    // Still ready with the previous lineup (never flips to a blank error once we have data).
    await waitFor(() => expect(getLineup).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("b")).toHaveTextContent("ready:Tomorrowland");
  });
});
