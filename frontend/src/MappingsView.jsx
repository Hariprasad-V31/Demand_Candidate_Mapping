import { useState, useMemo } from "react";
import { MASTER_SKILL_MAP as SKILL_MAP } from "../../shared/masterSkillMap.js";

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

/* ── Main Mappings View ───────────────────────────────────── */
export default function MappingsView() {
  return (
    <div className="ref-container">
      <div className="ref-content">
        <SkillTab />
      </div>
    </div>
  );
}
