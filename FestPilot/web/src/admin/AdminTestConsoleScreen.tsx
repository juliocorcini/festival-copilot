import { useCallback, useEffect, useState } from "react";
import {
  AdminError,
  fetchInjectableStages,
  fetchTestGroups,
  fetchTestMembers,
  injectTestFix,
  purgeTestData,
  spawnTestMember,
  type InjectableStage,
  type TestGroupRow,
  type TestMemberRow,
} from "./adminApi";
import { AdminHeader, AdminLoading, AdminErrorState, AdminBanner } from "./AdminUi";

/** R11.5 — Live test console: inject synthetic members and drive them across the map in real time. */
export function AdminTestConsoleScreen(): JSX.Element {
  const [groups, setGroups] = useState<TestGroupRow[] | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [stages, setStages] = useState<InjectableStage[]>([]);
  const [members, setMembers] = useState<TestMemberRow[]>([]);
  const [name, setName] = useState("");
  const [newStage, setNewStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const group = groups?.find((g) => g.id === groupId) ?? null;

  useEffect(() => {
    const ctrl = new AbortController();
    fetchTestGroups(ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setGroups(d.groups);
        setGroupId((cur) => cur ?? d.groups[0]?.id ?? null);
      })
      .catch((err) => !ctrl.signal.aborted && setError(describe(err)));
    return () => ctrl.abort();
  }, []);

  const refreshMembers = useCallback(async (gid: string): Promise<void> => {
    const { members: rows } = await fetchTestMembers(gid);
    setMembers(rows);
  }, []);

  useEffect(() => {
    if (!group) return;
    const ctrl = new AbortController();
    setMembers([]);
    setStages([]);
    setNewStage("");
    Promise.all([fetchInjectableStages(group.festivalId, ctrl.signal), fetchTestMembers(group.id, ctrl.signal)])
      .then(([s, m]) => {
        if (ctrl.signal.aborted) return;
        setStages(s.stages);
        setNewStage(s.stages[0]?.stageId ?? "");
        setMembers(m.members);
      })
      .catch((err) => !ctrl.signal.aborted && setError(describe(err)));
    return () => ctrl.abort();
  }, [group]);

  async function withBusy(action: () => Promise<void>, ok: string): Promise<void> {
    setBusy(true);
    setToast(null);
    try {
      await action();
      setToast(ok);
    } catch (err) {
      setToast(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const onAdd = (): Promise<void> =>
    withBusy(async () => {
      if (!groupId) return;
      await spawnTestMember(groupId, { name: name.trim() || undefined, stageId: newStage || undefined });
      setName("");
      await refreshMembers(groupId);
    }, "Test member added.");

  const onMove = (userId: string, stageId: string): Promise<void> =>
    withBusy(async () => {
      if (!groupId || !stageId) return;
      await injectTestFix(userId, { groupId, stageId });
      await refreshMembers(groupId);
    }, "Moved — check your app.");

  const onPurge = (): Promise<void> =>
    withBusy(async () => {
      const { users } = await purgeTestData();
      if (groupId) await refreshMembers(groupId);
      setToast(`Purged ${users} test ${users === 1 ? "user" : "users"}.`);
    }, "Purged.");

  return (
    <div>
      <AdminHeader
        eyebrow="Live testing"
        title="Test console"
        action={
          <button className="btn btn-ghost admin-danger-btn" type="button" onClick={onPurge} disabled={busy}>
            <span className="ms">delete_sweep</span>
            Purge test data
          </button>
        }
      />

      {error ? (
        <AdminErrorState message={error} />
      ) : !groups ? (
        <AdminLoading />
      ) : groups.length === 0 ? (
        <AdminBanner tone="info" icon="groups">
          No squads yet. Create a squad in the app first, then inject synthetic members here to test presence live.
        </AdminBanner>
      ) : (
        <>
          <AdminBanner tone="info" icon="science">
            Synthetic <b>is_test</b> members drive the <b>real</b> presence pipeline. Open this squad's "Where's everyone"
            in your app and watch them appear and move. They never count in usage metrics.
          </AdminBanner>

          {groups.length > 1 ? (
            <select className="field selectable admin-select" value={groupId ?? ""} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.festivalName} ({g.memberCount} members)
                </option>
              ))}
            </select>
          ) : null}

          {group && !group.hasMap ? (
            <AdminBanner tone="warn" icon="map">
              <b>{group.festivalName}</b> has no published map yet — positions can't be injected until a map is published.
            </AdminBanner>
          ) : null}

          {toast ? <AdminBanner tone="ok" icon="check_circle">{toast}</AdminBanner> : null}

          <div className="card admin-panel admin-test-add">
            <div className="label">Add a test member</div>
            <div className="admin-test-add-row">
              <input
                className="field selectable"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
              <select className="field selectable" value={newStage} onChange={(e) => setNewStage(e.target.value)} disabled={stages.length === 0}>
                {stages.length === 0 ? <option value="">No stages</option> : null}
                {stages.map((s) => (
                  <option key={s.stageId} value={s.stageId}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" type="button" onClick={onAdd} disabled={busy || stages.length === 0}>
                <span className="ms">person_add</span>
                Add
              </button>
            </div>
          </div>

          <div className="card admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Test member</th>
                  <th>At</th>
                  <th>Move to</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow key={m.userId} m={m} stages={stages} busy={busy} onMove={onMove} />
                ))}
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="admin-empty-cell">No test members yet. Add one above.</td>
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

function MemberRow({
  m,
  stages,
  busy,
  onMove,
}: {
  m: TestMemberRow;
  stages: InjectableStage[];
  busy: boolean;
  onMove: (userId: string, stageId: string) => void;
}): JSX.Element {
  const [target, setTarget] = useState("");
  return (
    <tr>
      <td>
        <div className="admin-test-member">
          <span className="admin-test-dot" style={{ background: m.avatarColor ?? "var(--accent)" }} />
          <span className="admin-cell-title">{m.displayName ?? "Test"}</span>
          <span className="admin-pill muted">test</span>
        </div>
      </td>
      <td>{m.stageName ? <span className="admin-pill ok">{m.stageName}</span> : <span className="admin-muted">—</span>}</td>
      <td>
        <div className="admin-row-actions">
          <select className="field selectable admin-inline-select" value={target} onChange={(e) => setTarget(e.target.value)} disabled={stages.length === 0}>
            <option value="">Pick a stage…</option>
            {stages.map((s) => (
              <option key={s.stageId} value={s.stageId}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost admin-mini-btn" type="button" disabled={busy || !target} onClick={() => onMove(m.userId, target)}>
            Move
          </button>
        </div>
      </td>
    </tr>
  );
}

function describe(err: unknown): string {
  if (err instanceof AdminError) return `Request failed (${err.status}).`;
  return "Something went wrong.";
}
