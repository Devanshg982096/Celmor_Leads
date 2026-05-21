import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";
type Variant = "full" | "icon-only";

interface Props {
  size?: Size;
  variant?: Variant;
  className?: string;
  /** Accessible label; pass `null` to hide from screen readers. */
  label?: string | null;
}

interface SizeSpec {
  markWidth: number;
  markHeight: number;
  wordSize: number;
  gap: number;
  /** Stroke widths (inner, middle, outer) */
  stroke: [number, number, number];
  /** Radii (inner arc, middle arc, outer arc) */
  radii: [number, number, number];
  /** Center-dot radius */
  dotR: number;
}

const SPEC: Record<Size, SizeSpec> = {
  lg: {
    markWidth: 116,
    markHeight: 60,
    wordSize: 44,
    gap: 18,
    stroke: [3, 2.5, 2],
    radii: [22, 40, 58],
    dotR: 4,
  },
  md: {
    markWidth: 72,
    markHeight: 36,
    wordSize: 26,
    gap: 12,
    stroke: [2, 1.8, 1.4],
    radii: [14, 25, 35.5],
    dotR: 2.5,
  },
  sm: {
    markWidth: 48,
    markHeight: 24,
    wordSize: 18,
    gap: 10,
    stroke: [1.6, 1.4, 1.2],
    radii: [9, 16.5, 23.5],
    dotR: 2,
  },
};

function Mark({ spec }: { spec: SizeSpec }) {
  const [rInner, rMid, rOuter] = spec.radii;
  const [sInner, sMid, sOuter] = spec.stroke;
  // viewBox: x from -rOuter-padding to +rOuter+padding;
  // y from -rOuter-padding to dotR+padding (arc sweeps upward from y=0).
  const padding = Math.max(sOuter, 2);
  const x0 = -rOuter - padding;
  const w = 2 * (rOuter + padding);
  const y0 = -rOuter - padding;
  const h = rOuter + padding + spec.dotR + padding;

  return (
    <svg
      viewBox={`${x0} ${y0} ${w} ${h}`}
      width={spec.markWidth}
      height={spec.markHeight}
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={`M ${-rOuter} 0 A ${rOuter} ${rOuter} 0 0 1 ${rOuter} 0`}
        stroke="var(--accent-soft)"
        strokeWidth={sOuter}
        strokeLinecap="round"
      />
      <path
        d={`M ${-rMid} 0 A ${rMid} ${rMid} 0 0 1 ${rMid} 0`}
        stroke="var(--accent-hover)"
        strokeWidth={sMid}
        strokeLinecap="round"
      />
      <path
        d={`M ${-rInner} 0 A ${rInner} ${rInner} 0 0 1 ${rInner} 0`}
        stroke="var(--accent-primary)"
        strokeWidth={sInner}
        strokeLinecap="round"
      />
      <circle cx="0" cy="0" r={spec.dotR} fill="var(--accent-primary)" />
    </svg>
  );
}

export default function NaradaLogo({
  size = "md",
  variant = "full",
  className,
  label = "Narada",
}: Props) {
  const spec = SPEC[size];

  if (variant === "icon-only") {
    return (
      <span
        className={cn("inline-flex items-center", className)}
        role={label ? "img" : undefined}
        aria-label={label ?? undefined}
      >
        <Mark spec={spec} />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center", className)}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      style={{ gap: spec.gap }}
    >
      <Mark spec={spec} />
      <span
        style={{
          fontFamily: "var(--font-questrial), system-ui, sans-serif",
          fontSize: spec.wordSize,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          color: "var(--text-primary)",
          // Align the wordmark roughly to the x-height baseline of the mark
          // (the mark's "ground line" is the center dot — y=0 in our viewBox).
          transform: "translateY(0.04em)",
        }}
      >
        narada
      </span>
    </span>
  );
}
