interface Props {
  avatarName: string;
  source: string;
  createdAt: string;
  totals: {
    contacted: number;
    replied: number;
    won: number;
  };
  leadCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const NUM_STYLE: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.015em",
};

export default function HubHero({
  avatarName,
  source,
  createdAt,
  totals,
  leadCount,
}: Props) {
  return (
    <header
      className="mb-7 flex items-end justify-between gap-8 border-b pb-8 pt-2"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="mb-2.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-soft)]">
          <span
            aria-hidden
            className="inline-block h-px w-[18px]"
            style={{ background: "var(--accent-primary)" }}
          />
          Avatar overview
        </p>
        <h1
          className="font-display text-[42px] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--text-primary)] text-balance m-0 mb-3"
        >
          {avatarName}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          {leadCount.toLocaleString("en-GB")} leads · {source} · {formatDate(createdAt)}
        </p>
      </div>

      <div className="grid grid-flow-col auto-cols-auto">
        <HubStat label="Contacted" value={totals.contacted} />
        <HubStat
          label="Replied"
          value={totals.replied}
          color="var(--accent-soft)"
        />
        <HubStat
          label="Won"
          value={totals.won}
          color="var(--status-success)"
        />
      </div>
    </header>
  );
}

function HubStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      className="px-7 first:pl-0 first:border-l-0 last:pr-0 border-l"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p
        className="font-display text-[32px] leading-none"
        style={{ ...NUM_STYLE, color: color ?? "var(--text-primary)" }}
      >
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}
