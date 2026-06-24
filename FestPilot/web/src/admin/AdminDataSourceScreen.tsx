import { useEffect, useState } from "react";
import {
  AdminError,
  fetchAdminOverview,
  fetchDataSource,
  saveDataSource,
  type AdminFestivalRow,
  type DataSourceDto,
  type DataSourceInput,
  type DataSourceOrigin,
} from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState, AdminBanner } from "./AdminUi";

const ORIGINS: { value: DataSourceOrigin; label: string }[] = [
  { value: "official_page", label: "Official page → CDN JSON (DEC-009)" },
  { value: "manual", label: "Manual (no clean machine source)" },
  { value: "ai_assisted", label: "AI-assisted reader (pre-filled)" },
];

function toInput(dto: DataSourceDto): DataSourceInput {
  return {
    origin: dto.origin,
    pageUrl: dto.pageUrl,
    event: dto.event,
    uuid: dto.uuid,
    captureMethod: dto.captureMethod,
    notes: dto.notes,
    aiReaderEnabled: dto.aiReaderEnabled,
  };
}

/** R11.2 — Per-festival data-source registry: where the data comes from + how it's captured. */
export function AdminDataSourceScreen(): JSX.Element {
  const [festivals, setFestivals] = useState<AdminFestivalRow[] | null>(null);
  const [festivalId, setFestivalId] = useState<string | null>(null);
  const [dto, setDto] = useState<DataSourceDto | null>(null);
  const [form, setForm] = useState<DataSourceInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    setDto(null);
    setForm(null);
    setError(null);
    fetchDataSource(festivalId, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setDto(d);
        setForm(toInput(d));
      })
      .catch((err) => !ctrl.signal.aborted && setError(describe(err)));
    return () => ctrl.abort();
  }, [festivalId]);

  function patch<K extends keyof DataSourceInput>(key: K, value: DataSourceInput[K]): void {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSave(): Promise<void> {
    if (!festivalId || !form) return;
    setSaving(true);
    setToast(null);
    try {
      const saved = await saveDataSource(festivalId, form);
      setDto(saved);
      setForm(toInput(saved));
      setToast("Saved.");
    } catch (err) {
      setToast(describe(err));
    } finally {
      setSaving(false);
    }
  }

  const hasManyFestivals = (festivals?.length ?? 0) > 1;

  return (
    <div>
      <AdminHeader
        eyebrow="Data origin"
        title="Data sources"
        action={
          <button className="btn btn-primary" type="button" onClick={onSave} disabled={saving || !form}>
            <span className="ms">save</span>
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />

      {hasManyFestivals ? (
        <select className="field selectable admin-select" value={festivalId ?? ""} onChange={(e) => setFestivalId(e.target.value)}>
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
      ) : !form || !dto ? (
        <AdminLoading />
      ) : (
        <>
          {dto.operational ? (
            <AdminBanner tone="ok" icon="cloud_done">
              <b>Ingester is using</b> {dto.operational.event} · {dto.operational.uuid} from {dto.operational.pageUrl}.{" "}
              {dto.updatedAtUtc ? "" : "No operator record saved yet — the form is pre-filled from this."}
            </AdminBanner>
          ) : (
            <AdminBanner tone="warn" icon="cloud_off">
              <b>No operational source</b> — this festival has no automatic ingest. Document the manual capture below.
            </AdminBanner>
          )}

          <div className="card admin-form">
            <label className="label" htmlFor="ds-origin">Origin</label>
            <select
              id="ds-origin"
              className="field selectable"
              value={form.origin}
              onChange={(e) => patch("origin", e.target.value as DataSourceOrigin)}
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="admin-form-grid">
              <Field label="Event" value={form.event} onChange={(v) => patch("event", v)} placeholder="TL26BE" />
              <Field label="UUID" value={form.uuid} onChange={(v) => patch("uuid", v)} placeholder="resolved uuid" />
            </div>

            <Field label="Official page URL" value={form.pageUrl} onChange={(v) => patch("pageUrl", v)} placeholder="https://…" />

            <label className="label" htmlFor="ds-capture">How it's captured</label>
            <textarea
              id="ds-capture"
              className="field selectable admin-textarea"
              rows={2}
              value={form.captureMethod ?? ""}
              onChange={(e) => patch("captureMethod", e.target.value || null)}
              placeholder="Official page → resolve event+uuid → CDN JSON"
            />

            <label className="label" htmlFor="ds-notes">Notes</label>
            <textarea
              id="ds-notes"
              className="field selectable admin-textarea"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => patch("notes", e.target.value || null)}
              placeholder="Anything an operator should know"
            />

            <label className="admin-check">
              <input
                type="checkbox"
                checked={form.aiReaderEnabled}
                onChange={(e) => patch("aiReaderEnabled", e.target.checked)}
              />
              <span>
                AI-assisted reader <span className="admin-muted">(reserved — the reader is built later)</span>
              </span>
            </label>

            {dto.updatedAtUtc ? (
              <p className="admin-foot-note">Last saved {new Date(dto.updatedAtUtc).toLocaleString()}.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <div className="admin-field">
      <label className="label">{label}</label>
      <input
        className="field selectable"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
      />
    </div>
  );
}

function describe(err: unknown): string {
  if (err instanceof AdminError) return `Request failed (${err.status}).`;
  return "Something went wrong.";
}
