import { useCallback, useEffect, useState } from "react";
import {
  AdminError,
  createFestival,
  fetchAdminOverview,
  reimportFestival,
  reimportLineup,
  updateFestival,
  type AdminFestivalRow,
  type AdminOverview,
  type CreateFestivalInput,
} from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState, AdminBanner } from "./AdminUi";

const COMMON_TIMEZONES = [
  "Europe/Brussels",
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Lisbon",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

interface Banner {
  tone: "ok" | "warn" | "info";
  icon: string;
  message: string;
}

/** R11.1a/c — Festivals overview + onboarding: add, manage and re-import festivals (DEC-063). */
export function AdminFestivalsScreen(): JSX.Element {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reimportingAll, setReimportingAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const d = await fetchAdminOverview(signal);
      if (!signal?.aborted) {
        setData(d);
        setError(null);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof AdminError ? `Couldn't load the overview (${err.status}).` : "Couldn't load the overview.");
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  async function onReimport(f: AdminFestivalRow): Promise<void> {
    setBusyId(f.id);
    setBanner(null);
    try {
      const r = await reimportFestival(f.id);
      await load();
      const changed = typeof r.changesCount === "number" ? r.changesCount : 0;
      setBanner({
        tone: "ok",
        icon: "sync",
        message: r.status === "no_changes" ? `${f.name}: already up to date.` : `${f.name}: re-imported (${changed} changes).`,
      });
    } catch (err) {
      setBanner({ tone: "warn", icon: "error", message: messageOf(err, `Couldn't re-import ${f.name}.`) });
    } finally {
      setBusyId(null);
    }
  }

  async function onReimportAll(): Promise<void> {
    setReimportingAll(true);
    setBanner(null);
    try {
      const { results } = await reimportLineup();
      await load();
      setBanner({ tone: "ok", icon: "sync", message: `Re-imported ${results.length} festival${results.length === 1 ? "" : "s"}.` });
    } catch (err) {
      setBanner({ tone: "warn", icon: "error", message: messageOf(err, "Couldn't re-import.") });
    } finally {
      setReimportingAll(false);
    }
  }

  return (
    <div>
      <AdminHeader
        eyebrow="Overview"
        title="Festivals"
        action={
          <>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={onReimportAll}
              disabled={reimportingAll || !data || data.festivals.length === 0}
            >
              <span className={`ms${reimportingAll ? " admin-state-spin" : ""}`}>sync</span>
              {reimportingAll ? "Re-importing…" : "Re-import all"}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setShowAdd((v) => !v)}>
              <span className="ms">{showAdd ? "close" : "add"}</span>
              {showAdd ? "Cancel" : "Add festival"}
            </button>
          </>
        }
      />

      {banner ? (
        <AdminBanner tone={banner.tone} icon={banner.icon}>
          {banner.message}
        </AdminBanner>
      ) : null}

      {showAdd ? (
        <AddFestivalForm
          onCreated={(msg) => {
            setShowAdd(false);
            setBanner({ tone: "ok", icon: "check_circle", message: msg });
            void load();
          }}
        />
      ) : null}

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
                  <th className="admin-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.festivals.map((f) => (
                  <FestivalRow
                    key={f.id}
                    f={f}
                    busy={busyId === f.id}
                    editing={editingId === f.id}
                    onReimport={() => onReimport(f)}
                    onToggleEdit={() => setEditingId((cur) => (cur === f.id ? null : f.id))}
                    onSaved={(msg) => {
                      setEditingId(null);
                      setBanner({ tone: "ok", icon: "check", message: msg });
                      void load();
                    }}
                  />
                ))}
                {data.festivals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty-cell">
                      No festivals yet. Click <b>Add festival</b> to import one from its official lineup page — the whole
                      pipeline (lineup capture, timetable, map) is reusable.
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

function FestivalRow({
  f,
  busy,
  editing,
  onReimport,
  onToggleEdit,
  onSaved,
}: {
  f: AdminFestivalRow;
  busy: boolean;
  editing: boolean;
  onReimport: () => void;
  onToggleEdit: () => void;
  onSaved: (message: string) => void;
}): JSX.Element {
  return (
    <>
      <tr>
        <td>
          <div className="admin-cell-title">{f.name}</div>
          <div className="admin-cell-sub">
            {f.slug} · {f.timezone}
          </div>
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
        <td className="admin-col-actions">
          <div className="admin-row-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={onReimport} disabled={busy} title="Re-import from source">
              <span className={`ms${busy ? " admin-state-spin" : ""}`}>sync</span>
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onToggleEdit} title="Edit name / timezone">
              <span className="ms">{editing ? "close" : "edit"}</span>
            </button>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr className="admin-edit-row">
          <td colSpan={7}>
            <EditFestivalForm f={f} onSaved={onSaved} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EditFestivalForm({ f, onSaved }: { f: AdminFestivalRow; onSaved: (message: string) => void }): JSX.Element {
  const [name, setName] = useState(f.name);
  const [timezone, setTimezone] = useState(f.timezone);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = name.trim() !== f.name || timezone.trim() !== f.timezone;

  async function onSave(): Promise<void> {
    setSaving(true);
    setErr(null);
    try {
      const patch: { name?: string; timezone?: string } = {};
      if (name.trim() !== f.name) patch.name = name.trim();
      if (timezone.trim() !== f.timezone) patch.timezone = timezone.trim();
      await updateFestival(f.id, patch);
      onSaved(`Updated ${name.trim()}.`);
    } catch (e) {
      setErr(messageOf(e, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-inline-form">
      <div className="admin-field">
        <label className="label">Name</label>
        <input className="field selectable" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="label">Timezone</label>
        <input
          className="field selectable"
          value={timezone}
          list="fp-tz-list"
          onChange={(e) => setTimezone(e.target.value)}
        />
      </div>
      <button className="btn btn-primary btn-sm" type="button" onClick={onSave} disabled={saving || !dirty || !name.trim()}>
        {saving ? "Saving…" : "Save"}
      </button>
      {err ? <span className="admin-inline-error">{err}</span> : null}
      <TimezoneDatalist />
    </div>
  );
}

const EMPTY_CREATE: CreateFestivalInput = { name: "", slug: "", timezone: "Europe/Brussels", pageUrl: "", event: "", uuid: "" };

function AddFestivalForm({ onCreated }: { onCreated: (message: string) => void }): JSX.Element {
  const [form, setForm] = useState<CreateFestivalInput>(EMPTY_CREATE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof CreateFestivalInput>(key: K, value: CreateFestivalInput[K]): void {
    setForm((s) => ({ ...s, [key]: value }));
  }

  const canSubmit = form.name.trim() !== "" && form.timezone.trim() !== "" && form.pageUrl.trim() !== "";

  async function onSubmit(): Promise<void> {
    if (!canSubmit) return;
    setCreating(true);
    setErr(null);
    try {
      const input: CreateFestivalInput = {
        name: form.name.trim(),
        slug: form.slug?.trim() || undefined,
        timezone: form.timezone.trim(),
        pageUrl: form.pageUrl.trim(),
        event: form.event?.trim() || undefined,
        uuid: form.uuid?.trim() || undefined,
      };
      const r = await createFestival(input);
      const sets = typeof r.changesCount === "number" ? r.changesCount : 0;
      onCreated(`Imported ${r.name}: ${sets} sets (revision ${r.revision ?? 1}).`);
    } catch (e) {
      setErr(messageOf(e, "Couldn't add the festival."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card admin-form admin-add-form">
      <AdminBanner tone="info" icon="bolt">
        Adding a festival imports its lineup live from the official page — no data is typed by hand. Works for any event on
        the same lineup platform.
      </AdminBanner>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label className="label">Festival name</label>
          <input
            className="field selectable"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Tomorrowland Belgium 2027"
          />
        </div>
        <div className="admin-field">
          <label className="label">
            Slug <span className="admin-muted">(optional)</span>
          </label>
          <input
            className="field selectable"
            value={form.slug ?? ""}
            onChange={(e) => set("slug", e.target.value)}
            placeholder={slugPreview(form.name) || "auto from name"}
          />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-field">
          <label className="label">Timezone</label>
          <input
            className="field selectable"
            value={form.timezone}
            list="fp-tz-list"
            onChange={(e) => set("timezone", e.target.value)}
            placeholder="Europe/Brussels"
          />
        </div>
        <div className="admin-field">
          <label className="label">Official lineup page URL</label>
          <input
            className="field selectable"
            value={form.pageUrl}
            onChange={(e) => set("pageUrl", e.target.value)}
            placeholder="https://www.tomorrowland.com/…/line-up"
          />
        </div>
      </div>

      <button className="btn btn-ghost btn-sm admin-disclosure" type="button" onClick={() => setShowAdvanced((v) => !v)}>
        <span className="ms">{showAdvanced ? "expand_less" : "expand_more"}</span>
        Advanced: saved source ref (fallback)
      </button>
      {showAdvanced ? (
        <div className="admin-form-grid">
          <div className="admin-field">
            <label className="label">Event</label>
            <input
              className="field selectable"
              value={form.event ?? ""}
              onChange={(e) => set("event", e.target.value)}
              placeholder="TL27BE"
            />
          </div>
          <div className="admin-field">
            <label className="label">UUID</label>
            <input
              className="field selectable"
              value={form.uuid ?? ""}
              onChange={(e) => set("uuid", e.target.value)}
              placeholder="used only if the page is blocked"
            />
          </div>
        </div>
      ) : null}

      {err ? (
        <AdminBanner tone="warn" icon="error">
          {err}
        </AdminBanner>
      ) : null}

      <div className="admin-form-actions">
        <button className="btn btn-primary" type="button" onClick={onSubmit} disabled={!canSubmit || creating}>
          <span className={`ms${creating ? " admin-state-spin" : ""}`}>{creating ? "progress_activity" : "download"}</span>
          {creating ? "Importing the lineup…" : "Add & import"}
        </button>
        {creating ? <span className="admin-muted">Resolving the source and importing — this can take a few seconds.</span> : null}
      </div>
      <TimezoneDatalist />
    </div>
  );
}

function TimezoneDatalist(): JSX.Element {
  return (
    <datalist id="fp-tz-list">
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz} value={tz} />
      ))}
    </datalist>
  );
}

/** Mirror of the server slug normalization — a live preview, the server is the source of truth. */
function slugPreview(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof AdminError) return err.message || `${fallback} (${err.status})`;
  return fallback;
}
