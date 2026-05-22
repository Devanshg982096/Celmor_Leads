import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types";

interface Props {
  members: Profile[];
  currentUserId: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function WorkspaceSection({ members, currentUserId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Celmor team members with access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
            Workspace
          </p>
          <p className="text-sm text-[var(--text-primary)]">Celmor</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Members ({members.length})
          </p>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {members.map((m) => {
              const isYou = m.id === currentUserId;
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: `hsl(${hueFromId(m.id)} 60% 45%)` }}
                    aria-hidden
                  >
                    {initialsOf(m.display_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {m.display_name}
                      {isYou && (
                        <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">{m.email}</p>
                  </div>
                  <Badge variant="secondary">Member</Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
