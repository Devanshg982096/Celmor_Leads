interface Props {
  /** Time-ordered numeric series. Empty / all-zero arrays render a flat line. */
  data: number[];
  width?: number;
  height?: number;
  /** Stroke + end-dot colour. Use a CSS variable or hex. */
  color?: string;
  /** Render the filled area underneath the line. */
  fill?: boolean;
  /** Render the end-dot circle. */
  endDot?: boolean;
  className?: string;
}

/**
 * Lightweight inline-SVG sparkline. No tooltip, no axis — purely for
 * giving a metric a sense of momentum at a glance.
 *
 * If the data series has no variation (all zeros or single point), renders
 * a baseline so the cell isn't visually empty.
 */
export default function Sparkline({
  data,
  width = 92,
  height = 34,
  color = "var(--accent-primary)",
  fill = true,
  endDot = true,
  className,
}: Props) {
  const pad = 2;
  const usableW = width;
  const usableH = height - pad * 2;

  // Empty or all-zero series → flat baseline
  const hasVariation = data.length > 1 && Math.max(...data) > 0;
  if (!hasVariation) {
    const y = height - pad;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="0"
          y1={y}
          x2={width}
          y2={y}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * usableW;
    const y = height - pad - ((v - min) / range) * usableH;
    return [x, y] as const;
  });
  const path = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && (
        <path
          d={`${path} L${width},${height} L0,${height} Z`}
          fill={color}
          opacity="0.15"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot && <circle cx={last[0]} cy={last[1]} r="2" fill={color} />}
    </svg>
  );
}
