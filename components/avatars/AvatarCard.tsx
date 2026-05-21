import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { AvatarWithStats } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AvatarCard({ avatar }: { avatar: AvatarWithStats }) {
  const splitText =
    avatar.owner_split.length === 0
      ? "No leads"
      : avatar.owner_split
          .map((s) => `${s.display_name}: ${s.count.toLocaleString()}`)
          .join(" · ");

  return (
    <Link href={`/avatars/${avatar.id}`} className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:shadow-md">
        <CardContent className="p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight">{avatar.name}</h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(avatar.created_at)}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {avatar.total_leads.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">leads</span>
          </div>

          <p className="text-xs text-muted-foreground">{splitText}</p>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{avatar.contacted}</span> contacted
            </span>
            <span>·</span>
            <span>
              <span className="font-medium text-foreground">{avatar.replied}</span> replied
            </span>
            <span>·</span>
            <span>
              <span className="font-medium text-foreground">{avatar.won}</span> won
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
