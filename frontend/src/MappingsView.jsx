import { useState, useMemo } from "react";
import {
  MASTER_SKILL_MAP as SKILL_MAP,
  CORE_TO_DOMAIN,
  CORE_TO_SUBDOMAIN,
} from "../../shared/masterSkillMap.js";

function esc(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/* ── Tab 1: Skill → Core Category ─────────────────────────── */
function SkillTab() {
  const [search, setSearch] = useState("");
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapsedSet, setCollapsedSet] = useState(new Set());

  const lower = search.toLowerCase();
  const entries = useMemo(() => {
    return Object.entries(SKILL_MAP)
      .map(([core, details]) => {
        const catMatch = core.toLowerCase().includes(lower);
        const matching = lower
          ? details.filter((d) => d.toLowerCase().includes(lower))
          : details;
        if (!catMatch && matching.length === 0) return null;
        return { core, details: catMatch ? details : matching };
      })
      .filter(Boolean);
  }, [lower]);

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedSet(new Set());
    } else {
      setCollapsedSet(new Set(entries.map((e) => e.core)));
    }
    setAllCollapsed(!allCollapsed);
  };

  const toggleOne = (core) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      next.has(core) ? next.delete(core) : next.add(core);
      return next;
    });
  };

  const totalSkills = entries.reduce((a, e) => a + e.details.length, 0);

  return (
    <>
      <input
        className="ref-search"
        placeholder="Search skills or categories..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="ref-toolbar">
        <span className="ref-stats">
          {search
            ? `Showing ${entries.length} categories, ${totalSkills} skills (filtered)`
            : `${entries.length} categories, ${totalSkills} total skills`}
        </span>
        <button className="ref-toggle" onClick={toggleAll}>
          {allCollapsed ? "Expand All" : "Collapse All"}
        </button>
      </div>
      {entries.map(({ core, details }) => (
        <div
          key={core}
          className={`ref-card ${collapsedSet.has(core) ? "collapsed" : ""}`}
        >
          <div className="ref-card-header" onClick={() => toggleOne(core)}>
            <span>
              <strong>{core}</strong>
              {CORE_TO_DOMAIN[core] && (
                <span className="ref-domain-tag">
                  {CORE_TO_DOMAIN[core]} → {CORE_TO_SUBDOMAIN[core]}
                </span>
              )}
            </span>
            <span className="ref-badge">
              {details.length} skill{details.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="ref-card-body">
            <table>
              <thead>
                <tr>
                  <th>Detailed Skill</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d, i) => (
                  <tr
                    key={i}
                    className={
                      lower && d.toLowerCase().includes(lower)
                        ? "highlight"
                        : ""
                    }
                  >
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Tab 2: Core Skill → Domain ───────────────────────────── */
function DomainTab() {
  const [search, setSearch] = useState("");
  const lower = search.toLowerCase();

  const entries = useMemo(() => {
    return Object.keys(SKILL_MAP)
      .map((core) => ({
        core,
        domain: CORE_TO_DOMAIN[core] || "",
        subDomain: CORE_TO_SUBDOMAIN[core] || "",
      }))
      .filter((item) => {
        if (!lower) return true;
        return (
          item.core.toLowerCase().includes(lower) ||
          item.domain.toLowerCase().includes(lower) ||
          item.subDomain.toLowerCase().includes(lower)
        );
      });
  }, [lower]);

  return (
    <>
      <input
        className="ref-search"
        placeholder="Search core skill or domain..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="ref-stats" style={{ marginBottom: 12 }}>
        {search
          ? `Showing ${entries.length} mappings (filtered)`
          : `${entries.length} core skills`}
      </div>
      <div className="ref-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Core Skill</th>
              <th>Domain</th>
              <th>Sub-Domain</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((item) => (
              <tr key={item.core}>
                <td>{item.core}</td>
                <td>
                  <span className="ref-tag">{item.domain || "—"}</span>
                </td>
                <td>{item.subDomain || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Tab 3: Domain Hierarchy ──────────────────────────────── */
function HierarchyTab() {
  const [search, setSearch] = useState("");
  const [collapsedDomains, setCollapsedDomains] = useState(new Set());
  const [collapsedSubs, setCollapsedSubs] = useState(new Set());
  const lower = search.toLowerCase();

  const tree = useMemo(() => {
    const t = {};
    for (const core of Object.keys(SKILL_MAP)) {
      const domain = CORE_TO_DOMAIN[core] || "(No Domain)";
      const sub = CORE_TO_SUBDOMAIN[core] || "(No Sub-Domain)";
      if (!t[domain]) t[domain] = {};
      if (!t[domain][sub]) t[domain][sub] = [];
      t[domain][sub].push(core);
    }
    return t;
  }, []);

  const filtered = useMemo(() => {
    const result = {};
    for (const [domain, subs] of Object.entries(tree)) {
      const domainMatch = domain.toLowerCase().includes(lower);
      const matchingSubs = {};
      for (const [sub, skills] of Object.entries(subs)) {
        const subMatch = sub.toLowerCase().includes(lower);
        const matchingSkills = lower
          ? skills.filter((s) => s.toLowerCase().includes(lower))
          : skills;
        if (domainMatch || subMatch || matchingSkills.length > 0) {
          matchingSubs[sub] = domainMatch || subMatch ? skills : matchingSkills;
        }
      }
      if (Object.keys(matchingSubs).length > 0) result[domain] = matchingSubs;
    }
    return result;
  }, [tree, lower]);

  const stats = useMemo(() => {
    let domains = 0,
      subs = 0,
      skills = 0;
    for (const subMap of Object.values(filtered)) {
      domains++;
      for (const arr of Object.values(subMap)) {
        subs++;
        skills += arr.length;
      }
    }
    return { domains, subs, skills };
  }, [filtered]);

  return (
    <>
      <input
        className="ref-search"
        placeholder="Search domain, sub-domain, or core skill..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="ref-stats" style={{ marginBottom: 12 }}>
        {search
          ? `Showing ${stats.domains} domains, ${stats.subs} sub-domains, ${stats.skills} core skills (filtered)`
          : `${stats.domains} domains, ${stats.subs} sub-domains, ${stats.skills} core skills`}
      </div>
      {Object.entries(filtered).map(([domain, subMap]) => {
        const totalSkills = Object.values(subMap).reduce(
          (a, b) => a + b.length,
          0
        );
        const domCollapsed = collapsedDomains.has(domain);
        return (
          <div
            key={domain}
            className={`ref-domain-group ${domCollapsed ? "collapsed" : ""}`}
          >
            <div
              className="ref-domain-header"
              onClick={() =>
                setCollapsedDomains((prev) => {
                  const n = new Set(prev);
                  n.has(domain) ? n.delete(domain) : n.add(domain);
                  return n;
                })
              }
            >
              <span>{domain}</span>
              <span className="ref-badge">
                {Object.keys(subMap).length} sub-domains · {totalSkills} skills
              </span>
            </div>
            <div className="ref-domain-body">
              {Object.entries(subMap).map(([sub, skills]) => {
                const subKey = `${domain}::${sub}`;
                const subCollapsed = collapsedSubs.has(subKey);
                return (
                  <div
                    key={subKey}
                    className={`ref-sub-group ${subCollapsed ? "collapsed" : ""}`}
                  >
                    <div
                      className="ref-sub-header"
                      onClick={() =>
                        setCollapsedSubs((prev) => {
                          const n = new Set(prev);
                          n.has(subKey)
                            ? n.delete(subKey)
                            : n.add(subKey);
                          return n;
                        })
                      }
                    >
                      <span>{sub}</span>
                      <span className="ref-badge">{skills.length} skills</span>
                    </div>
                    <div className="ref-sub-body">
                      <div className="ref-chips">
                        {skills.map((s) => (
                          <span key={s} className="ref-chip">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Main Mappings View with sub-tabs ─────────────────────── */
export default function MappingsView() {
  const [activeTab, setActiveTab] = useState("skills");

  const tabs = [
    { id: "skills", label: "Skill → Core Category" },
    { id: "domain-map", label: "Core Skill → Domain" },
    { id: "hierarchy", label: "Domain Hierarchy" },
  ];

  return (
    <div className="ref-container">
      <div className="ref-tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`ref-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className="ref-content">
        {activeTab === "skills" && <SkillTab />}
        {activeTab === "domain-map" && <DomainTab />}
        {activeTab === "hierarchy" && <HierarchyTab />}
      </div>
    </div>
  );
}
