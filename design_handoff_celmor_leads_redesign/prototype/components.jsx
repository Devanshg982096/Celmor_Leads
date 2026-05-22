/* =====================================================
   Shared UI primitives for the Narada prototype.
   Exposed on window for cross-file use.
   ===================================================== */

const { useState, useMemo, useEffect, useRef } = React;

// ─── Icons (lucide-style inline SVG) ──────────────────────
function Icon({ name, size = 14, color = "currentColor", strokeWidth = 1.6, ...rest }) {
  const s = size;
  const p = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" {...p} /><path d="m20 20-3.5-3.5" {...p} /></>,
    plus: <><path d="M12 5v14M5 12h14" {...p} /></>,
    chevronRight: <path d="m9 6 6 6-6 6" {...p} />,
    chevronDown: <path d="m6 9 6 6 6-6" {...p} />,
    x: <><path d="M18 6 6 18M6 6l12 12" {...p} /></>,
    settings: <><circle cx="12" cy="12" r="3" {...p} /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" {...p} /></>,
    filter: <path d="M3 6h18M7 12h10M10 18h4" {...p} />,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" {...p} /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" {...p} /></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" {...p} /></>,
    arrowUpRight: <><path d="M7 17 17 7M7 7h10v10" {...p} /></>,
    moreHorizontal: <><circle cx="12" cy="12" r="1" {...p} /><circle cx="19" cy="12" r="1" {...p} /><circle cx="5" cy="12" r="1" {...p} /></>,
    panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2" {...p} /><path d="M9 3v18" {...p} /></>,
    linkedin: <><path d="M4 4h4v16H4zM10 9h3.5v2h.1c.5-1 1.7-2 3.4-2 3.6 0 4 2.4 4 5.5V20H17v-5.4c0-1.3 0-3-1.8-3s-2 1.4-2 2.9V20H10z" fill={color} stroke="none"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" {...p} /><path d="m3 7 9 6 9-6" {...p} /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.06.72 3.04a2 2 0 0 1-.45 2.11L8.09 10.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.98.35 1.99.59 3.04.72a2 2 0 0 1 1.72 2.02z" {...p} /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5z" {...p} /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" {...p} /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...p} /><circle cx="9" cy="7" r="4" {...p} /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...p} /></>,
    trendUp: <><path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" {...p} /></>,
    sparkles: <><path d="M12 3l1.9 5.1 5.1 1.9-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6L15.5 17.5l2.6-.9z" {...p} /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" {...p} /><rect x="14" y="3" width="7" height="7" rx="1" {...p} /><rect x="3" y="14" width="7" height="7" rx="1" {...p} /><rect x="14" y="14" width="7" height="7" rx="1" {...p} /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} /></>,
    triangle: <path d="M12 3 21 19H3z" fill={color} stroke={color} />,
    arrowUp: <path d="m12 19V5M5 12l7-7 7 7" {...p} />,
    arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" {...p} />,
  };
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true" style={{ flexShrink: 0, display: "block" }} {...rest}>
      {paths[name] || null}
    </svg>
  );
}

// ─── Narada logo mark (concentric arcs) ───────────────────
function NaradaMark({ size = 24 }) {
  const w = size * 1.6;
  const h = size;
  return (
    <svg viewBox="-30 -28 60 32" width={w} height={h} aria-hidden="true">
      <path d="M -25 0 A 25 25 0 0 1 25 0" stroke="var(--accent-soft)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
      <path d="M -17 0 A 17 17 0 0 1 17 0" stroke="var(--accent-hover)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M -9 0 A 9 9 0 0 1 9 0" stroke="var(--accent-primary)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <circle cx="0" cy="0" r="2" fill="var(--accent-primary)"/>
    </svg>
  );
}

// ─── User avatar bubble ───────────────────────────────────
function UserAvatar({ name, hue, size = 22 }) {
  const initials = useMemo(() => {
    const parts = (name || "").trim().split(/\s+/);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);
  const fontSize = Math.round(size * 0.4);
  return (
    <span className="user-avatar" style={{
      width: size, height: size, fontSize,
      background: hue !== undefined ? `hsl(${hue} 50% 38%)` : "var(--bg-elevated-2)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {initials}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────
function Badge({ children, kind = "neutral", sm = false }) {
  return (
    <span className={`badge ${kind} ${sm ? "sm" : ""}`}>
      <span className="ind"/>
      {children}
    </span>
  );
}

// ─── Sparkline ────────────────────────────────────────────
function Sparkline({ data, color = "var(--accent-primary)", width = 80, height = 28, fill = true }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="sparkline" preserveAspectRatio="none">
      {fill && <path d={areaPath} fill={color} opacity="0.15" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2" fill={color}/>
    </svg>
  );
}

// ─── Checkbox ─────────────────────────────────────────────
function Check({ checked, onChange, onClick }) {
  return (
    <span
      className={`checkbox ${checked ? "checked" : ""}`}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); onChange?.(!checked); }}
      role="checkbox" aria-checked={checked}
    />
  );
}

// ─── Drawer ───────────────────────────────────────────────
function Drawer({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        {children}
      </aside>
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────
function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.value}
          role="tab"
          className={`tab ${value === t.value ? "active" : ""}`}
          onClick={() => onChange(t.value)}>
          {t.icon ? <Icon name={t.icon} size={13}/> : null}
          {t.label}
          {t.count !== undefined ? <span className="mono" style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ─── Status label maps (mirroring lib/leads/labels.ts) ────
const LABELS = {
  email: {
    none: { label: "Not sent", kind: "outline" },
    smartlead_sent: { label: "Sent", kind: "info" },
    replied: { label: "Replied", kind: "success" },
    bounced: { label: "Bounced", kind: "danger" },
  },
  linkedin: {
    none: { label: "Not started", kind: "outline" },
    connection_sent: { label: "Connection Sent", kind: "neutral" },
    connection_accepted: { label: "Accepted", kind: "info" },
    first_message: { label: "1st Message", kind: "accent" },
    first_followup: { label: "1st Follow-up", kind: "accent" },
    second_followup: { label: "2nd Follow-up", kind: "accent" },
    third_followup: { label: "3rd Follow-up", kind: "accent" },
    dead: { label: "Dead", kind: "danger" },
  },
  call: {
    not_called: { label: "Not called", kind: "outline" },
    called: { label: "Called", kind: "info" },
    voicemail: { label: "Voicemail", kind: "warning" },
    reached: { label: "Reached", kind: "success" },
  },
  lead: {
    new: { label: "New", kind: "neutral" },
    active: { label: "Active", kind: "info" },
    unqualified: { label: "Unqualified", kind: "outline" },
    won: { label: "Won", kind: "success" },
    dead: { label: "Dead", kind: "danger" },
  },
};

function StatusBadge({ kind, value, sm }) {
  const l = LABELS[kind]?.[value];
  if (!l) return <Badge sm={sm} kind="outline">{value}</Badge>;
  return <Badge sm={sm} kind={l.kind}>{l.label}</Badge>;
}

// ─── Relative time (compact) ──────────────────────────────
function relTime(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtNum(n) {
  return n.toLocaleString("en-GB");
}

// Owner cell — clicking opens a popover (here just a non-functional stub for prototype)
function OwnerCell({ ownerId, profiles }) {
  if (!ownerId) {
    return <span className="cell-muted text-xs">Unassigned</span>;
  }
  const p = profiles.find((x) => x.id === ownerId);
  if (!p) return <span className="cell-muted">—</span>;
  return (
    <span className="owner-cell">
      <UserAvatar name={p.display_name} hue={p.hue} size={20}/>
      <span style={{ fontSize: 12.5 }}>{p.display_name.split(" ")[0]}</span>
    </span>
  );
}

// ─── Export to global ─────────────────────────────────────
Object.assign(window, {
  Icon, NaradaMark, UserAvatar, Badge, Sparkline, Check, Drawer, Tabs,
  StatusBadge, LABELS, relTime, fmtDate, fmtNum, OwnerCell,
});
