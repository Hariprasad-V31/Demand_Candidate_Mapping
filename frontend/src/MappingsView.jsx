import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getActiveMap,
  setActiveMap,
  resetActiveMap,
  useMappingVersion,
} from "./mappingStore.js";

/* ── Helpers ──────────────────────────────────────────────── */

let ID_SEQ = 1;
const nextId = () => ID_SEQ++;

function mapToEntries(map) {
  return Object.entries(map).map(([core, details]) => ({
    id: nextId(),
    core,
    details: [...details],
  }));
}

function entriesToMap(entries) {
  const out = {};
  for (const e of entries) {
    const core = e.core.trim();
    if (!core) continue;
    out[core] = e.details.map((d) => d.trim()).filter(Boolean);
  }
  return out;
}

const sameMap = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── Editor ───────────────────────────────────────────────── */

export default function MappingsView() {
  const version = useMappingVersion();
  const active = getActiveMap();

  const [entries, setEntries] = useState(() => mapToEntries(active));
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set()); // ids of open cards
  const [addText, setAddText] = useState({});
  const [notice, setNotice] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newCore, setNewCore] = useState("");
  const fileRef = useRef(null);

  void version;
  const draftMap = useMemo(() => entriesToMap(entries), [entries]);
  const dirty = !sameMap(draftMap, active);

  const flash = (msg) => {
    setNotice(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setNotice(""), 3500);
  };

  const resync = () => {
    ID_SEQ = 1;
    setEntries(mapToEntries(getActiveMap()));
    setAddText({});
    setExpanded(new Set());
  };

  /* ── Edits (draft only) ── */

  const toggle = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addCore = () => {
    const name = newCore.trim();
    if (!name) return;
    if (entries.some((e) => e.core.toLowerCase() === name.toLowerCase())) {
      flash(`"${name}" already exists.`);
      return;
    }
    const id = nextId();
    setEntries([{ id, core: name, details: [] }, ...entries]);
    setExpanded((s) => new Set(s).add(id));
    setNewCore("");
    setShowAddGroup(false);
  };

  const renameCore = (id, name) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, core: name } : e)));

  const deleteCore = (id) => {
    const e = entries.find((x) => x.id === id);
    if (
      e &&
      (e.details.length === 0 ||
        window.confirm(`Delete the "${e.core}" group and its ${e.details.length} skill(s)?`))
    ) {
      setEntries((es) => es.filter((x) => x.id !== id));
    }
  };

  const addDetail = (id) => {
    const text = (addText[id] || "").trim();
    if (!text) return;
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== id) return e;
        if (e.details.some((d) => d.toLowerCase() === text.toLowerCase())) {
          flash(`"${text}" is already in ${e.core}.`);
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

  /* ── Save / undo / restore ── */

  const save = () => {
    const map = entriesToMap(entries);
    if (!Object.keys(map).length) {
      flash("Add at least one skill group before saving.");
      return;
    }
    setActiveMap(map);
    flash("Saved. The Demand Matcher now uses these skills.");
  };

  const undo = () => {
    resync();
    flash("Your unsaved changes were undone.");
  };

  const restore = () => {
    if (
      !window.confirm(
        "Restore the original skills? This removes all your changes."
      )
    )
      return;
    resetActiveMap();
    resync();
    flash("Restored the original skill list.");
  };

  /* ── Upload / download (Excel) ── */

  const download = () => {
    const rows = [];
    for (const e of entries) {
      if (e.details.length === 0) rows.push({ "Core Skill": e.core, "Detail Skill": "" });
      else for (const d of e.details) rows.push({ "Core Skill": e.core, "Detail Skill": d });
    }
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["Core Skill", "Detail Skill"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Skill Mapping");
    XLSX.writeFile(wb, "skill-mapping.xlsx");
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJSON = file.name.toLowerCase().endsWith(".json");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = isJSON
          ? parseJSONMap(ev.target.result)
          : parseExcelMap(ev.target.result);
        if (!Object.keys(imported).length) {
          flash("No skills found in that file.");
          return;
        }
        ID_SEQ = 1;
        setEntries(mapToEntries(imported));
        setExpanded(new Set());
        setAddText({});
        flash(
          `Loaded ${Object.keys(imported).length} skill groups. Click "Save changes" to apply.`
        );
      } catch (err) {
        flash(`Could not read that file: ${err.message}`);
      }
    };
    reader.onerror = () => flash("Could not read that file.");
    if (isJSON) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  /* ── Filter ── */

  const lower = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!lower) return entries.map((e) => ({ e, details: e.details }));
    const out = [];
    for (const e of entries) {
      const coreMatch = e.core.toLowerCase().includes(lower);
      const details = coreMatch
        ? e.details
        : e.details.filter((d) => d.toLowerCase().includes(lower));
      if (coreMatch || details.length) out.push({ e, details });
    }
    return out;
  }, [entries, lower]);

  const totalSkills = entries.reduce((a, e) => a + e.details.length, 0);
  const isOpen = (id) => expanded.has(id) || !!lower; // searching auto-opens matches

  return (
    <div className="ref-container">
      {/* Simple header */}
      <div className="ed-head">
        <div className="ed-head-title">
          <h2>Skill list</h2>
          {dirty ? (
            <span className="ed-pill ed-pill-dirty">Unsaved changes</span>
          ) : (
            <span className="ed-pill ed-pill-ok">All changes saved</span>
          )}
        </div>
        <div className="ed-head-actions">
          <button className="ed-btn ed-btn-primary" onClick={save} disabled={!dirty}>
            Save changes
          </button>
          {dirty && (
            <button className="ed-btn" onClick={undo}>
              Undo
            </button>
          )}
          <span className="ed-sep" />
          <button className="ed-btn" onClick={download}>
            Download
          </button>
          <button className="ed-btn" onClick={() => fileRef.current?.click()}>
            Upload
          </button>
          <button className="ed-btn ed-btn-danger" onClick={restore}>
            Restore original
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.json"
            hidden
            onChange={onUpload}
          />
        </div>
      </div>

      <p className="ed-help">
        Group the skills the matcher understands. Click a group to see or change
        its skills. Remember to <strong>Save changes</strong> when you're done.
      </p>

      {notice && <div className="ed-notice">{notice}</div>}

      {/* Search + add group */}
      <div className="ed-controls">
        <input
          className="ref-search"
          placeholder="Search a skill or group…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {showAddGroup ? (
          <div className="ed-add-core">
            <input
              className="ref-search"
              autoFocus
              placeholder="New group name…"
              value={newCore}
              onChange={(e) => setNewCore(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCore();
                if (e.key === "Escape") {
                  setShowAddGroup(false);
                  setNewCore("");
                }
              }}
            />
            <button className="ed-btn ed-btn-primary" onClick={addCore}>
              Add
            </button>
            <button
              className="ed-btn"
              onClick={() => {
                setShowAddGroup(false);
                setNewCore("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="ed-btn" onClick={() => setShowAddGroup(true)}>
            + New group
          </button>
        )}
      </div>

      <div className="ed-count">
        {lower
          ? `${visible.length} group(s) match "${search.trim()}"`
          : `${entries.length} groups · ${totalSkills} skills`}
      </div>

      {/* Collapsible list */}
      {visible.map(({ e, details }) => {
        const open = isOpen(e.id);
        return (
          <div key={e.id} className={`ed-group ${open ? "open" : ""}`}>
            <button className="ed-group-head" onClick={() => toggle(e.id)}>
              <span className="ed-caret">{open ? "▾" : "▸"}</span>
              <span className="ed-group-name">{e.core}</span>
              <span className="ref-badge">{e.details.length}</span>
            </button>

            {open && (
              <div className="ed-group-body">
                <label className="ed-field">
                  <span className="ed-field-label">Group name</span>
                  <input
                    className="ed-input"
                    value={e.core}
                    onChange={(ev) => renameCore(e.id, ev.target.value)}
                  />
                </label>

                <div className="ed-field-label" style={{ marginTop: 10 }}>
                  Skills in this group
                </div>
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
                  {e.details.length === 0 && (
                    <span className="ed-empty">No skills yet</span>
                  )}
                </div>

                <div className="ed-add-row">
                  <input
                    className="ed-input"
                    placeholder="Type a skill and press Enter…"
                    value={addText[e.id] || ""}
                    onChange={(ev) =>
                      setAddText((t) => ({ ...t, [e.id]: ev.target.value }))
                    }
                    onKeyDown={(ev) => ev.key === "Enter" && addDetail(e.id)}
                  />
                  <button className="ed-btn" onClick={() => addDetail(e.id)}>
                    Add skill
                  </button>
                </div>

                <button
                  className="ed-link-danger"
                  onClick={() => deleteCore(e.id)}
                >
                  Delete this group
                </button>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

/* ── File parsing ─────────────────────────────────────────── */

function parseJSONMap(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
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
  if (data && typeof data === "object") return data;
  throw new Error("unexpected file contents");
}

function parseExcelMap(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  if (!rows.length) return {};
  const keys = Object.keys(rows[0]);
  const coreKey =
    keys.find((k) => /core\s*skill/i.test(k)) ||
    keys.find((k) => /core|category|group/i.test(k)) ||
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
