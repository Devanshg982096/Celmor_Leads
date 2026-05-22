import { cn } from "@/lib/utils";

interface Props {
  /** Display name (e.g. "Devansh Gupta"). Initials are derived from it. */
  name: string;
  /** Stable user id used to pick a deterministic hue. */
  id: string;
  size?: number;
  className?: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Deterministic initials avatar — same `id` always picks the same hue.
 * Used in the sidebar, settings page, table owner cells, etc.
 */
export default function UserAvatarBubble({
  name,
  id,
  size = 26,
  className,
}: Props) {
  const fontSize = Math.max(9, Math.round(size * 0.4));
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize,
        background: `hsl(${hueFromId(id)} 50% 38%)`,
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
