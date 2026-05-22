/* =====================================================
   Pivot screens (Direction B: same data, new mental models).
   ===================================================== */

const { useState: useStateP, useMemo: useMemoP } = React;

// ─── Pivot: Avatars Index (portfolio hero cards) ──────────
function AvatarsIndexPivot({ onOpenAvatar }) {
  const { AVATARS } = window.NARADA_DATA;
  const totalLeads = AVATARS.reduce((a, x) => a + x.total_leads, 0);
  const totalReplied = AVATARS.reduce((a, x) => a + x.replied, 0);
  const totalContacted = AVATARS.reduce((a, x) => a + x.contacted, 0);
  const totalWon = AVATARS.reduce((a, x) => a + x.won, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row gap-2" style={{ marginBottom: 6 }}>
            <span className="badge accent sm"><span className="ind"/>Portfolio</span>
            <span className="text-xs muted">{AVATARS.length} avatars · last sync 2h ago</span>
          </div>
          <h1>Pipeline at a glance</h1>
          <p>{fmtNum(totalLeads)} leads in flight across {AVATARS.length} target personas.</p>
        </div>
        <div className="row gap-2">
          <button className="btn ghost"><Icon name="sparkles" size={14}/>Suggest avatar</button>
          <button className="btn primary"><Icon name="plus" size={14}/>New avatar</button>
        </div>
      </div>

      {/* Portfolio KPI strip */}
      <div className="kpi-grid">
        <KPI label="Leads in flight" value={fmtNum(totalLeads)} hint="across all avatars" spark={[10, 14, 13, 18, 22, 26, 24, 28, 32, 30, 36, 41]}/>
        <KPI label="Contacted" value={fmtNum(totalContacted)} hint={`${Math.round(totalContacted / totalLeads * 100)}%`}/>
        <KPI label="Replied" value={fmtNum(totalReplied)} delta={{ dir: "up", text: "+12% wow" }}/>
        <KPI label="Won" value={fmtNum(totalWon)} delta={{ dir: "up", text: "+3 this wk" }}/>
        <KPI label="Best performer" value="CMOs · DTC" hint={`${Math.round(184/1550*100)}% reply rate`}/>
      </div>

      <div className="avatar-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
        {AVATARS.map((a) => {
          const replyRate = a.contacted ? Math.round((a.replied / a.contacted) * 100) : 0;
          const wonRate = a.contacted ? Math.round((a.won / a.contacted) * 100) : 0;
          const cContacted = (a.contacted / a.total_leads) * 100;
          const cReplied = (a.replied / a.total_leads) * 100;
          const cWon = (a.won / a.total_leads) * 100;
          const isTop = replyRate >= 13;
          return (
            <div key={a.id} className="av-pivot" onClick={() => onOpenAvatar(a.id)}>
              <div className="row between" style={{ position: "relative", zIndex: 1 }}>
                <div className="av-pivot-tag">
                  {isTop ? "Top performer" : a.replied > 50 ? "Active" : a.contacted < a.total_leads * 0.2 ? "Untapped" : "Steady"}
                </div>
                <Icon name="arrowUpRight" size={16} color="var(--text-tertiary)"/>
              </div>
              <h3 className="av-pivot-title">{a.name}</h3>

              <div className="av-pivot-hero">
                <span className="av-pivot-bignum">{fmtNum(a.total_leads)}</span>
                <span className="av-pivot-sub">leads · {fmtDate(a.created_at)}</span>
              </div>

              <div className="av-pivot-split">
                <span style={{ width: `${cWon}%`, background: "var(--status-success)" }}/>
                <span style={{ width: `${cReplied}%`, background: "var(--accent-primary)" }}/>
                <span style={{ width: `${cContacted - cReplied - cWon}%`, background: "var(--accent-subtle)" }}/>
                <span style={{ width: `${100 - cContacted}%`, background: "var(--bg-overlay)" }}/>
              </div>
              <div className="av-pivot-split-legend">
                <span><span className="dot" style={{ background: "var(--status-success)" }}/>Won <span className="mono">{fmtNum(a.won)}</span></span>
                <span><span className="dot" style={{ background: "var(--accent-primary)" }}/>Replied <span className="mono">{fmtNum(a.replied)}</span></span>
                <span><span className="dot" style={{ background: "var(--accent-subtle)" }}/>Contacted <span className="mono">{fmtNum(a.contacted)}</span></span>
                <span><span className="dot" style={{ background: "var(--bg-overlay)" }}/>Cold <span className="mono">{fmtNum(a.total_leads - a.contacted)}</span></span>
              </div>

              <div className="av-pivot-foot">
                <div>
                  <div className="lbl">Reply rate</div>
                  <div className="val" style={{ color: replyRate >= 12 ? "var(--status-success)" : "var(--text-primary)" }}>{replyRate}%</div>
                </div>
                <div>
                  <div className="lbl">Win rate</div>
                  <div className="val">{wonRate < 1 ? "<1%" : `${wonRate}%`}</div>
                </div>
                <div>
                  <div className="lbl">12-wk trend</div>
                  <div style={{ marginTop: -4 }}>
                    <Sparkline data={a.spark} width={90} height={28}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Pivot: Master leads as Kanban ────────────────────────
function MasterPivot({ avatar, leads, profiles, onOpenLead }) {
  // Kanban by lead_status with quick lane summary
  const lanes = [
    { id: "new", label: "New", color: "var(--text-tertiary)" },
    { id: "active", label: "Active", color: "var(--status-info)" },
    { id: "won", label: "Won", color: "var(--status-success)" },
    { id: "unqualified", label: "Unqualified", color: "var(--text-tertiary)" },
    { id: "dead", label: "Dead", color: "var(--status-danger)" },
  ];

  const byLane = lanes.reduce((acc, lane) => {
    acc[lane.id] = leads.filter((l) => l.lead_status === lane.id);
    return acc;
  }, {});

  const totalActive = leads.filter((l) => l.lead_status === "active").length;
  const totalWon = leads.filter((l) => l.lead_status === "won").length;
  const replied = leads.filter((l) => l.email_status === "replied").length;

  const [view, setView] = useStateP("kanban");

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Total leads" value={fmtNum(leads.length)} hint="all imported"/>
        <KPI label="In motion" value={fmtNum(totalActive)} delta={{ dir: "up", text: "+24 this wk" }}/>
        <KPI label="Replied" value={fmtNum(replied)} delta={{ dir: "up", text: "+5 today" }}/>
        <KPI label="Won" value={fmtNum(totalWon)} delta={{ dir: "flat", text: "vs last wk" }}/>
        <KPI label="Avg cycle" value="18d" hint="touch to reply"/>
      </div>

      <div className="row between mb-4">
        <Tabs value={view} onChange={setView} items={[
          { value: "kanban", label: "Stages", icon: "layers" },
          { value: "table", label: "Table", icon: "list" },
        ]}/>
        <div className="row gap-2">
          <button className="chip"><Icon name="sparkles" size={12}/>Suggest who to call</button>
          <button className="chip">Owner: all</button>
          <button className="btn secondary sm"><Icon name="filter" size={12}/>Filter</button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="kanban">
          {lanes.map((lane) => {
            const items = byLane[lane.id] || [];
            return (
              <div key={lane.id} className="kb-col">
                <div className="kb-col-head">
                  <div className="l">
                    <span className="ind" style={{ background: lane.color }}/>
                    <h3>{lane.label}</h3>
                  </div>
                  <span className="count">{fmtNum(items.length)}</span>
                </div>
                <div className="kb-col-body">
                  {items.slice(0, 8).map((l) => (
                    <div key={l.id} className="kb-card" onClick={() => onOpenLead(l.id)}>
                      <div className="name">{l.name}</div>
                      <div className="meta">{l.title} · {l.company}</div>
                      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                        {l.email_status !== "none" && <StatusBadge sm kind="email" value={l.email_status}/>}
                        {l.linkedin_stage !== "none" && <StatusBadge sm kind="linkedin" value={l.linkedin_stage}/>}
                        {l.call_status !== "not_called" && <StatusBadge sm kind="call" value={l.call_status}/>}
                      </div>
                      <div className="kb-card-foot" style={{ marginTop: 10 }}>
                        <OwnerCell ownerId={l.owner_id} profiles={profiles}/>
                        <span className="since">{relTime(l.lead_status_updated_at)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length > 8 && (
                    <button className="btn ghost sm" style={{ width: "100%", justifyContent: "center", color: "var(--text-tertiary)" }}>
                      Show {items.length - 8} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap density-cozy">
          <div style={{ overflow: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th><th>Company</th><th>Owner</th><th>Status</th><th>Last touch</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 14).map((l) => (
                  <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                    <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                    <td>{l.company}</td>
                    <td><OwnerCell ownerId={l.owner_id} profiles={profiles}/></td>
                    <td><StatusBadge sm kind="lead" value={l.lead_status}/></td>
                    <td className="muted mono text-xs">{relTime(l.lead_status_updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Pivot: LinkedIn — Sankey-style flow ──────────────────
function LinkedInPivot({ avatar, leads, profiles, onOpenLead }) {
  const qualified = leads.filter((l) => l.qualified === "qualified" && l.linkedin_url);
  const stages = ["connection_sent","connection_accepted","first_message","first_followup","second_followup","third_followup"];

  // Cumulative funnel — "reached at least this stage"
  const cum = {
    sent: qualified.filter(l => l.linkedin_stage !== "none").length,
    accepted: qualified.filter(l => ["connection_accepted","first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
    msg1: qualified.filter(l => ["first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
    f1: qualified.filter(l => ["first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
    f2: qualified.filter(l => ["second_followup","third_followup"].includes(l.linkedin_stage)).length,
    f3: qualified.filter(l => l.linkedin_stage === "third_followup").length,
    dead: qualified.filter(l => l.linkedin_stage === "dead").length,
  };
  const max = Math.max(...Object.values(cum));

  const stageDefs = [
    { id: "sent", label: "Sent" },
    { id: "accepted", label: "Accepted" },
    { id: "msg1", label: "Messaged" },
    { id: "f1", label: "Follow-up 1" },
    { id: "f2", label: "Follow-up 2" },
    { id: "f3", label: "Follow-up 3" },
    { id: "dead", label: "Dead", dead: true },
  ];

  // Stage filter
  const [stageFilter, setStageFilter] = useStateP("all");
  const visible = qualified.filter((l) => stageFilter === "all" || l.linkedin_stage === stageFilter).slice(0, 12);

  // For Sankey bars — use sqrt scaling for visibility
  function barH(v) { return Math.max(6, (v / max) * 180); }

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Reachable" value={fmtNum(qualified.length)} hint="have LinkedIn"/>
        <KPI label="Sent" value={fmtNum(cum.sent)} hint={`${Math.round(cum.sent/qualified.length*100)}%`}/>
        <KPI label="Acceptance" value={`${Math.round(cum.accepted/Math.max(cum.sent,1)*100)}%`} delta={{ dir: "up", text: "+3pp" }}/>
        <KPI label="Reply rate" value={`${Math.round(cum.f1/Math.max(cum.msg1,1)*100)}%`} hint={`${fmtNum(cum.f1)} of ${fmtNum(cum.msg1)}`}/>
      </div>

      <div className="flow">
        <div className="flow-head">
          <h2>Outreach flow</h2>
          <div className="row gap-2">
            <span className="text-xs muted">Bar height = leads at each stage</span>
            <button className="chip"><Icon name="download" size={12}/>Export</button>
          </div>
        </div>
        <div className="flow-canvas">
          {/* SVG ribbon behind bars */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="ribbon" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(99,102,241,0.35)"/>
                <stop offset="100%" stopColor="rgba(99,102,241,0.08)"/>
              </linearGradient>
            </defs>
            {stageDefs.slice(0, -1).map((s, i) => {
              const next = stageDefs[i + 1];
              const v1 = cum[s.id], v2 = cum[next.id];
              const x1 = (i + 0.5) / stageDefs.length * 100;
              const x2 = (i + 1.5) / stageDefs.length * 100;
              const h1 = (v1 / max) * 180;
              const h2 = (v2 / max) * 180;
              const ymid = 110;
              const top1 = ymid - h1 / 2;
              const bot1 = ymid + h1 / 2;
              const top2 = ymid - h2 / 2;
              const bot2 = ymid + h2 / 2;
              const cx = (x1 + x2) / 2;
              return (
                <path key={s.id}
                  d={`M ${x1}% ${top1} C ${cx}% ${top1}, ${cx}% ${top2}, ${x2}% ${top2} L ${x2}% ${bot2} C ${cx}% ${bot2}, ${cx}% ${bot1}, ${x1}% ${bot1} Z`}
                  fill="url(#ribbon)"
                  opacity={next.dead ? 0.3 : 0.7}
                />
              );
            })}
          </svg>
          {stageDefs.map((s, i) => {
            const v = cum[s.id];
            const h = barH(v);
            const prev = i === 0 ? null : cum[stageDefs[i - 1].id];
            const conv = prev != null && prev > 0 ? Math.round((v / prev) * 100) : null;
            return (
              <div key={s.id} className="flow-stage">
                <div className="flow-stage-num">{fmtNum(v)}</div>
                <div className={`flow-bar ${s.dead ? "dead" : ""}`} style={{ height: h }}>
                  {conv !== null && i < stageDefs.length - 1 && (
                    <span className="flow-conv">{conv}%</span>
                  )}
                </div>
                <div className="flow-stage-lbl">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="row between mb-3">
        <div className="chip-row">
          <button className={`chip ${stageFilter === "all" ? "active" : ""}`} onClick={() => setStageFilter("all")}>
            All stages <span className="count">{fmtNum(qualified.length)}</span>
          </button>
          {stages.map((s) => {
            const count = qualified.filter((l) => l.linkedin_stage === s).length;
            return (
              <button key={s} className={`chip ${stageFilter === s ? "active" : ""}`} onClick={() => setStageFilter(s)}>
                {LABELS.linkedin[s].label} <span className="count">{fmtNum(count)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="table-wrap density-cozy">
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th><th>Company</th><th>Stage</th><th>Profile</th><th>Days since</th><th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                  <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                  <td>{l.company}</td>
                  <td><StatusBadge sm kind="linkedin" value={l.linkedin_stage}/></td>
                  <td><a className="cell-link row gap-2" onClick={(e) => e.stopPropagation()}><Icon name="linkedin" size={12}/>Open <Icon name="arrowUpRight" size={11}/></a></td>
                  <td className="muted mono text-xs">{l.linkedin_stage === "none" ? "—" : relTime(l.linkedin_stage_updated_at)}</td>
                  <td><OwnerCell ownerId={l.owner_id} profiles={profiles}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Pivot: Emails — sequence timeline + sends/replies pulse ──
function EmailsPivot({ leads, profiles, onOpenLead }) {
  const qualified = leads.filter((l) => l.qualified === "qualified");
  const sent = qualified.filter((l) => l.email_status !== "none").length;
  const replied = qualified.filter((l) => l.email_status === "replied").length;
  const bounced = qualified.filter((l) => l.email_status === "bounced").length;

  // Build a 14-day activity heatmap
  const days = 14;
  const series = Array.from({ length: days }, (_, i) => {
    const dayLeads = qualified.filter((l) => {
      const t = l.email_status_updated_at ? new Date(l.email_status_updated_at).getTime() : 0;
      const daysAgo = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
      return daysAgo === days - 1 - i;
    });
    return {
      sent: dayLeads.filter((l) => l.email_status === "smartlead_sent").length,
      replied: dayLeads.filter((l) => l.email_status === "replied").length,
      bounced: dayLeads.filter((l) => l.email_status === "bounced").length,
    };
  });
  const maxBar = Math.max(...series.map((s) => s.sent + s.replied + s.bounced), 1);

  // Recent replies
  const recentReplies = qualified.filter((l) => l.email_status === "replied").slice(0, 6);

  const visible = qualified.slice(0, 10);

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Emailable" value={fmtNum(qualified.length)}/>
        <KPI label="Sent" value={fmtNum(sent)} delta={{ dir: "up", text: "+128 today" }}/>
        <KPI label="Reply rate" value={`${Math.round(replied/Math.max(sent,1)*100)}%`} delta={{ dir: "up", text: "+2pp" }} hint={`${fmtNum(replied)} replied`}/>
        <KPI label="Bounce rate" value={`${Math.round(bounced/Math.max(sent,1)*100)}%`} delta={{ dir: "down", text: "−0.4pp" }} hint={`${fmtNum(bounced)} bounced`}/>
        <KPI label="Best day" value="Tuesday" hint="18% reply rate"/>
      </div>

      <div className="row gap-4 mb-6" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Activity column */}
        <div className="card" style={{ flex: "2 1 480px", padding: 18 }}>
          <div className="row between mb-3">
            <div>
              <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>14-day activity</div>
              <div className="display" style={{ fontSize: 20, marginTop: 4 }}>Sends, replies & bounces</div>
            </div>
            <div className="row gap-3 text-xs">
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--accent-subtle)", display: "inline-block", borderRadius: 2 }}/>Sent</span>
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--status-success)", display: "inline-block", borderRadius: 2 }}/>Replied</span>
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--status-danger)", display: "inline-block", borderRadius: 2 }}/>Bounced</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160 }}>
            {series.map((s, i) => {
              const total = s.sent + s.replied + s.bounced + 2; // +2 for visual baseline
              const scale = 150 / maxBar;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column-reverse", gap: 1 }}>
                  {s.sent > 0 && <div style={{ height: Math.max(2, s.sent * scale), background: "var(--accent-subtle)", borderRadius: "2px 2px 0 0" }}/>}
                  {s.replied > 0 && <div style={{ height: Math.max(2, s.replied * scale), background: "var(--status-success)" }}/>}
                  {s.bounced > 0 && <div style={{ height: Math.max(2, s.bounced * scale), background: "var(--status-danger)" }}/>}
                  {total < 3 && <div style={{ height: 2, background: "var(--border-subtle)", borderRadius: 1 }}/>}
                </div>
              );
            })}
          </div>
          <div className="row between mt-2 text-xs muted">
            <span>14d ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Recent replies column */}
        <div className="card" style={{ flex: "1 1 280px", padding: 18 }}>
          <div className="text-xs muted mb-3" style={{ textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Latest replies</div>
          <div className="col gap-3">
            {recentReplies.map((l) => (
              <div key={l.id} className="row gap-3" style={{ alignItems: "center", cursor: "pointer" }} onClick={() => onOpenLead(l.id)}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: "var(--status-success)", boxShadow: "0 0 8px rgba(52,211,153,0.4)" }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm" style={{ fontWeight: 500 }}>{l.name.split(" ")[0]} <span className="muted">· {l.company}</span></div>
                  <div className="text-xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.email}</div>
                </div>
                <span className="mono text-xs muted">{relTime(l.email_status_updated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row between mb-3">
        <Tabs value="all" onChange={() => {}} items={[
          { value: "all", label: "All", count: fmtNum(qualified.length) },
          { value: "not_sent", label: "Not sent", count: fmtNum(qualified.filter(l => l.email_status === "none").length) },
          { value: "sent", label: "Sent", count: fmtNum(qualified.filter(l => l.email_status === "smartlead_sent").length) },
          { value: "replied", label: "Replied", count: fmtNum(replied) },
        ]}/>
        <div className="row gap-2">
          <button className="btn secondary sm"><Icon name="upload" size={12}/>Send next batch</button>
        </div>
      </div>

      <div className="table-wrap density-cozy">
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="checkbox-cell"><Check/></th>
                <th>Lead</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last touch</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                  <td className="checkbox-cell"><Check/></td>
                  <td><span style={{ fontWeight: 500 }}>{l.name.split(" ")[0]}</span></td>
                  <td>{l.company}</td>
                  <td><a className="cell-link" onClick={(e) => e.stopPropagation()}>{l.email}</a></td>
                  <td><StatusBadge sm kind="email" value={l.email_status}/></td>
                  <td className="muted mono text-xs">{l.email_status === "none" ? "—" : relTime(l.email_status_updated_at)}</td>
                  <td><OwnerCell ownerId={l.owner_id} profiles={profiles}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Pivot: Calls — Today's queue, dialer cards ───────────
function CallsPivot({ avatar, leads, profiles, onOpenLead }) {
  const qualified = leads.filter((l) => l.qualified === "qualified" && l.phone);
  const dialed = qualified.filter((l) => l.call_status !== "not_called").length;
  const reached = qualified.filter((l) => l.call_status === "reached").length;
  const vm = qualified.filter((l) => l.call_status === "voicemail").length;
  const pending = qualified.filter((l) => l.call_status === "not_called");

  // Priority queue: pending leads who replied to email or accepted on LinkedIn first
  const priorityQueue = [...pending].sort((a, b) => {
    const score = (l) => {
      let s = 0;
      if (l.email_status === "replied") s += 10;
      if (l.linkedin_stage === "connection_accepted") s += 5;
      if (l.linkedin_stage.includes("followup")) s += 7;
      return s;
    };
    return score(b) - score(a);
  }).slice(0, 6);

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Dialable" value={fmtNum(qualified.length)}/>
        <KPI label="Dialed" value={fmtNum(dialed)} hint={`${Math.round(dialed/qualified.length*100)}% of dialable`}/>
        <KPI label="Reached rate" value={`${Math.round(reached/Math.max(dialed,1)*100)}%`} delta={{ dir: "up", text: "+4pp" }}/>
        <KPI label="Pending" value={fmtNum(pending.length)} hint="in queue"/>
        <KPI label="Best window" value="10–11am" hint="32% reach rate"/>
      </div>

      <div className="row between mb-4">
        <div>
          <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Priority queue</div>
          <div className="display" style={{ fontSize: 20, marginTop: 4 }}>Today's call queue</div>
        </div>
        <div className="row gap-2">
          <button className="btn ghost"><Icon name="sparkles" size={14}/>Re-score queue</button>
          <button className="btn primary"><Icon name="phone" size={14}/>Start session</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginBottom: 24 }}>
        {priorityQueue.map((l, i) => (
          <div key={l.id} className="card hover" style={{ padding: 16, cursor: "pointer" }} onClick={() => onOpenLead(l.id)}>
            <div className="row between mb-3">
              <span className="badge accent sm"><span className="ind"/>#{i + 1} priority</span>
              <span className="mono text-xs muted">{l.phone}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{l.name}</div>
            <div className="text-xs muted mb-3">{l.title} · {l.company}</div>
            <div className="row gap-2 mb-3" style={{ flexWrap: "wrap" }}>
              {l.email_status === "replied" && <StatusBadge sm kind="email" value="replied"/>}
              {l.linkedin_stage !== "none" && <StatusBadge sm kind="linkedin" value={l.linkedin_stage}/>}
            </div>
            <div className="row between" style={{ paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
              <OwnerCell ownerId={l.owner_id} profiles={profiles}/>
              <button className="btn primary sm" onClick={(e) => e.stopPropagation()}>
                <Icon name="phone" size={11}/>Dial
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap density-cozy">
        <div className="table-toolbar">
          <span className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>All dialable</span>
          <div className="chip-row" style={{ marginLeft: 16 }}>
            <button className="chip active">All</button>
            <button className="chip">Not called</button>
            <button className="chip">Voicemail</button>
            <button className="chip">Reached</button>
          </div>
        </div>
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Company</th><th>Phone</th><th>Status</th><th>Owner</th></tr>
            </thead>
            <tbody>
              {qualified.slice(0, 10).map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                  <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                  <td>{l.company}</td>
                  <td><a className="cell-link mono" onClick={(e) => e.stopPropagation()}>{l.phone}</a></td>
                  <td><StatusBadge sm kind="call" value={l.call_status}/></td>
                  <td><OwnerCell ownerId={l.owner_id} profiles={profiles}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Channels Hub (Pivot) ─────────────────────────────────
function ChannelsHubPivot({ avatar, leads, profiles, onPickChannel }) {
  const lanes = [
    { id: "new",          color: "var(--text-tertiary)" },
    { id: "active",       color: "var(--accent-primary)" },
    { id: "won",          color: "var(--status-success)" },
    { id: "dead",         color: "var(--status-danger)" },
  ];
  const laneCounts = lanes.map((l) => ({ ...l, count: leads.filter((x) => x.lead_status === l.id).length }));
  const activeCount = laneCounts.find((l) => l.id === "active").count;

  const linkedinQ = leads.filter((l) => l.qualified === "qualified" && l.linkedin_url);
  const liSent = linkedinQ.filter((l) => l.linkedin_stage !== "none").length;
  const liAccepted = linkedinQ.filter((l) => ["connection_accepted","first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length;
  const liMsg = linkedinQ.filter((l) => ["first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length;

  const emailQ = leads.filter((l) => l.qualified === "qualified");
  const emailSent = emailQ.filter((l) => l.email_status !== "none").length;
  const emailReplied = emailQ.filter((l) => l.email_status === "replied").length;

  const callQ = leads.filter((l) => l.qualified === "qualified" && l.phone);
  const callPending = callQ.filter((l) => l.call_status === "not_called").length;
  const callReached = callQ.filter((l) => l.call_status === "reached").length;
  const callDialed = callQ.filter((l) => l.call_status !== "not_called").length;

  // Pivot version: keep the same 2×2 hero tiles but stack a horizontal "channels overview" strip beneath
  return (
    <>
      <div className="hub-hero">
        <div className="hub-hero-l">
          <div className="hub-hero-kicker"><Icon name="sparkles" size={11}/> Pipeline avatar</div>
          <h1 className="hub-hero-title">{avatar.name}</h1>
          <div className="hub-hero-meta">
            {fmtNum(avatar.total_leads)} leads · {avatar.source} · {fmtDate(avatar.created_at)}
          </div>
        </div>
        <div className="hub-hero-r">
          <div className="hub-stat">
            <div className="hub-stat-lbl">Active</div>
            <div className="hub-stat-val num" style={{ color: "var(--accent-soft)" }}>{fmtNum(activeCount)}</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-lbl">Replies</div>
            <div className="hub-stat-val num">{fmtNum(emailReplied + Math.round(liMsg * 0.4))}</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-lbl">Won</div>
            <div className="hub-stat-val num" style={{ color: "var(--status-success)" }}>{fmtNum(avatar.won)}</div>
          </div>
        </div>
      </div>

      {/* Quick-glance horizontal channel strip */}
      <div className="channels-flow">
        <div className="row between mb-4" style={{ position: "relative", zIndex: 1 }}>
          <div>
            <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Four channels · single picture</div>
            <div className="display" style={{ fontSize: 20, marginTop: 4 }}>Where this avatar lives right now</div>
          </div>
        </div>
        <div className="channels-flow-grid">
          <div className="cf-tile" onClick={() => onPickChannel("master")}>
            <div className="cf-tile-icon" style={{ background: "rgba(99,102,241,0.14)", color: "var(--accent-soft)" }}><Icon name="layers" size={16}/></div>
            <div className="cf-tile-name">Master</div>
            <div className="cf-tile-num">{fmtNum(activeCount)}</div>
            <div className="cf-tile-sub">{fmtNum(leads.length)} total · {fmtNum(laneCounts.find(l => l.id === "won").count)} won</div>
          </div>
          <div className="cf-tile" onClick={() => onPickChannel("linkedin")}>
            <div className="cf-tile-icon" style={{ background: "rgba(96,165,250,0.14)", color: "#93C5FD" }}><Icon name="linkedin" size={16}/></div>
            <div className="cf-tile-name">LinkedIn</div>
            <div className="cf-tile-num">{Math.round(liAccepted / Math.max(liSent, 1) * 100)}%</div>
            <div className="cf-tile-sub">{fmtNum(liSent)} sent · {fmtNum(liAccepted)} accepted</div>
          </div>
          <div className="cf-tile" onClick={() => onPickChannel("emails")}>
            <div className="cf-tile-icon" style={{ background: "rgba(52,211,153,0.14)", color: "#6EE7B7" }}><Icon name="mail" size={16}/></div>
            <div className="cf-tile-name">Emails</div>
            <div className="cf-tile-num">{Math.round(emailReplied / Math.max(emailSent, 1) * 100)}%</div>
            <div className="cf-tile-sub">{fmtNum(emailSent)} sent · {fmtNum(emailReplied)} replied</div>
          </div>
          <div className="cf-tile" onClick={() => onPickChannel("calls")}>
            <div className="cf-tile-icon" style={{ background: "rgba(251,191,36,0.14)", color: "#FCD34D" }}><Icon name="phone" size={16}/></div>
            <div className="cf-tile-name">Calls</div>
            <div className="cf-tile-num">{fmtNum(callPending)}</div>
            <div className="cf-tile-sub">{fmtNum(callDialed)} dialed · {fmtNum(callReached)} reached</div>
          </div>
        </div>
      </div>

      {/* Reuse the 2×2 grid from Refined (without its hero) */}
      <ChannelsHubRefined avatar={avatar} leads={leads} profiles={profiles} onPickChannel={onPickChannel} skipHero={true}/>
    </>
  );
}

Object.assign(window, {
  AvatarsIndexPivot, MasterPivot, LinkedInPivot, EmailsPivot, CallsPivot,
  ChannelsHubPivot,
});
