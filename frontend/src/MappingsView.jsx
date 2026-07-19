import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getActiveMap,
  setActiveMap,
  resetActiveMap,
  isCustomized,
  useMappingVersion,
} from "./mappingStore.js";

/* ── Helpers ──────────────────────────────────────────────── */

let ID_SEQ = 1;
const nextId = () => ID_SEQ++;

// Active map object -> editable entries array (stable ids for React keys).
function mapToEntries(map) {
  return Object.entries(map).map(([core, details]) => ({
    id: nextId(),
    core,
    details: [...details],
  }));
}

// Entries array -> plain { core: [details] } object.
function entriesToMap(entries) {
  const out = {};
  for (const e of entries) {
    const core = e.core.trim();
    if (!core) continue;
    out[core] = e.details.map((d) => d.trim()).filter(Boolean);
  }
  return out;
}

function sameMap(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── Main editor ──────────────────────────────────────────── */

export default function MappingsView() {
  // Re-read the active map whenever it changes elsewhere (e.g. reset).
  const version = useMappingVersion();
  const active = getActiveMap();

  const [entries, setEntries] = useState(() => mapToEntries(active));
  const [search, setSearch] = useState("");
  const [newCore, setNewCore] = useState("");
  const [addText, setAddText] = useState({}); // { [entryId]: text }
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);

  // Recompute draft-as-map and dirty flag. Reading the version snapshot ensures
  // this re-runs after the active map changes elsewhere (save / reset / import).
  void version;
  const draftMap = useMemo(() => entriesToMap(entries), [entries]);
  const dirty = !sameMap(draftMap, active);

  const flash = (msg) => {
    setNotice(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setNotice(""), 3000);
  };

  const resync = () => {
    ID_SEQ = 1;
    setEntries(mapToEntries(getActiveMap()));
    setAddText({});
  };

  /* ── Edit operations (draft only) ── */

  const addCore = () => {
    const name = newCore.trim();
    if (!name) return;
    if (entries.some((e) => e.core.toLowerCase() === name.toLowerCase())) {
      flash(`Core "${name}" already exists.`);
      return;
    }
    setEntries([{ id: nextId(), core: name, details: [] }, ...entries]);
    setNewCore("");
  };

  const renameCore = (id, name) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, core: name } : e)));

  const deleteCore = (id) =>
    setEntries((es) => es.filter((e) => e.id !== id));

  const addDetail = (id) => {
    const text = (addText[id] || "").trim();
    if (!text) return;
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== id) return e;
        if (e.details.some((d) => d.toLowerCase() === text.toLowerCase())) {
          flash(`"${text}" already listed under ${e.core}.`);
          return e;
        }
        return { ...e, details: [...e.details, text] };
      })
    );
    setAddText((t) => ({ ...t, [id]: "" }));
  };

  const deleteDetail = (id, idx) =>
    setEntries((es) =>
      es.map((e) =>
        e.id === id
          ? { ...e, details: e.details.filter((_, i) => i !== idx) }
          : e
      )
    );

  /* ── Persist / discard ── */

  const save = () => {
    const map = entriesToMap(entries);
    if (!Object.keys(map).length) {
      flash("Nothing to save — add at least one core skill.");
      return;
    }
    setActiveMap(map);
    flash("Saved. The Demand Matcher now uses this mapping.");
  };

  const discard = () => {
    resync();
    flash("Reverted to the last saved mapping.");
  };

  const resetDefault = () => {
    if (
      !window.confirm(
        "Reset to the built-in default mapping? This discards all your custom edits."
      )
    )
      return;
    resetActiveMap();
    resync();
    flash("Restored the built-in default mapping.");
  };

  /* ── Import / export ── */

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(entriesToMap(entries), null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, "skill-mapping.json");
  };

  const exportExcel = () => {
    const rows = [];
    for (const e of entries) {
      if (e.details.length === 0) {
        rows.push({ "Core Skill": e.core, "Detail Skill": "" });
      } else {
        for (const d of e.details)
          rows.push({ "Core Skill": e.core, "Detail Skill": d });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["Core Skill", "Detail Skill"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Skill Mapping");
    XLSX.writeFile(wb, "skill-mapping.xlsx");
  };

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = file.name.toLowerCase().endsWith(".json")
          ? parseJSONMap(ev.target.result)
          : parseExcelMap(ev.target.result);
        if (!Object.keys(imported).length) {
          flash("No mappings found in that file.");
          return;
        }
        ID_SEQ = 1;
        setEntries(mapToEntries(imported));
        setAddText({});
        flash(
          `Imported ${Object.keys(imported).length} core skills. Review, then Save to apply.`
        );
      } catch (err) {
        flash(`Import failed: ${err.message}`);
      }
    };
    reader.onerror = () => flash("Could not read that file.");
    if (file.name.toLowerCase().endsWith(".json"))
      reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  /* ── Filtered view ── */

  const lower = search.toLowerCase();
  const visible = useMemo(() => {
    if (!lower) return entries;
    return entries
      .map((e) => {
        const coreMatch = e.core.toLowerCase().includes(lower);
        const details = coreMatch
          ? e.details
          : e.details.filter((d) => d.toLowerCase().includes(lower));
        if (!coreMatch && details.length === 0) return null;
        return { ...e, _details: details };
      })
      .filter(Boolean);
  }, [entries, lower]);

  const totalSkills = entries.reduce((a, e) => a + e.details.length, 0);

  return (
    <div className="ref-container">
      {/* Toolbar */}
      <div className="ed-toolbar">
        <div className="ed-toolbar-left">
          <strong>Skill Mapping</strong>
          {isCustomized() ? (
            <span className="ed-badge ed-badge-custom">Customized</span>
          ) : (
            <span className="ed-badge">Built-in default</span>
          )}
          {dirty && <span className="ed-badge ed-badge-dirty">Unsaved changes</span>}
        </div>
        <div className="ed-toolbar-right">
          <button className="ed-btn ed-btn-primary" onClick={save} disabled={!dirty}>
            Save
          </button>
          <button className="ed-btn" onClick={discard} disabled={!dirty}>
            Discard
          </button>
          <button className="ed-btn" onClick={() => fileRef.current?.click()}>
            Import…
          </button>
          <button className="ed-btn" onClick={exportJSON}>
            Export JSON
          </button>
          <button className="ed-btn" onClick={exportExcel}>
            Export Excel
          </button>
          <button className="ed-btn ed-btn-danger" onClick={resetDefault}>
            Reset to default
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xlsx,.xls"
            hidden
            onChange={onImportFile}
          />
        </div>
      </div>

      <p className="ed-help">
        Edit which detailed skills map to each core skill. Changes are saved in
        this browser and used by the Demand Matcher after you click{" "}
        <strong>Save</strong>. Import/Export lets you back up or share the
        mapping (Excel = two columns: <em>Core Skill</em>, <em>Detail Skill</em>).
      </p>

      {notice && <div className="ed-notice">{notice}</div>}

      {/* Add core + search */}
      <div className="ed-controls">
        <div className="ed-add-core">
          <input
            className="ref-search"
            placeholder="New core skill name…"
            value={newCore}
            onChange={(e) => setNewCore(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCore()}
          />
          <button className="ed-btn ed-btn-primary" onClick={addCore}>
            + Add core
          </button>
        </div>
        <input
          className="ref-search"
          placeholder="Search skills or cores…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="ref-stats" style={{ marginBottom: 12 }}>
        {search
          ? `Showing ${visible.length} cores (filtered)`
          : `${entries.length} core skills · ${totalSkills} detail skills`}
      </div>

      {/* Cards */}
      {visible.map((e) => {
        const details = search ? e._details : e.details;
        return (
          <div key={e.id} className="ref-card">
            <div className="ref-card-header ed-card-header">
              <input
                className="ed-core-input"
                value={e.core}
                onChange={(ev) => renameCore(e.id, ev.target.value)}
              />
              <span className="ref-badge">{e.details.length}</span>
              <button
                className="ed-icon-btn ed-btn-danger"
                title="Delete this core skill"
                onClick={() => deleteCore(e.id)}
              >
                Delete
              </button>
            </div>
            <div className="ref-card-body">
              <div className="ed-skill-list">
                {details.map((d) => {
                  const realIdx = e.details.indexOf(d);
                  return (
                    <span key={d} className="ed-chip">
                      {d}
                      <button
                        className="ed-chip-x"
                        title="Remove"
                        onClick={() => deleteDetail(e.id, realIdx)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {details.length === 0 && (
                  <span className="ed-empty">No detail skills</span>
                )}
              </div>
              <div className="ed-add-row">
                <input
                  className="ed-input"
                  placeholder="Add detail skill…"
                  value={addText[e.id] || ""}
                  onChange={(ev) =>
                    setAddText((t) => ({ ...t, [e.id]: ev.target.value }))
                  }
                  onKeyDown={(ev) => ev.key === "Enter" && addDetail(e.id)}
                />
                <button className="ed-btn" onClick={() => addDetail(e.id)}>
                  Add
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── File parsing ─────────────────────────────────────────── */

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function parseJSONMap(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    // array of {core, details} or {"Core Skill","Detail Skill"}
    const out = {};
    for (const row of data) {
      const core = String(row.core ?? row["Core Skill"] ?? "").trim();
      if (!core) continue;
      const det = row.details ?? row["Detail Skill"] ?? [];
      const list = Array.isArray(det) ? det : [det];
      out[core] = out[core] || [];
      for (const d of list) {
        const v = String(d ?? "").trim();
        if (v) out[core].push(v);
      }
    }
    return out;
  }
  if (data && typeof data === "object") return data; // { core: [details] }
  throw new Error("Unrecognized JSON structure");
}

function parseExcelMap(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  if (!rows.length) return {};
  // detect columns case-insensitively
  const keys = Object.keys(rows[0]);
  const coreKey =
    keys.find((k) => /core\s*skill/i.test(k)) ||
    keys.find((k) => /core|category/i.test(k)) ||
    keys[0];
  const detailKey =
    keys.find((k) => /detail\s*skill/i.test(k)) ||
    keys.find((k) => /detail|skill/i.test(k)) ||
    keys[1] ||
    keys[0];
  const out = {};
  for (const r of rows) {
    const core = String(r[coreKey] ?? "").trim();
    if (!core) continue;
    const detail = String(r[detailKey] ?? "").trim();
    out[core] = out[core] || [];
    if (detail) out[core].push(detail);
  }
  return out;
}
