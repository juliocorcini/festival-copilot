import { useEffect, useState } from "react";
import { AdminError, fetchAdminOverview, type AdminFestivalRow, type AdminOverview } from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState } from "./AdminUi";

/** R11.1a — Festivals overview: global KPIs + per-festival health (lineup / timetable / map). */
export function AdminFestivalsScreen(): JSX.Element {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    fetchAdminOverview(ctrl.signal)
      .then((d) => setData(d))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof AdminError ? `Couldn't load the overview (${err.status}).` : "Couldn't load the overview.");
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div>
      <AdminHeader eyebrow="Overview" title="Festivals" />
      {error ? (
        <AdminErrorState message={error} />
      ) : !data ? (
        <AdminLoading />
      ) : (
        <>
          <div className="admin-kpis">
            <Kpi label="Festivals" value={data.totals.festivals} />
            <Kpi label="Stages" value={data.totals.stages} />
            <Kpi label="Performances" value={data.totals.performances} />
            <Kpi label="Scheduled" value={data.totals.scheduled} />
          </div>
          <div className="card admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Festival</th>
                  <th>Stages</th>
                  <th>Lineup</th>
                  <th>Timetable</th>
                  <th>Map</th>
                  <th>Rev</th>
                </tr>
              </thead>
              <tbody>
                {data.festivals.map((f) => (
                  <FestivalRow key={f.id} f={f} />
                ))}
                {data.festivals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty-cell">
                      No festivals yet. The whole pipeline (lineup capture, map) is reusable once one is added.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="card admin-kpi">
      <div className="label">{label}</div>
      <div className="poster admin-kpi-num">{value}</div>
    </div>
  );
}

function FestivalRow({ f }: { f: AdminFestivalRow }): JSX.Element {
  return (
    <tr>
      <td>
        <div className="admin-cell-title">{f.name}</div>
        <div className="admin-cell-sub">{f.slug} · {f.timezone}</div>
      </td>
      <td>{f.stageCount}</td>
      <td>
        {f.performanceCount > 0 ? (
          <span className="admin-pill ok">
            <span className="ms">check</span>
            {f.performanceCount} sets
          </span>
        ) : (
          <span className="admin-pill muted">none</span>
        )}
      </td>
      <td>
        {f.scheduledCount > 0 ? (
          <span className="admin-pill ok">{f.scheduledCount} timed</span>
        ) : (
          <span className="admin-pill warn">
            <span className="ms">schedule</span>
            lineup-only
          </span>
        )}
      </td>
      <td>
        {f.hasMap ? (
          <span className="admin-pill ok">published</span>
        ) : (
          <span className="admin-pill muted">none</span>
        )}
      </td>
      <td>{f.revision}</td>
    </tr>
  );
}
