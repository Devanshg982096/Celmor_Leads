import { Mail } from "lucide-react";
import ChannelTile, { TILE_THEMES } from "@/components/hub/ChannelTile";
import type { HubData } from "@/lib/avatars/hub-data";

interface Props {
  avatarId: string;
  data: HubData["emails"];
}

export default function EmailsTile({ avatarId, data }: Props) {
  const days = data.histogram.sent.length;
  // Per-column total drives bar heights.
  const columnTotals = Array.from({ length: days }, (_, i) =>
    data.histogram.sent[i] + data.histogram.replied[i] + data.histogram.bounced[i],
  );
  const maxCol = Math.max(...columnTotals, 1);
  const usableHeight = 50; // px

  return (
    <ChannelTile
      href={`/avatars/${avatarId}/emails`}
      theme={TILE_THEMES.emails}
      icon={<Mail className="size-[18px]" />}
      name="Emails"
      title="14-day send & reply pulse"
      kicker={{
        value: data.emailable.toLocaleString("en-GB"),
        label: "emailable",
      }}
      bigNumber={
        <>
          {data.replyRate}
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
      bigSubtitle={`reply rate · ${data.replied} of ${data.sent}`}
      footStats={[
        {
          label: "Sent",
          value: data.sent.toLocaleString("en-GB"),
        },
        {
          label: "Bounced",
          value: (
            <span style={{ color: "var(--status-danger)" }}>
              {data.bounced.toLocaleString("en-GB")}
            </span>
          ),
        },
      ]}
      openLabel="Open Emails"
    >
      {/* 14-day mini histogram */}
      <div className="relative z-[1] mb-2 flex flex-col gap-1">
        <div className="flex h-14 items-end gap-[3px]">
          {columnTotals.map((tot, i) => {
            // Below the bar columns, scale each segment.
            const s = data.histogram.sent[i];
            const r = data.histogram.replied[i];
            const b = data.histogram.bounced[i];
            const sH = (s / maxCol) * usableHeight;
            const rH = (r / maxCol) * usableHeight;
            const bH = (b / maxCol) * usableHeight;
            if (tot === 0) {
              return (
                <span
                  key={i}
                  aria-hidden
                  className="flex-1 self-end rounded-[1px]"
                  style={{
                    height: 2,
                    background: "var(--border-subtle)",
                  }}
                />
              );
            }
            return (
              <span
                key={i}
                className="flex flex-1 flex-col-reverse gap-[1px] min-w-0"
              >
                {sH > 0 && (
                  <span
                    style={{
                      height: sH,
                      minHeight: 2,
                      background: "rgba(52,211,153,0.18)",
                      borderRadius: 1,
                    }}
                  />
                )}
                {rH > 0 && (
                  <span
                    style={{
                      height: rH,
                      minHeight: 2,
                      background: "#34D399",
                      borderRadius: 1,
                    }}
                  />
                )}
                {bH > 0 && (
                  <span
                    style={{
                      height: bH,
                      minHeight: 2,
                      background: "var(--status-danger)",
                      borderRadius: 1,
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>14d ago</span>
          <span>today</span>
        </div>
      </div>
    </ChannelTile>
  );
}
