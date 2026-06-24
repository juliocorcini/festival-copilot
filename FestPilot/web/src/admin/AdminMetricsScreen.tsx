import { useEffect, useState } from "react";
import { AdminError, fetchMetrics, type MetricsDto, type ServiceRunway } from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState, AdminBanner } from "./AdminUi";

/** R11.4 — Usage metrics + free-tier runway: real users + R2, honest about locked platform figures. */
export function AdminMetricsScreen(): JSX.Element {
  const [data, setData] = useState<MetricsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    fetchMetrics(ctrl.signal)
      .then((d) => setData(d))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof AdminError ? `Couldn't load metrics (${err.status}).` : "Couldn't load metrics.");
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div>
      <AdminHeader eyebrow="Usage" title="Metrics & runway" />
      {error ? (
        <AdminErrorState message={error} />
      ) : !data ? (
        <AdminLoading />
      ) : (
        <>
          <div className="admin-kpis">
            <Kpi label="Users" value={fmtInt(data.users.total)} />
            <Kpi label="Active · 7d" value={fmtInt(data.users.activeLast7d)} />
            <Kpi label="New · 7d" value={fmtInt(data.users.newLast7d)} />
            <Kpi label="With email" value={fmtInt(data.users.withEmail)} />
          </div>

          {data.users.testUsers > 0 ? (
            <AdminBanner tone="info" icon="science">
              {data.users.testUsers} synthetic test {data.users.testUsers === 1 ? "user is" : "users are"} excluded from
              every real count above (R11.5 live test console).
            </AdminBanner>
          ) : null}

          <SectionTitle icon="speed" text="Free-tier runway" />
          <div className="admin-runways">
            {data.runways.map((r) => (
              <RunwayCard key={r.id} r={r} />
            ))}
          </div>

          {data.locked.length > 0 ? (
            <AdminBanner tone="warn" icon="lock">
              <b>Exact platform consumption is locked.</b> Connect a Cloudflare Analytics token to track{" "}
              {data.locked.map((l) => l.label).join(", ")} live. Until then these aren't shown as numbers — never faked.
            </AdminBanner>
          ) : null}

          <SectionTitle icon="public" text="Who's using it" />
          <div className="admin-2col">
            <div className="card admin-panel">
              <div className="label">Top countries</div>
              {data.users.byCountry.length > 0 ? (
                <div className="admin-chips">
                  {data.users.byCountry.map((c) => (
                    <span key={c.country} className="admin-pill muted">
                      {flag(c.country)} {c.country} · {c.count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="admin-muted-p">No country data yet (derived from the edge, not GPS).</p>
              )}
              <div className="label admin-panel-sub">Activity · {data.activity.kind}</div>
              <p className="admin-muted-p">
                {fmtInt(data.activity.today)} today · {fmtInt(data.activity.avgPerDay)}/day avg (first-party).
              </p>
            </div>

            <div className="card admin-panel">
              <div className="label">Recently seen</div>
              {data.users.recent.length > 0 ? (
                <ul className="admin-recent">
                  {data.users.recent.map((u, i) => (
                    <li key={i}>
                      <span className="admin-recent-name">
                        {u.displayName || "Anonymous"}
                        {u.hasEmail ? <span className="ms admin-recent-mail" title="has email">mail</span> : null}
                      </span>
                      <span className="admin-recent-meta">
                        {u.country ? `${flag(u.country)} ${u.country}` : "—"} · {relTime(u.lastSeenUtc)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-muted-p">No users yet.</p>
              )}
            </div>
          </div>

          <p className="admin-foot-note">Generated {new Date(data.generatedAtUtc).toLocaleString()}.</p>
        </>
      )}
    </div>
  );
}

function RunwayCard({ r }: { r: ServiceRunway }): JSX.Element {
  return (
    <div className={`card admin-runway ${r.status}`}>
      <div className="admin-runway-head">
        <div className="admin-runway-label">{r.label}</div>
        <span className={`admin-pill ${pillTone(r.status)}`}>{r.usedPct}%</span>
      </div>
      <div className="admin-runway-bar">
        <span className={`admin-runway-fill ${r.status}`} style={{ width: `${Math.max(2, r.usedPct)}%` }} />
      </div>
      <div className="admin-runway-nums">
        {fmtAmount(r.used, r.unit)} <span className="admin-muted">/ {fmtAmount(r.ceiling, r.unit)}</span>
      </div>
      <div className="admin-runway-foot">
        {r.kind === "daily" ? (
          <span>Resets daily (00:00 UTC)</span>
        ) : r.daysLeft === null ? (
          <span>No growth — stable</span>
        ) : (
          <span>~{fmtInt(r.daysLeft)} days left at current rate</span>
        )}
        {!r.firstParty ? <span className="admin-runway-flag">lower bound</span> : null}
      </div>
      <p className="admin-runway-note">{r.note}</p>
    </div>
  );
}

function SectionTitle({ icon, text }: { icon: string; text: string }): JSX.Element {
  return (
    <h3 className="admin-section">
      <span className="ms">{icon}</span>
      {text}
    </h3>
  );
}

function Kpi({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="card admin-kpi">
      <div className="label">{label}</div>
      <div className="poster admin-kpi-num">{value}</div>
    </div>
  );
}

function pillTone(status: string): string {
  return status === "critical" ? "danger" : status === "watch" ? "warn" : "ok";
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function fmtAmount(value: number, unit: "bytes" | "count"): string {
  if (unit === "count") return fmtInt(value);
  return fmtBytes(value);
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** ISO-3166 alpha-2 → flag emoji (regional indicators). Falls back to nothing on bad input. */
function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "";
  const base = 0x1f1e6;
  const up = cc.toUpperCase();
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}
