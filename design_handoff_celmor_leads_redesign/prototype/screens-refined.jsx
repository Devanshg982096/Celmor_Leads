/* =====================================================
   Refined screens (Direction A: tight to current system).
   Avatars index · Master leads · LinkedIn · Emails · Calls
   ===================================================== */

const { useState: useStateR, useMemo: useMemoR, useEffect: useEffectR } = React;

// ─── Avatars Index ────────────────────────────────────────
function AvatarsIndexRefined({ onOpenAvatar }) {
  const { AVATARS } = window.NARADA_DATA;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Avatars</h1>
          <p>Each Avatar is a target persona imported from Apollo · {AVATARS.length} active</p>
        </div>
        <div className="row gap-2">
          <button className="btn ghost"><Icon name="download" size={14}/>Export</button>
          <button className="btn primary"><Icon name="plus" size={14}/>New avatar</button>
        </div>
      </div>

      <div className="avatar-grid">
        {AVATARS.map((a) => {
          const replyRate = a.contacted ? Math.round((a.replied / a.contacted) * 100) : 0;
          return (
            <div key={a.id} className="av-card" onClick={() => onOpenAvatar(a.id)}>
              <div className="av-card-head">
                <div>
                  <h3 className="av-card-title">{a.name}</h3>
                  <div className="av-card-meta">{a.source} · {fmtDate(a.created_at)}</div>
                </div>
                <Badge sm kind="neutral">{a.owner_split.length} owners</Badge>
              </div>

              <div className="av-card-numbers">
                <div>
                  <div className="av-bignum num">{fmtNum(a.total_leads)}</div>
                  <div className="av-numlabel" style={{ marginTop: 4 }}>Total leads</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <Sparkline data={a.spark} width={92} height={34}/>
                </div>
              </div>

              <div className="av-metrics">
                <div>
                  <div className="av-metric-key">Contacted</div>
                  <div className="av-metric-val">{fmtNum(a.contacted)}</div>
                </div>
                <div>
                  <div className="av-metric-key">Replied</div>
                  <div className="av-metric-val">{fmtNum(a.replied)} <span className="muted text-xs">·</span> <span className="mono text-xs" style={{ color: "var(--status-success)" }}>{replyRate}%</span></div>
                </div>
                <div>
                  <div className="av-metric-key">Won</div>
                  <div className="av-metric-val">{fmtNum(a.won)}</div>
                </div>
              </div>

              <div>
                <div className="av-progress">
                  {a.owner_split.map((o) => (
                    <span key={o.display_name} style={{ width: `${(o.count / a.total_leads) * 100}%`, background: `hsl(${o.hue} 50% 45%)` }}/>
                  ))}
                </div>
                <div className="row wrap gap-3" style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                  {a.owner_split.map((o) => (
                    <span key={o.display_name} className="row gap-2">
                      <span style={{ width: 6, height: 6, borderRadius: 2, background: `hsl(${o.hue} 50% 45%)` }}/>
                      {o.display_name} · <span className="mono">{fmtNum(o.count)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── KPI helper ───────────────────────────────────────────
function KPI({ label, value, hint, delta, spark }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value num">{value}</div>
      <div className="kpi-hint">
        {delta && <span className={`kpi-delta ${delta.dir}`}>{delta.dir === "up" ? "↑" : delta.dir === "down" ? "↓" : "·"} {delta.text}</span>}
        {hint && <span>{hint}</span>}
      </div>
      {spark && <div className="kpi-spark"><Sparkline data={spark} width={64} height={20} fill={false}/></div>}
    </div>
  );
}

// ─── Avatar tabs (Channels / Master / LinkedIn / Emails / Calls) ─────
function AvatarTabs({ value, onChange, avatar }) {
  return (
    <Tabs value={value} onChange={onChange} items={[
      { value: "channels", label: "Channels", icon: "grid" },
      { value: "master",   label: "Master",   icon: "layers" },
      { value: "linkedin", label: "LinkedIn", icon: "linkedin" },
      { value: "emails",   label: "Emails",   icon: "mail" },
      { value: "calls",    label: "Calls",    icon: "phone" },
    ]}/>
  );
}

// Avatar page wrapper
function AvatarPageHead({ avatar, tab, onTab, children }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{avatar.name}</h1>
          <p>{fmtNum(avatar.total_leads)} leads · imported {fmtDate(avatar.created_at)} · {avatar.source}</p>
        </div>
        <div className="row gap-2">
          {children}
          <button className="btn secondary"><Icon name="upload" size={14}/>Add leads</button>
        </div>
      </div>
      <div className="row between mb-6" style={{ flexWrap: "wrap", gap: 12 }}>
        <AvatarTabs value={tab} onChange={onTab} avatar={avatar}/>
      </div>
    </>
  );
}

// ─── Master leads table (Refined) ─────────────────────────
function MasterTable({ leads, profiles, onOpenLead, selected, setSelected, density }) {
  const allSel = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSel = leads.some((l) => selected.has(l.id));

  function toggleAll(check) {
    const next = new Set(selected);
    if (check) leads.forEach((l) => next.add(l.id));
    else leads.forEach((l) => next.delete(l.id));
    setSelected(next);
  }

  return (
    <div className={`table-wrap density-${density}`}>
      <div className="table-toolbar">
        <div className="search-input">
          <Icon name="search" size={14} color="var(--text-tertiary)"/>
          <input placeholder="Search leads, companies, emails…"/>
        </div>
        <div className="chip-row" style={{ marginLeft: 8 }}>
          <button className="chip"><Icon name="filter" size={12}/>Owner: all <span className="count">·</span></button>
          <button className="chip">Status: all</button>
          <button className="chip">Email: all</button>
          <button className="chip">LinkedIn: all</button>
        </div>
        <div style={{ marginLeft: "auto" }} className="row gap-2 muted text-xs">
          <span className="mono">{fmtNum(leads.length)}</span> leads
        </div>
      </div>

      <div style={{ overflow: "auto", maxHeight: 600 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th className="checkbox-cell"><Check checked={allSel} onChange={() => toggleAll(!allSel)}/></th>
              <th>Name</th>
              <th>Company</th>
              <th>Owner</th>
              <th>Email</th>
              <th>LinkedIn</th>
              <th>Call</th>
              <th>Status</th>
              <th>Qualified</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                <td className="checkbox-cell"><Check checked={selected.has(l.id)} onChange={() => {
                  const next = new Set(selected);
                  if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                  setSelected(next);
                }}/></td>
                <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                <td>{l.company}</td>
                <td><OwnerCell ownerId={l.owner_id} profiles={profiles}/></td>
                <td><StatusBadge sm kind="email" value={l.email_status}/></td>
                <td><StatusBadge sm kind="linkedin" value={l.linkedin_stage}/></td>
                <td><StatusBadge sm kind="call" value={l.call_status}/></td>
                <td><StatusBadge sm kind="lead" value={l.lead_status}/></td>
                <td>{l.qualified === "qualified" ? <span style={{ color: "var(--status-success)" }} className="text-xs">✓ Qualified</span> : <span className="cell-muted text-xs">Unqualified</span>}</td>
                <td className="cell-muted">{l.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Master view (with KPIs) ──────────────────────────────
function MasterRefined({ avatar, leads, profiles, onOpenLead, density }) {
  const [selected, setSelected] = useStateR(new Set());
  const stats = useMemoR(() => {
    let active = 0, contacted = 0, replied = 0, won = 0;
    for (const l of leads) {
      if (l.lead_status === "active") active++;
      if (l.email_status !== "none" || l.linkedin_stage !== "none" || l.call_status !== "not_called") contacted++;
      if (l.email_status === "replied") replied++;
      if (l.lead_status === "won") won++;
    }
    return { active, contacted, replied, won, total: leads.length };
  }, [leads]);

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Total leads" value={fmtNum(stats.total)} hint="all imported" />
        <KPI label="Active" value={fmtNum(stats.active)} delta={{ dir: "up", text: "+18 this wk" }}/>
        <KPI label="Contacted" value={fmtNum(stats.contacted)} hint={`${Math.round(stats.contacted / stats.total * 100)}% of total`}/>
        <KPI label="Replies" value={fmtNum(stats.replied)} delta={{ dir: "up", text: `${Math.round(stats.replied / Math.max(stats.contacted,1) * 100)}%` }}/>
        <KPI label="Won" value={fmtNum(stats.won)} delta={{ dir: "flat", text: "vs last wk" }}/>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="count">{selected.size}</span>
          <span className="text-sm secondary">selected</span>
          <span style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }}/>
          <button className="btn sm secondary">Assign owner…</button>
          <button className="btn sm secondary">Mark sent</button>
          <button className="btn sm secondary">Set status…</button>
          <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <MasterTable leads={leads.slice(0, 18)} profiles={profiles} onOpenLead={onOpenLead}
        selected={selected} setSelected={setSelected} density={density}/>
    </>
  );
}

// ─── LinkedIn view (Refined) ──────────────────────────────
function LinkedInRefined({ avatar, leads, profiles, onOpenLead, density }) {
  const qualified = leads.filter((l) => l.qualified === "qualified");
  const stages = ["connection_sent","connection_accepted","first_message","first_followup","second_followup","third_followup","dead"];
  const counts = stages.reduce((acc, s) => (acc[s] = qualified.filter((l) => l.linkedin_stage === s).length, acc), {});
  const sent = stages.slice(0, 6).reduce((a, s) => a + counts[s], 0) + counts.dead;
  const accepted = qualified.filter((l) => ["connection_accepted","first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length;
  const messaged = qualified.filter((l) => ["first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length;
  const replied = qualified.filter((l) => ["first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length;

  const steps = [
    { label: "Sent", value: sent },
    { label: "Accepted", value: accepted },
    { label: "1st Message", value: messaged },
    { label: "1st Followup", value: qualified.filter((l) => ["first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length },
    { label: "2nd Followup", value: qualified.filter((l) => ["second_followup","third_followup"].includes(l.linkedin_stage)).length },
    { label: "3rd Followup", value: counts.third_followup },
    { label: "Dead", value: counts.dead, dead: true },
  ];

  const visibleLeads = qualified.filter((l) => l.linkedin_url).slice(0, 14);

  return (
    <>
      <div className="kpi-grid">
        <KPI label="Reachable leads" value={fmtNum(qualified.length)}/>
        <KPI label="Requests sent" value={fmtNum(sent)} hint={`${Math.round(sent / qualified.length * 100)}% of reachable`}/>
        <KPI label="Acceptance rate" value={`${Math.round(accepted / Math.max(sent,1) * 100)}%`} hint={`${fmtNum(accepted)} accepted`}/>
        <KPI label="Reply rate" value={`${Math.round(replied / Math.max(messaged,1) * 100)}%`} hint={`${fmtNum(replied)} of ${fmtNum(messaged)} messaged`}/>
      </div>

      <div className="funnel-ribbon">
        <div className="funnel-ribbon-head">
          <div className="funnel-ribbon-title">Funnel · stage progression</div>
          <span className="text-xs muted">Drop-off shown beneath each step</span>
        </div>
        <div className="funnel-steps">
          {steps.map((s, i) => {
            const prev = i === 0 ? null : steps[i - 1].value;
            const drop = prev != null && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
            return (
              <div key={s.label} className={`funnel-step ${s.dead ? "dead" : i === 2 ? "active" : ""}`}>
                <span className="lbl">{s.label}</span>
                <span className="val">{fmtNum(s.value)}</span>
                {drop !== null && <span className="drop">−{drop}%</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="row between mb-3">
        <div className="chip-row">
          <button className="chip active">All stages <span className="count">{fmtNum(visibleLeads.length)}</span></button>
          <button className="chip">Not started</button>
          <button className="chip">Sent</button>
          <button className="chip">Accepted</button>
          <button className="chip">Messaged</button>
        </div>
        <div className="row gap-2 muted text-xs">
          <span className="mono">{fmtNum(visibleLeads.length)}</span> of <span className="mono">{fmtNum(qualified.length)}</span> leads
        </div>
      </div>

      <div className={`table-wrap density-${density}`}>
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Employees</th>
                <th>LinkedIn</th>
                <th>Stage</th>
                <th>Days since</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                  <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                  <td>{l.company}</td>
                  <td className="muted">{l.employees}</td>
                  <td><a className="cell-link row gap-2" onClick={(e) => e.stopPropagation()}><Icon name="linkedin" size={12}/>Profile <Icon name="arrowUpRight" size={11}/></a></td>
                  <td><StatusBadge sm kind="linkedin" value={l.linkedin_stage}/></td>
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

// ─── Emails (Refined) ─────────────────────────────────────
function EmailsRefined({ leads, profiles, onOpenLead, density }) {
  const qualified = leads.filter((l) => l.qualified === "qualified");
  const sent = qualified.filter((l) => l.email_status !== "none").length;
  const replied = qualified.filter((l) => l.email_status === "replied").length;
  const bounced = qualified.filter((l) => l.email_status === "bounced").length;
  const visible = qualified.slice(0, 14);
  return (
    <>
      <div className="kpi-grid">
        <KPI label="Emailable" value={fmtNum(qualified.length)}/>
        <KPI label="Sent" value={fmtNum(sent)} hint={`${Math.round(sent/qualified.length*100)}% of emailable`}/>
        <KPI label="Reply rate" value={`${Math.round(replied/Math.max(sent,1)*100)}%`} delta={{ dir: "up", text: "+2pp" }} hint={`${fmtNum(replied)} replied`}/>
        <KPI label="Bounce rate" value={`${Math.round(bounced/Math.max(sent,1)*100)}%`} delta={{ dir: "down", text: "−0.4pp" }} hint={`${fmtNum(bounced)} bounced`}/>
      </div>

      <div className="row between mb-3">
        <div className="chip-row">
          <button className="chip active">Status: all <span className="count">{fmtNum(qualified.length)}</span></button>
          <button className="chip">Not sent <span className="count">{fmtNum(qualified.filter(l => l.email_status === "none").length)}</span></button>
          <button className="chip">Sent <span className="count">{fmtNum(qualified.filter(l => l.email_status === "smartlead_sent").length)}</span></button>
          <button className="chip">Replied <span className="count">{fmtNum(replied)}</span></button>
          <button className="chip">Bounced <span className="count">{fmtNum(bounced)}</span></button>
        </div>
      </div>

      <div className={`table-wrap density-${density}`}>
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="checkbox-cell"><Check/></th>
                <th>Name</th>
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

// ─── Calls (Refined) ─────────────────────────────────────
function CallsRefined({ leads, profiles, onOpenLead, density }) {
  const qualified = leads.filter((l) => l.qualified === "qualified" && l.phone);
  const dialed = qualified.filter((l) => l.call_status !== "not_called").length;
  const reached = qualified.filter((l) => l.call_status === "reached").length;
  const vm = qualified.filter((l) => l.call_status === "voicemail").length;
  const pending = qualified.filter((l) => l.call_status === "not_called").length;
  const visible = qualified.slice(0, 14);
  return (
    <>
      <div className="kpi-grid">
        <KPI label="Dialable" value={fmtNum(qualified.length)}/>
        <KPI label="Dialed" value={fmtNum(dialed)} hint={`${Math.round(dialed/qualified.length*100)}% of dialable`}/>
        <KPI label="Reached rate" value={`${Math.round(reached/Math.max(dialed,1)*100)}%`} hint={`${fmtNum(reached)} reached`}/>
        <KPI label="Voicemail rate" value={`${Math.round(vm/Math.max(dialed,1)*100)}%`} hint={`${fmtNum(vm)} voicemails`}/>
        <KPI label="Pending" value={fmtNum(pending)} hint="not called yet"/>
      </div>

      <div className={`table-wrap density-${density}`}>
        <div style={{ overflow: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                  <td><span style={{ fontWeight: 500 }}>{l.name}</span> <span className="cell-muted text-xs">· {l.title}</span></td>
                  <td>{l.company}</td>
                  <td><a className="cell-link mono" onClick={(e) => e.stopPropagation()}>{l.phone}</a></td>
                  <td><StatusBadge sm kind="call" value={l.call_status}/></td>
                  <td className="muted text-xs" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{l.notes || "—"}</td>
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

// ─── Channels Hub (Refined) ───────────────────────────────
function ChannelsHubRefined({ avatar, leads, profiles, onPickChannel, skipHero }) {
  // Master tile data — lead-status split
  const lanes = [
    { id: "new",          color: "var(--text-tertiary)" },
    { id: "active",       color: "var(--accent-primary)" },
    { id: "won",          color: "var(--status-success)" },
    { id: "unqualified",  color: "var(--text-quaternary)" },
    { id: "dead",         color: "var(--status-danger)" },
  ];
  const laneCounts = lanes.map((lane) => ({
    ...lane,
    count: leads.filter((l) => l.lead_status === lane.id).length,
  }));
  const activeCount = laneCounts.find((l) => l.id === "active").count;
  const wonCount = laneCounts.find((l) => l.id === "won").count;

  // LinkedIn tile data — sub-funnel
  const linkedinQ = leads.filter((l) => l.qualified === "qualified" && l.linkedin_url);
  const liCum = {
    sent:     linkedinQ.filter((l) => l.linkedin_stage !== "none").length,
    accepted: linkedinQ.filter((l) => ["connection_accepted","first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
    msg:      linkedinQ.filter((l) => ["first_message","first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
    replied:  linkedinQ.filter((l) => ["first_followup","second_followup","third_followup"].includes(l.linkedin_stage)).length,
  };
  const liMax = Math.max(liCum.sent, 1);

  // Emails tile data — 14-day mini histogram
  const emailQ = leads.filter((l) => l.qualified === "qualified");
  const sentCount = emailQ.filter((l) => l.email_status !== "none").length;
  const repliedCount = emailQ.filter((l) => l.email_status === "replied").length;
  const days = 14;
  const histo = Array.from({ length: days }, (_, i) => {
    const dayLeads = emailQ.filter((l) => {
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
  const histoMax = Math.max(...histo.map((d) => d.sent + d.replied + d.bounced), 1);

  // Calls tile data — priority queue (top 3)
  const callQ = leads.filter((l) => l.qualified === "qualified" && l.phone);
  const pending = callQ.filter((l) => l.call_status === "not_called");
  const dialed = callQ.filter((l) => l.call_status !== "not_called").length;
  const reached = callQ.filter((l) => l.call_status === "reached").length;
  const priority = [...pending].sort((a, b) => {
    const score = (l) => {
      let s = 0;
      if (l.email_status === "replied") s += 10;
      if (l.linkedin_stage === "connection_accepted") s += 5;
      if (l.linkedin_stage.includes("followup")) s += 7;
      return s;
    };
    return score(b) - score(a);
  }).slice(0, 3);

  const replyRate = avatar.contacted ? Math.round((avatar.replied / avatar.contacted) * 100) : 0;

  return (
    <>
      {/* Avatar hero */}
      {!skipHero && <div className="hub-hero">
        <div className="hub-hero-l">
          <div className="hub-hero-kicker">Avatar overview</div>
          <h1 className="hub-hero-title">{avatar.name}</h1>
          <div className="hub-hero-meta">
            {fmtNum(avatar.total_leads)} leads · {avatar.source} · {fmtDate(avatar.created_at)}
          </div>
        </div>
        <div className="hub-hero-r">
          <div className="hub-stat">
            <div className="hub-stat-lbl">Contacted</div>
            <div className="hub-stat-val num">{fmtNum(avatar.contacted)}</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-lbl">Replied</div>
            <div className="hub-stat-val num" style={{ color: "var(--accent-soft)" }}>{fmtNum(avatar.replied)}</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-lbl">Won</div>
            <div className="hub-stat-val num" style={{ color: "var(--status-success)" }}>{fmtNum(avatar.won)}</div>
          </div>
        </div>
      </div>}

      {!skipHero && <div className="row between mb-4">
        <div>
          <div className="text-xs muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Four channels · pick your surface</div>
        </div>
        <div className="row gap-2">
          <button className="btn ghost"><Icon name="upload" size={14}/>Add leads</button>
          <button className="btn secondary"><Icon name="download" size={14}/>Export</button>
        </div>
      </div>}

      {/* 2×2 channel tiles */}
      <div className="channels-grid">

        {/* ── MASTER tile ── */}
        <div className="channel-tile tile-master" onClick={() => onPickChannel("master")}>
          <div className="tile-head">
            <div className="tile-head-l">
              <span className="tile-icon"><Icon name="layers" size={18}/></span>
              <div>
                <div className="tile-name">Master</div>
                <div className="tile-title">All leads, one surface</div>
              </div>
            </div>
            <div className="tile-kicker">
              <div className="val num">{fmtNum(leads.length)}</div>
              <div>total imported</div>
            </div>
          </div>

          <div className="tile-hero">
            <div className="tile-bignum num">{fmtNum(activeCount)}</div>
            <div className="tile-bigsub">leads actively in motion</div>
          </div>

          <div className="viz-stack" style={{ position: "relative", zIndex: 1 }}>
            <div className="viz-stack-bar">
              {laneCounts.map((l) => (
                <span key={l.id} style={{ width: `${(l.count / leads.length) * 100}%`, background: l.color }}/>
              ))}
            </div>
            <div className="viz-stack-legend">
              {laneCounts.map((l) => (
                <span key={l.id}>
                  <span className="sw" style={{ background: l.color }}/>
                  {LABELS.lead[l.id].label} <span className="mono" style={{ color: "var(--text-tertiary)" }}>{fmtNum(l.count)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="tile-foot">
            <div className="tile-foot-stats">
              <div className="tile-foot-stat">
                <div className="lbl">Won</div>
                <div className="val" style={{ color: "var(--status-success)" }}>{fmtNum(wonCount)}</div>
              </div>
              <div className="tile-foot-stat">
                <div className="lbl">Owners</div>
                <div className="val">{avatar.owner_split.length}</div>
              </div>
            </div>
            <span className="tile-open">Open Master <Icon name="arrowRight" size={13}/></span>
          </div>
        </div>

        {/* ── LINKEDIN tile ── */}
        <div className="channel-tile tile-linkedin" onClick={() => onPickChannel("linkedin")}>
          <div className="tile-head">
            <div className="tile-head-l">
              <span className="tile-icon"><Icon name="linkedin" size={18}/></span>
              <div>
                <div className="tile-name">LinkedIn</div>
                <div className="tile-title">Connection journey</div>
              </div>
            </div>
            <div className="tile-kicker">
              <div className="val num">{fmtNum(linkedinQ.length)}</div>
              <div>reachable</div>
            </div>
          </div>

          <div className="tile-hero">
            <div className="tile-bignum num">{Math.round(liCum.accepted / Math.max(liCum.sent, 1) * 100)}<span style={{ fontSize: 36, opacity: 0.6 }}>%</span></div>
            <div className="tile-bigsub">connection acceptance rate</div>
          </div>

          <div className="viz-funnel" style={{ position: "relative", zIndex: 1, marginBottom: 14 }}>
            {[
              { lbl: "Sent",     v: liCum.sent },
              { lbl: "Accepted", v: liCum.accepted },
              { lbl: "Messaged", v: liCum.msg },
              { lbl: "Replied",  v: liCum.replied },
            ].map((s) => (
              <div key={s.lbl} className="viz-funnel-step">
                <span className="lbl">{s.lbl}</span>
                <span className="viz-funnel-bar linkedin" style={{ width: `${(s.v / liMax) * 180}px` }}/>
                <span className="val">{fmtNum(s.v)}</span>
              </div>
            ))}
          </div>

          <div className="tile-foot">
            <div className="tile-foot-stats">
              <div className="tile-foot-stat">
                <div className="lbl">Reply rate</div>
                <div className="val" style={{ color: "#93C5FD" }}>{Math.round(liCum.replied / Math.max(liCum.msg, 1) * 100)}%</div>
              </div>
              <div className="tile-foot-stat">
                <div className="lbl">In motion</div>
                <div className="val">{fmtNum(liCum.msg)}</div>
              </div>
            </div>
            <span className="tile-open">Open LinkedIn <Icon name="arrowRight" size={13}/></span>
          </div>
        </div>

        {/* ── EMAILS tile ── */}
        <div className="channel-tile tile-emails" onClick={() => onPickChannel("emails")}>
          <div className="tile-head">
            <div className="tile-head-l">
              <span className="tile-icon"><Icon name="mail" size={18}/></span>
              <div>
                <div className="tile-name">Emails</div>
                <div className="tile-title">14-day send & reply pulse</div>
              </div>
            </div>
            <div className="tile-kicker">
              <div className="val num">{fmtNum(emailQ.length)}</div>
              <div>emailable</div>
            </div>
          </div>

          <div className="tile-hero">
            <div className="tile-bignum num">{Math.round(repliedCount / Math.max(sentCount, 1) * 100)}<span style={{ fontSize: 36, opacity: 0.6 }}>%</span></div>
            <div className="tile-bigsub">reply rate · {fmtNum(repliedCount)} of {fmtNum(sentCount)}</div>
          </div>

          <div style={{ position: "relative", zIndex: 1, marginBottom: 14 }}>
            <div className="viz-bars">
              {histo.map((d, i) => {
                const scale = 50 / histoMax;
                return (
                  <div key={i} className="col">
                    {d.sent > 0 && <span style={{ height: Math.max(2, d.sent * scale), background: "rgba(52,211,153,0.18)" }}/>}
                    {d.replied > 0 && <span style={{ height: Math.max(2, d.replied * scale), background: "#34D399" }}/>}
                    {d.bounced > 0 && <span style={{ height: Math.max(2, d.bounced * scale), background: "var(--status-danger)" }}/>}
                    {(d.sent + d.replied + d.bounced) === 0 && <span style={{ height: 2, background: "var(--border-subtle)" }}/>}
                  </div>
                );
              })}
            </div>
            <div className="row between" style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>
              <span>14d ago</span>
              <span>today</span>
            </div>
          </div>

          <div className="tile-foot">
            <div className="tile-foot-stats">
              <div className="tile-foot-stat">
                <div className="lbl">Sent</div>
                <div className="val">{fmtNum(sentCount)}</div>
              </div>
              <div className="tile-foot-stat">
                <div className="lbl">Bounced</div>
                <div className="val" style={{ color: "var(--status-danger)" }}>{fmtNum(emailQ.filter((l) => l.email_status === "bounced").length)}</div>
              </div>
            </div>
            <span className="tile-open">Open Emails <Icon name="arrowRight" size={13}/></span>
          </div>
        </div>

        {/* ── CALLS tile ── */}
        <div className="channel-tile tile-calls" onClick={() => onPickChannel("calls")}>
          <div className="tile-head">
            <div className="tile-head-l">
              <span className="tile-icon"><Icon name="phone" size={18}/></span>
              <div>
                <div className="tile-name">Calls</div>
                <div className="tile-title">Today's priority queue</div>
              </div>
            </div>
            <div className="tile-kicker">
              <div className="val num">{fmtNum(callQ.length)}</div>
              <div>dialable</div>
            </div>
          </div>

          <div className="tile-hero">
            <div className="tile-bignum num">{fmtNum(pending.length)}</div>
            <div className="tile-bigsub">leads in queue · {Math.round(reached / Math.max(dialed, 1) * 100)}% reach rate</div>
          </div>

          <div className="viz-queue" style={{ position: "relative", zIndex: 1, marginBottom: 14 }}>
            {priority.map((l, i) => (
              <div key={l.id} className="viz-queue-row">
                <span className="badge accent sm" style={{ background: "rgba(251, 191, 36, 0.14)", color: "#FCD34D" }}>
                  <span className="ind" style={{ background: "#FCD34D" }}/>#{i + 1}
                </span>
                <span className="name">{l.name}</span>
                <span className="meta">{l.company}</span>
              </div>
            ))}
          </div>

          <div className="tile-foot">
            <div className="tile-foot-stats">
              <div className="tile-foot-stat">
                <div className="lbl">Reached</div>
                <div className="val" style={{ color: "var(--status-success)" }}>{fmtNum(reached)}</div>
              </div>
              <div className="tile-foot-stat">
                <div className="lbl">Best window</div>
                <div className="val">10–11am</div>
              </div>
            </div>
            <span className="tile-open">Open Calls <Icon name="arrowRight" size={13}/></span>
          </div>
        </div>

      </div>
    </>
  );
}

Object.assign(window, {
  AvatarsIndexRefined, MasterRefined, LinkedInRefined, EmailsRefined, CallsRefined,
  AvatarPageHead, KPI, ChannelsHubRefined,
});
