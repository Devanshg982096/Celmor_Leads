import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import Sparkline from "@/components/charts/Sparkline";
import { hueFromId } from "@/components/ui/UserAvatarBubble";
import type { AvatarWithStats } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function hueOf(ownerId: string | null): number {
  // Unassigned uses a neutral grey hue (handled separately in the bar).
  return ownerId ? hueFromId(ownerId) : 0;
}

export default function AvatarCard({ avatar }: { avatar: AvatarWithStats }) {
  const total = avatar.total_leads;
  const replyRate =
    avatar.contacted > 0
      ? Math.round((avatar.replied / avatar.contacted) * 100)
      : 0;

  return (
    <Link
      href={`/avatars/${avatar.id}`}
      className="group block focus:outline-none"
    >
      <article
        className="relative flex flex-col gap-[14px] rounded-lg border bg-[var(--bg-elevated)] p-[18px] transition-[border-color,background,transform] duration-[180ms] group-hover:border-[var(--border-default)] group-hover:bg-[var(--bg-elevated-2)] group-hover:-translate-y-px"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {/* ── Head row ───────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold leading-tight text-[var(--text-primary)] truncate">
              {avatar.name}
            </h3>
            <p className="mt-[2px] text-[11.5px] text-[var(--text-tertiary)]">
              {avatar.source} · {formatDate(avatar.created_at)}
            </p>
          </div>
          {avatar.owner_split.length > 0 && (
            <Badge variant="neutral" size="sm" dot>
              {avatar.owner_split.length}{" "}
              {avatar.owner_split.length === 1 ? "owner" : "owners"}
            </Badge>
          )}
        </header>

        {/* ── Numbers row: big total + right-aligned sparkline ────────────── */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div
              className="font-display text-[36px] leading-none"
              style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {total.toLocaleString("en-GB")}
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Total leads
            </p>
          </div>
          <div className="opacity-90">
            <Sparkline
              data={avatar.weekly_activity}
              width={92}
              height={34}
              color="var(--accent-soft)"
            />
          </div>
        </div>

        {/* ── Metrics row: Contacted / Replied / Won ─────────────────────── */}
        <dl className="flex gap-[14px]">
          <Metric label="Contacted" value={avatar.contacted} />
          <Metric
            label="Replied"
            value={avatar.replied}
            inlineExtra={
              avatar.contacted > 0 ? (
                <span className="ml-1.5 text-[var(--status-success)]">
                  {replyRate}%
                </span>
              ) : null
            }
          />
          <Metric label="Won" value={avatar.won} />
        </dl>

        {/* ── Owner split bar + legend ───────────────────────────────────── */}
        {total > 0 && avatar.owner_split.length > 0 && (
          <div className="flex flex-col gap-2">
            <div
              className="flex h-[3px] overflow-hidden rounded-[2px]"
              style={{ background: "var(--bg-overlay)" }}
            >
              {avatar.owner_split.map((s) => {
                const pct = (s.count / total) * 100;
                const bg = s.owner_id
                  ? `hsl(${hueOf(s.owner_id)} 50% 50%)`
                  : "var(--text-quaternary)";
                return (
                  <span
                    key={s.owner_id ?? "unassigned"}
                    style={{ width: `${pct}%`, background: bg }}
                  />
                );
              })}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
              {avatar.owner_split.map((s) => (
                <li
                  key={s.owner_id ?? "unassigned"}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="inline-block size-[7px] rounded-[2px]"
                    style={{
                      background: s.owner_id
                        ? `hsl(${hueOf(s.owner_id)} 50% 50%)`
                        : "var(--text-quaternary)",
                    }}
                    aria-hidden
                  />
                  <span>
                    {s.display_name} ·{" "}
                    <span
                      className="font-mono text-[var(--text-primary)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {s.count.toLocaleString("en-GB")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </Link>
  );
}

function Metric({
  label,
  value,
  inlineExtra,
}: {
  label: string;
  value: number;
  inlineExtra?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-[2px] text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="text-[14px] font-medium text-[var(--text-primary)]">
        <span
          className="font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value.toLocaleString("en-GB")}
        </span>
        {inlineExtra}
      </dd>
    </div>
  );
}
