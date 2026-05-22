import { Phone } from "lucide-react";
import ChannelTile, { TILE_THEMES } from "@/components/hub/ChannelTile";
import type { HubData } from "@/lib/avatars/hub-data";

interface Props {
  avatarId: string;
  data: HubData["calls"];
}

export default function CallsTile({ avatarId, data }: Props) {
  return (
    <ChannelTile
      href={`/avatars/${avatarId}/calls`}
      theme={TILE_THEMES.calls}
      icon={<Phone className="size-[18px]" />}
      name="Calls"
      title="Today's priority queue"
      kicker={{
        value: data.dialable.toLocaleString("en-GB"),
        label: "dialable",
      }}
      bigNumber={data.pending.toLocaleString("en-GB")}
      bigSubtitle={`leads in queue · ${data.reachRate}% reach rate`}
      footStats={[
        {
          label: "Reached",
          value: (
            <span style={{ color: "var(--status-success)" }}>
              {data.reached.toLocaleString("en-GB")}
            </span>
          ),
        },
        ...(data.bestWindow
          ? [{ label: "Best window", value: data.bestWindow }]
          : []),
      ]}
      openLabel="Open Calls"
    >
      {/* Priority queue rows */}
      <div className="relative z-[1] mb-3.5 flex flex-col gap-1.5">
        {data.priorityQueue.length === 0 ? (
          <p className="text-[12px] text-[var(--text-tertiary)] py-2">
            No pending calls in queue.
          </p>
        ) : (
          data.priorityQueue.map((lead, i) => (
            <div
              key={lead.id}
              className="flex items-center gap-2.5 rounded-md border px-2.5 py-[7px] text-[12px]"
              style={{
                background: "var(--bg-elevated-2)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <span
                aria-hidden
                className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: "rgba(251, 191, 36, 0.14)",
                  color: "#FCD34D",
                }}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate font-medium text-[var(--text-primary)]">
                {lead.name}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] truncate max-w-[40%]">
                {lead.company ?? "—"}
              </span>
            </div>
          ))
        )}
      </div>
    </ChannelTile>
  );
}
