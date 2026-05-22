import { Users } from "lucide-react";
import ChannelTile, { TILE_THEMES } from "@/components/hub/ChannelTile";
import type { HubData } from "@/lib/avatars/hub-data";

interface Props {
  avatarId: string;
  data: HubData["linkedin"];
}

export default function LinkedInTile({ avatarId, data }: Props) {
  const max = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <ChannelTile
      href={`/avatars/${avatarId}/linkedin`}
      theme={TILE_THEMES.linkedin}
      icon={<Users className="size-[18px]" />}
      name="LinkedIn"
      title="Connection journey"
      kicker={{
        value: data.reachable.toLocaleString("en-GB"),
        label: "reachable",
      }}
      bigNumber={
        <>
          {data.acceptanceRate}
          <span
            style={{
              fontSize: "0.5625em",
              opacity: 0.6,
              marginLeft: 4,
              fontVariantNumeric: "normal",
            }}
          >
            %
          </span>
        </>
      }
      bigSubtitle="connection acceptance rate"
      footStats={[
        {
          label: "Reply rate",
          value: (
            <span style={{ color: "#93C5FD" }}>{data.replyRate}%</span>
          ),
        },
        {
          label: "In motion",
          value: data.inMotion.toLocaleString("en-GB"),
        },
      ]}
      openLabel="Open LinkedIn"
    >
      {/* 4-row mini funnel */}
      <div className="relative z-[1] mb-3.5 flex flex-col items-start gap-[3px]">
        {data.funnel.map((step) => {
          const widthPx = Math.round((step.count / max) * 180);
          return (
            <div
              key={step.label}
              className="flex items-center gap-2.5 text-[11.5px]"
            >
              <span className="w-[86px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                {step.label}
              </span>
              <span
                className="h-2.5 rounded-[2px]"
                style={{
                  width: Math.max(widthPx, 2),
                  background: "linear-gradient(90deg, #60A5FA, #93C5FD)",
                }}
              />
              <span
                className="font-mono text-[11px] text-[var(--text-primary)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {step.count}
              </span>
            </div>
          );
        })}
      </div>
    </ChannelTile>
  );
}
