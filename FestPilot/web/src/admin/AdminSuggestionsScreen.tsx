import { useEffect, useState } from "react";
import {
  AdminError,
  fetchSuggestions,
  setSuggestionStatus,
  type FestivalSuggestion,
  type SuggestionStatus,
} from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState } from "./AdminUi";

const STATUS_TONE: Record<string, string> = { new: "muted", planned: "warn", live: "ok", declined: "danger" };
const ACTIONS: { status: SuggestionStatus; label: string }[] = [
  { status: "planned", label: "Plan" },
  { status: "live", label: "Live" },
  { status: "declined", label: "Decline" },
];

/** R11.3 — Festival-suggestions inbox: rank by demand, move through new → planned → live / declined. */
export function AdminSuggestionsScreen(): JSX.Element {
  const [items, setItems] = useState<FestivalSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSuggestions(ctrl.signal)
      .then((r) => !ctrl.signal.aborted && setItems(r.suggestions))
      .catch((err) => !ctrl.signal.aborted && setError(err instanceof AdminError ? `Couldn't load (${err.status}).` : "Couldn't load suggestions."));
    return () => ctrl.abort();
  }, []);

  async function move(id: string, status: SuggestionStatus): Promise<void> {
    setBusyId(id);
    const prev = items;
    setItems((cur) => cur?.map((s) => (s.id === id ? { ...s, status } : s)) ?? cur);
    try {
      await setSuggestionStatus(id, status);
    } catch {
      setItems(prev ?? null); // revert on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <AdminHeader eyebrow="Demand" title="Festival suggestions" />
      {error ? (
        <AdminErrorState message={error} />
      ) : !items ? (
        <AdminLoading />
      ) : items.length === 0 ? (
        <div className="admin-state">
          <span className="ms">inbox</span>
          <p>No suggestions yet. They arrive from the app's "Suggest a festival" prompt.</p>
        </div>
      ) : (
        <div className="card admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Festival</th>
                <th>Requests</th>
                <th>Status</th>
                <th>Move to</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="admin-cell-title">{s.name}</td>
                  <td>
                    <span className="admin-pill ok">{s.count}</span>
                  </td>
                  <td>
                    <span className={`admin-pill ${STATUS_TONE[s.status] ?? "muted"}`}>{s.status}</span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      {ACTIONS.filter((a) => a.status !== s.status).map((a) => (
                        <button
                          key={a.status}
                          className="btn btn-ghost admin-mini-btn"
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => move(s.id, a.status)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
