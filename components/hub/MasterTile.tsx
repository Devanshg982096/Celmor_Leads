import { Layers } from "lucide-react";
import ChannelTile, { TILE_THEMES } from "@/components/hub/ChannelTile";
import type { HubData } from "@/lib/avatars/hub-data";
import type { LeadStatus } from "@/lib/types";

const STATUS_COLOR: Record<LeadStatus, string> = {
  new: "var(--text-tertiary)",
  active: "var(--accent-primary)",
  won: "var(--status-success)",
  unqualified: "var(--text-quaternary)",
  dead: "var(--status-danger)",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  active: "Active",
  won: "Won",
  unqualified: "Unqualified",
  dead: "Dead",
};

interface Props {
  avatarId: string;
  total: number;
  data: HubData["master"];
}

export default function MasterTile({ avatarId, total, data }: Props) {
  const totalForBar =
    data.statusDistribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <ChannelTile
      href={`/avatars/${avatarId}/master`}
      theme={TILE_THEMES.master}
      icon={<Layers className="size-[18px]" />}
      name="Master"
      title="All leads, one surface"
      kicker={{ value: total.toLocaleString("en-GB"), label: "total imported" }}
      bigNumber={data.activeCount.toLocaleString("en-GB")}
      bigSubtitle="leads actively in motion"
      footStats={[
        {
          label: "Won",
          value: (
            <span style={{ color: "var(--status-success)" }}>
              {data.wonCount.toLocaleString("en-GB")}
            </span>
          ),
        },
        {
          label: "Owners",
          value: data.ownersCount.toLocaleString("en-GB"),
        },
      ]}
      openLabel="Open Master"
    >
      {/* Status distribution bar */}
      <div className="relative z-[1] mb-3.5 flex flex-col gap-1.5">
        <div
          className="flex h-1.5 overflow-hidden rounded-[3px]"
          style={{ background: "var(--bg-overlay)" }}
        >
          {data.statusDistribution.map((s) => (
            <span
              key={s.key}
              style={{
                width: `${(s.count / totalForBar) * 100}%`,
                background: STATUS_COLOR[s.key],
              }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[var(--text-secondary)]">
          {data.statusDistribution
            .filter((s) => s.count > 0)
            .map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block size-[7px] rounded-[2px]"
                  style={{ background: STATUS_COLOR[s.key] }}
                />
                <span>
                  {STATUS_LABEL[s.key]}{" "}
                  <span
                    className="font-mono text-[var(--text-primary)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {s.count}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      </div>
    </ChannelTile>
  );
}
