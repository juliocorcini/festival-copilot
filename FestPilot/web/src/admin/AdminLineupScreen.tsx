import { useEffect, useState } from "react";
import {
  AdminError,
  fetchAdminOverview,
  fetchLineupDashboard,
  reimportLineup,
  type AdminFestivalRow,
  type LineupDashboard,
} from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState, AdminBanner } from "./AdminUi";

function fmtTime(utc: string | null, tz: string): string {
  if (!utc) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(
      new Date(utc)
    );
  } catch {
    return "—";
  }
}

function relTime(utc: string): string {
  const diffMs = Date.now() - new Date(utc).getTime();
  const h = Math.round(diffMs / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** R11.1b — Lineup & timetable dashboard: documented source, per-stage health, re-import. */
export function AdminLineupScreen(): JSX.Element {
  const [festivals, setFestivals] = useState<AdminFestivalRow[] | null>(null);
  const [festivalId, setFestivalId] = useState<string | null>(null);
  const [dash, setDash] = useState<LineupDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAdminOverview(ctrl.signal)
      .then((o) => {
        if (ctrl.signal.aborted) return;
        setFestivals(o.festivals);
        setFestivalId((cur) => cur ?? o.festivals[0]?.id ?? null);
      })
      .catch((err) => !ctrl.signal.aborted && setError(describe(err)));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!festivalId) return;
    const ctrl = new AbortController();
    setDash(null);
    setError(null);
    fetchLineupDashboard(festivalId, ctrl.signal)
      .then((d) => !ctrl.signal.aborted && setDash(d))
      .catch((err) => !ctrl.signal.aborted && setError(describe(err)));
    return () => ctrl.abort();
  }, [festivalId]);

  async function onReimport(): Promise<void> {
    setReimporting(true);
    setToast(null);
    try {
      const res = await reimportLineup();
      setToast(res.status === "updated" ? `Re-imported · ${res.changes ?? 0} changes` : "Re-imported · no changes");
      if (festivalId) {
        const fresh = await fetchLineupDashboard(festivalId);
        setDash(fresh);
      }
    } catch (err) {
      setToast(describe(err));
    } finally {
      setReimporting(false);
    }
  }

  const hasManyFestivals = (festivals?.length ?? 0) > 1;

  return (
    <div>
      <AdminHeader
        eyebrow={dash?.festival.name ?? "Lineup"}
        title="Lineup & timetable"
        action={
          <button className="btn btn-primary" type="button" onClick={onReimport} disabled={reimporting || !festivalId}>
            <span className="ms">sync</span>
            {reimporting ? "Re-importing…" : "Re-import"}
          </button>
        }
      />

      {hasManyFestivals ? (
        <select
          className="field selectable admin-select"
          value={festivalId ?? ""}
          onChange={(e) => setFestivalId(e.target.value)}
        >
          {festivals!.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      ) : null}

      {toast ? <AdminBanner tone="info" icon="info">{toast}</AdminBanner> : null}

      {error ? (
        <AdminErrorState message={error} />
      ) : !dash ? (
        <AdminLoading />
      ) : (
        <>
          {dash.source ? (
            <AdminBanner tone="ok" icon="cloud_done">
              <b>Imported from the official source</b> — {dash.source.event} · {dash.source.uuid} · documented capture (not
              scraped/invented) · last sync {relTime(dash.source.lastSeenUtc)}.
            </AdminBanner>
          ) : (
            <AdminBanner tone="warn" icon="cloud_off">
              <b>No data source recorded</b> for this festival yet. Add one in <b>Data sources</b>.
            </AdminBanner>
          )}

          {dash.needsEndTime > 0 ? (
            <AdminBanner tone="warn" icon="warning">
              <b>{dash.needsEndTime}</b> scheduled {dash.needsEndTime === 1 ? "set is" : "sets are"} missing an end time.
            </AdminBanner>
          ) : null}

          <div className="card admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  {dash.days.map((d) => (
                    <th key={d}>{d.slice(0, 3)}</th>
                  ))}
                  <th>Total</th>
                  <th>First</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {dash.stages.map((s) => (
                  <tr key={s.id}>
                    <td className="admin-cell-title">{s.name}</td>
                    {dash.days.map((d) => (
                      <td key={d}>{s.countsByDay[d] ?? "—"}</td>
                    ))}
                    <td>
                      {s.total > 0 ? (
                        <span className="admin-pill ok">{s.total}</span>
                      ) : (
                        <span className="admin-pill muted">0</span>
                      )}
                    </td>
                    <td>{fmtTime(s.firstStartUtc, dash.festival.timezone)}</td>
                    <td>{fmtTime(s.lastStartUtc, dash.festival.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-foot-note">
            {dash.totals.sets} sets · {dash.totals.scheduled} scheduled · {dash.totals.stages} stages. Times in{" "}
            {dash.festival.timezone}.
          </p>
        </>
      )}
    </div>
  );
}

function describe(err: unknown): string {
  if (err instanceof AdminError) return `Request failed (${err.status}).`;
  return "Something went wrong.";
}
