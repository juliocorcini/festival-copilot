/** Shared bits for the squad shared-timetable screens (#24): avatars, status pill, block summary. */
import { initialsOf } from "../../data/identity";
import { readableInkOn } from "../../lib/contrast";
import { useT, type TranslateFn } from "../../i18n";
import type { SquadBlock, SquadMember } from "../../domain/squadPlan";

const FALLBACK_COLOR = "#6B7280";

export function MemberAvatar({
  member,
  size = 28,
  ring = true,
}: {
  member: SquadMember;
  size?: number;
  ring?: boolean;
}): JSX.Element {
  const color = member.avatarColor ?? FALLBACK_COLOR;
  return (
    <span
      className="ava squad-ava"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: readableInkOn(color),
        boxShadow: ring ? "0 0 0 2px var(--bg)" : undefined,
      }}
    >
      {initialsOf(member.displayName)}
    </span>
  );
}

/** Overlapping avatar stack with a "+N" overflow tile. */
export function AvatarStack({
  members,
  max = 4,
  size = 28,
}: {
  members: SquadMember[];
  max?: number;
  size?: number;
}): JSX.Element {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="ava-stack">
      {shown.map((m) => (
        <MemberAvatar key={m.userId} member={m} size={size} />
      ))}
      {extra > 0 && (
        <span
          className="ava squad-ava squad-ava-more"
          style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/** "5 of 7 going" when you're with the squad; "4 going · 2 split" when it's contested. */
export function blockSummary(block: SquadBlock, memberCount: number, t: TranslateFn): string {
  const stage = block.set.stageName;
  if (block.splitCount > 0 && block.youStatus !== "following")
    return t("squad.sumGoingSplit", { stage, going: block.goingCount, split: block.splitCount });
  return t("squad.sumGoingOf", { stage, going: block.goingCount, total: memberCount });
}

/** The right-hand status pill on a block (Following / Your own / locked-conflict). */
export function StatusPill({ block }: { block: SquadBlock }): JSX.Element | null {
  const t = useT();
  if (block.youStatus === "following")
    return (
      <span className="pill follow">
        <span className="ms" style={{ fontSize: 12 }}>
          check
        </span>
        {t("squad.following")}
      </span>
    );
  if (block.youStatus === "own") return <span className="pill own">{t("squad.yourOwn")}</span>;
  if (block.youStatus === "conflict")
    return (
      <span className="pill warn">
        <span className="ms" style={{ fontSize: 12 }}>
          lock
        </span>
        {t("squad.youAt", { label: block.yourLock?.label ?? t("squad.elsewhere") })}
      </span>
    );
  return null;
}

/** The method badge label used in the block detail ("plurality 4 of 7", "owner pick", …). */
export function methodLabel(block: SquadBlock, memberCount: number, t: TranslateFn): string {
  switch (block.method) {
    case "owner":
      return block.pinned
        ? t("squad.methodOwnerPin")
        : t("squad.methodOwner", { going: block.goingCount, total: memberCount });
    case "favorited":
      return t("squad.methodFav", { going: block.goingCount, total: memberCount });
    default:
      return t("squad.methodPlurality", { going: block.goingCount, total: memberCount });
  }
}
