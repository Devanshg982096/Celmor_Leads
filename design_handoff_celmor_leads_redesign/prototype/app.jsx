/* =====================================================
   Narada — main app shell.
   Wires sidebar, topbar, screen routing, drawer, tweaks.
   ===================================================== */

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "refined",
  "accent": "#6366F1",
  "density": "cozy"
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  "#6366F1": { primary: "#6366F1", hover: "#818CF8", soft: "#A5B4FC", subtle: "rgba(99,102,241,0.14)", glow: "rgba(99,102,241,0.28)" },
  "#10B981": { primary: "#10B981", hover: "#34D399", soft: "#6EE7B7", subtle: "rgba(16,185,129,0.14)", glow: "rgba(16,185,129,0.28)" },
  "#F59E0B": { primary: "#F59E0B", hover: "#FBBF24", soft: "#FCD34D", subtle: "rgba(245,158,11,0.14)", glow: "rgba(245,158,11,0.28)" },
  "#F43F5E": { primary: "#F43F5E", hover: "#FB7185", soft: "#FDA4AF", subtle: "rgba(244,63,94,0.14)", glow: "rgba(244,63,94,0.28)" },
  "#06B6D4": { primary: "#06B6D4", hover: "#22D3EE", soft: "#67E8F9", subtle: "rgba(6,182,212,0.14)", glow: "rgba(6,182,212,0.28)" },
};

function applyAccent(accent) {
  const p = ACCENT_PALETTES[accent] || ACCENT_PALETTES["#6366F1"];
  const root = document.documentElement.style;
  root.setProperty("--accent-primary", p.primary);
  root.setProperty("--accent-hover", p.hover);
  root.setProperty("--accent-soft", p.soft);
  root.setProperty("--accent-subtle", p.subtle);
  root.setProperty("--accent-glow", p.glow);
}

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ collapsed, onToggle, route, onNavigate, avatars, currentUser }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <a className="sidebar-logo" onClick={(e) => { e.preventDefault(); onNavigate({ kind: "avatars" }); }} href="#">
          <NaradaMark size={18}/>
          <span className="sidebar-logo-word">narada</span>
        </a>
        <button onClick={onToggle} className="sidebar-item" style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-tertiary)" }}>
          <Icon name="panelLeft" size={14}/>
          <span>Collapse</span>
        </button>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section-label">Avatars</div>
        {avatars.map((a) => {
          const active = route.kind === "avatar" && route.avatarId === a.id;
          return (
            <a key={a.id} href="#"
              className={`sidebar-item ${active ? "active" : ""}`}
              onClick={(e) => { e.preventDefault(); onNavigate({ kind: "avatar", avatarId: a.id, tab: "master" }); }}>
              <span className="dot"/>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
            </a>
          );
        })}
        <a href="#" className="sidebar-item" style={{ marginTop: 6, color: "var(--text-tertiary)" }}>
          <Icon name="plus" size={14}/>
          <span>New avatar</span>
        </a>
      </div>

      <div className="sidebar-foot">
        <a href="#" className="sidebar-item">
          <Icon name="settings" size={14}/>
          <span>Settings</span>
        </a>
        <div className="sidebar-user" style={{ marginTop: 4 }}>
          <UserAvatar name={currentUser.display_name} hue={currentUser.hue} size={26}/>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.display_name}</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────
function Topbar({ route, avatars, direction, onDirectionChange, onNavigate }) {
  const av = route.kind === "avatar" ? avatars.find((a) => a.id === route.avatarId) : null;
  const onHub = route.kind === "avatar" && route.tab === "channels";
  return (
    <header className="topbar">
      <nav className="crumb">
        <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ kind: "avatars" }); }} style={{ cursor: "pointer" }}>Avatars</a>
        {av && (
          <>
            <span className="sep">/</span>
            {onHub ? (
              <span className="cur">{av.name}</span>
            ) : (
              <a href="#" className="cur" style={{ cursor: "pointer" }} onClick={(e) => { e.preventDefault(); onNavigate({ kind: "avatar", avatarId: av.id, tab: "channels" }); }}>
                {av.name}
              </a>
            )}
            {!onHub && <><span className="sep">/</span><span className="cur" style={{ textTransform: "capitalize" }}>{route.tab}</span></>}
          </>
        )}
      </nav>

      <div className="topbar-actions">
        <button className="kbar-trigger">
          <Icon name="search" size={13}/>
          Search…
          <kbd>⌘K</kbd>
        </button>

        <div className="direction-switch" role="tablist" aria-label="Design direction">
          <button className={direction === "refined" ? "active" : ""} onClick={() => onDirectionChange("refined")}>Refined</button>
          <button className={direction === "pivot" ? "active" : ""} onClick={() => onDirectionChange("pivot")}>
            <Icon name="sparkles" size={11}/>Pivot
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Drawer content (shared between directions) ───────────
function LeadDrawerContent({ lead, profiles, onClose }) {
  const { SAMPLE_ACTIVITY } = window.NARADA_DATA;
  if (!lead) return null;
  const owner = profiles.find((p) => p.id === lead.owner_id);
  return (
    <>
      <div className="drawer-head">
        <div className="drawer-head-top">
          <div>
            <h2>{lead.name}</h2>
            <div className="sub">{lead.title} · {lead.company}</div>
          </div>
          <button className="btn icon ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <StatusBadge kind="lead" value={lead.lead_status}/>
          <StatusBadge kind="email" value={lead.email_status}/>
          <StatusBadge kind="linkedin" value={lead.linkedin_stage}/>
          <StatusBadge kind="call" value={lead.call_status}/>
        </div>
      </div>

      <div className="drawer-body">
        <div className="drawer-section">
          <h3>Channels</h3>
          <div className="row gap-3" style={{ flexWrap: "wrap" }}>
            <button className="btn secondary sm"><Icon name="mail" size={12}/>Send email</button>
            <button className="btn secondary sm"><Icon name="linkedin" size={12}/>Open LinkedIn</button>
            <button className="btn secondary sm"><Icon name="phone" size={12}/>Call {lead.phone || "—"}</button>
          </div>
        </div>

        <div className="drawer-section">
          <h3>Contact</h3>
          <div className="kv-row"><span className="k">Email</span><span className="v"><a className="cell-link">{lead.email}</a></span></div>
          <div className="kv-row"><span className="k">Phone</span><span className="v">{lead.phone ? <a className="cell-link mono">{lead.phone}</a> : <span className="muted">—</span>}</span></div>
          <div className="kv-row"><span className="k">LinkedIn</span><span className="v">{lead.linkedin_url ? <a className="cell-link">Profile ↗</a> : <span className="muted">—</span>}</span></div>
          <div className="kv-row"><span className="k">Company</span><span className="v">{lead.company}</span></div>
          <div className="kv-row"><span className="k">Title</span><span className="v">{lead.title}</span></div>
          <div className="kv-row"><span className="k">Employees</span><span className="v mono">{lead.employees}</span></div>
          <div className="kv-row"><span className="k">City</span><span className="v">{lead.city}</span></div>
          <div className="kv-row"><span className="k">Owner</span><span className="v">{owner ? <OwnerCell ownerId={lead.owner_id} profiles={profiles}/> : <span className="muted">Unassigned</span>}</span></div>
        </div>

        <div className="drawer-section">
          <h3>Notes</h3>
          <textarea className="textarea" placeholder="Add a note about this lead…" defaultValue={lead.notes || ""}/>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn sm primary">Save notes</button>
          </div>
        </div>

        <div className="drawer-section">
          <h3>Activity</h3>
          {SAMPLE_ACTIVITY.map((a, i) => (
            <div key={i} className="activity-row">
              <span className="dot"/>
              <div className="body">
                <div className="text-sm"><span className="who">{a.who}</span> <span className="muted">{a.action}</span></div>
                <div className="when">{a.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────
function App() {
  const { AVATARS, CURRENT_USER, PROFILES, generateLeads } = window.NARADA_DATA;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [route, setRoute] = useStateA({ kind: "avatars" });
  const [openLeadId, setOpenLeadId] = useStateA(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useStateA(false);

  // Apply accent palette as CSS vars
  useEffectA(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);

  // Generate (and memoize) leads for the currently open avatar
  const avatar = useMemoA(() =>
    route.kind === "avatar" ? AVATARS.find((a) => a.id === route.avatarId) : null,
  [route.kind, route.avatarId]);

  const leads = useMemoA(() => {
    if (!avatar) return [];
    return generateLeads(avatar.id, Math.min(300, avatar.total_leads));
  }, [avatar]);

  const openLead = useMemoA(() => leads.find((l) => l.id === openLeadId), [leads, openLeadId]);

  function onOpenAvatar(id) { setRoute({ kind: "avatar", avatarId: id, tab: "channels" }); }
  function onTab(tab) { setRoute({ ...route, tab }); }
  function onOpenLead(id) { setOpenLeadId(id); }
  function onCloseLead() { setOpenLeadId(null); }

  const direction = tweaks.direction;
  const density = tweaks.density;

  // Pick the screen component based on (route, direction)
  let screen;
  if (route.kind === "avatars") {
    screen = direction === "refined"
      ? <AvatarsIndexRefined onOpenAvatar={onOpenAvatar}/>
      : <AvatarsIndexPivot onOpenAvatar={onOpenAvatar}/>;
  } else if (route.kind === "avatar" && avatar) {
    const isHub = route.tab === "channels";
    // On the hub, hide the tab bar so it feels like a deliberate landing page
    const HeadEl = isHub ? null : (
      <AvatarPageHead avatar={avatar} tab={route.tab} onTab={onTab}>
        {direction === "pivot" && <button className="btn ghost sm"><Icon name="sparkles" size={12}/>Suggest next batch</button>}
      </AvatarPageHead>
    );
    let body;
    if (route.tab === "channels") {
      body = direction === "refined"
        ? <ChannelsHubRefined avatar={avatar} leads={leads} profiles={PROFILES} onPickChannel={onTab}/>
        : <ChannelsHubPivot avatar={avatar} leads={leads} profiles={PROFILES} onPickChannel={onTab}/>;
    } else if (route.tab === "master") {
      body = direction === "refined"
        ? <MasterRefined avatar={avatar} leads={leads} profiles={PROFILES} onOpenLead={onOpenLead} density={density}/>
        : <MasterPivot avatar={avatar} leads={leads} profiles={PROFILES} onOpenLead={onOpenLead}/>;
    } else if (route.tab === "linkedin") {
      body = direction === "refined"
        ? <LinkedInRefined avatar={avatar} leads={leads} profiles={PROFILES} onOpenLead={onOpenLead} density={density}/>
        : <LinkedInPivot avatar={avatar} leads={leads} profiles={PROFILES} onOpenLead={onOpenLead}/>;
    } else if (route.tab === "emails") {
      body = direction === "refined"
        ? <EmailsRefined leads={leads} profiles={PROFILES} onOpenLead={onOpenLead} density={density}/>
        : <EmailsPivot leads={leads} profiles={PROFILES} onOpenLead={onOpenLead}/>;
    } else if (route.tab === "calls") {
      body = direction === "refined"
        ? <CallsRefined leads={leads} profiles={PROFILES} onOpenLead={onOpenLead} density={density}/>
        : <CallsPivot avatar={avatar} leads={leads} profiles={PROFILES} onOpenLead={onOpenLead}/>;
    }
    screen = <>{HeadEl}{body}</>;
  }

  return (
    <div className={`app ${sidebarCollapsed ? "collapsed" : ""}`} data-direction={direction}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        route={route}
        onNavigate={setRoute}
        avatars={AVATARS}
        currentUser={CURRENT_USER}
      />
      <main className="main">
        <Topbar
          route={route}
          avatars={AVATARS}
          direction={direction}
          onDirectionChange={(d) => setTweak("direction", d)}
          onNavigate={setRoute}
        />
        <div className="content">
          {screen}
        </div>
      </main>

      <Drawer open={openLeadId !== null} onClose={onCloseLead}>
        <LeadDrawerContent lead={openLead} profiles={PROFILES} onClose={onCloseLead}/>
      </Drawer>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Design direction"/>
        <TweakRadio
          label="Style"
          value={tweaks.direction}
          options={[
            { value: "refined", label: "Refined" },
            { value: "pivot",   label: "Pivot" },
          ]}
          onChange={(v) => setTweak("direction", v)}
        />
        <TweakSection label="Accent"/>
        <TweakColor
          label="Color"
          value={tweaks.accent}
          options={["#6366F1", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4"]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakSection label="Table density"/>
        <TweakRadio
          label="Rows"
          value={tweaks.density}
          options={[
            { value: "compact",     label: "Compact" },
            { value: "cozy",        label: "Cozy" },
            { value: "comfortable", label: "Comfy" },
          ]}
          onChange={(v) => setTweak("density", v)}
        />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
