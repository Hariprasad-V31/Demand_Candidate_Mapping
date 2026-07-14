import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { processRows, mapCoreSkill, selectSkillAndCore } from "./processing.js";
import { SKILL_MAP, CORE_TO_DOMAIN, CORE_TO_SUBDOMAIN } from "./skillMap.js";

/**
 * Normalize a string for fuzzy matching: lowercase, strip non-alphanumeric, collapse spaces.
 */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to resolve a demand skill text to a core skill.
 * Strategy: exact match in SKILL_MAP keys, then reverse map (detail → core),
 * then substring/fuzzy match.
 */
function resolveDemandToCore(skillText) {
  if (!skillText) return "";
  const trimmed = String(skillText).trim();

  // 1. Exact match as core skill key
  if (SKILL_MAP[trimmed]) return trimmed;

  // 2. Case-insensitive match on core skill keys
  const lower = trimmed.toLowerCase();
  const coreKeys = Object.keys(SKILL_MAP);
  const caseMatch = coreKeys.find((k) => k.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Try mapping as a detail skill (same logic as candidate processing)
  const mapped = mapCoreSkill(trimmed);
  if (mapped) return mapped;

  // 4. Normalized substring match on core skill keys
  const n = norm(trimmed);
  const substringMatch = coreKeys.find((k) => {
    const nk = norm(k);
    return nk.includes(n) || n.includes(nk);
  });
  if (substringMatch) return substringMatch;

  // 5. Partial word overlap (at least 2 significant words match)
  const words = n.split(" ").filter((w) => w.length > 2);
  if (words.length > 0) {
    let best = null;
    let bestScore = 0;
    for (const k of coreKeys) {
      const kWords = norm(k).split(" ").filter((w) => w.length > 2);
      const overlap = words.filter((w) => kWords.includes(w)).length;
      if (overlap > bestScore && overlap >= Math.min(2, words.length)) {
        best = k;
        bestScore = overlap;
      }
    }
    if (best) return best;
  }

  return "";
}

/**
 * Detect which column in the demand file contains skill info.
 * Looks for columns named like: Core Skill, Detail Skill, Skill, Competency, etc.
 */
function detectDemandSkillColumns(columns) {
  const normed = columns.map((c) => ({ orig: c, norm: norm(c) }));

  const coreCol = normed.find(
    (c) =>
      c.norm.includes("core skill") ||
      c.norm.includes("coreskill") ||
      c.norm === "core"
  );
  const detailCol = normed.find(
    (c) =>
      c.norm.includes("detail skill") ||
      c.norm.includes("detailskill") ||
      c.norm.includes("detailed skill")
  );
  const genericSkill = normed.find(
    (c) =>
      c.norm.includes("skill") &&
      !c.norm.includes("core") &&
      !c.norm.includes("detail")
  );
  const competency = normed.find((c) => c.norm.includes("competenc"));

  return {
    coreCol: coreCol?.orig || null,
    detailCol: detailCol?.orig || null,
    fallbackCol: genericSkill?.orig || competency?.orig || null,
  };
}

export default function DemandMatcher() {
  // Candidate state
  const [candFile, setCandFile] = useState("");
  const [candRows, setCandRows] = useState(null);
  const [candDragging, setCandDragging] = useState(false);
  const candRef = useRef(null);

  // Demand state
  const [demandFile, setDemandFile] = useState("");
  const [demandRows, setDemandRows] = useState(null);
  const [demandDragging, setDemandDragging] = useState(false);
  const demandRef = useRef(null);

  // Results
  const [matchResult, setMatchResult] = useState(null);
  const [error, setError] = useState("");

  const readExcel = useCallback((file, setRows, setName) => {
    setError("");
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) {
          setError("The file appears to be empty.");
          return;
        }
        setRows(rows);
      } catch (err) {
        setError(`Could not read file: ${err.message}`);
      }
    };
    reader.onerror = () => setError("Failed to read the file.");
    reader.readAsArrayBuffer(file);
  }, []);

  const processAndMatch = () => {
    setError("");
    setMatchResult(null);

    if (!candRows || !demandRows) {
      setError("Please upload both Candidates and Demand files.");
      return;
    }

    try {
      // Step 1: Process candidates (remove E0, add priority skill, map core skill)
      const processed = processRows(candRows, {
        removeE0: true,
        addPriority: true,
      });

      // Step 2: Extract demand core skills
      const demandCols = Object.keys(demandRows[0]);
      const { coreCol, detailCol, fallbackCol } =
        detectDemandSkillColumns(demandCols);

      const demandCoreSkills = new Set();
      const demandDetails = []; // For reporting

      for (const row of demandRows) {
        let resolved = "";

        // Try core skill column first
        if (coreCol && row[coreCol]) {
          resolved = resolveDemandToCore(String(row[coreCol]).trim());
        }

        // If not resolved, try detail skill column
        if (!resolved && detailCol && row[detailCol]) {
          resolved = resolveDemandToCore(String(row[detailCol]).trim());
        }

        // Fallback to generic skill column
        if (!resolved && fallbackCol && row[fallbackCol]) {
          resolved = resolveDemandToCore(String(row[fallbackCol]).trim());
        }

        if (resolved) {
          demandCoreSkills.add(resolved);
          demandDetails.push({
            raw: row[coreCol || detailCol || fallbackCol] || "",
            resolved,
          });
        }
      }

      if (demandCoreSkills.size === 0) {
        setError(
          "Could not identify any core skills from the Demand file. " +
            "Make sure it has a column like 'Core Skill Group', 'Detail Skill', or 'Skill'."
        );
        return;
      }

      // Step 3: Filter candidates - keep only those whose mapped core skill matches a demand
      const coreSkillCol = "CoreSkill";
      const matchedRows = processed.rows.filter((row) => {
        const candidateCore = String(row[coreSkillCol] || "").trim();
        return candidateCore && demandCoreSkills.has(candidateCore);
      });

      const unmatchedCount = processed.rows.length - matchedRows.length;

      setMatchResult({
        rows: matchedRows,
        columns: processed.columns,
        stats: {
          totalCandidates: processed.rows.length,
          totalDemands: demandRows.length,
          uniqueDemandSkills: demandCoreSkills.size,
          matched: matchedRows.length,
          unmatched: unmatchedCount,
          demandSkills: [...demandCoreSkills].sort(),
        },
      });
    } catch (err) {
      setError(`Processing error: ${err.message}`);
    }
  };

  const download = () => {
    if (!matchResult || !matchResult.rows.length) return;
    const ws = XLSX.utils.json_to_sheet(matchResult.rows, {
      header: matchResult.columns,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matched Candidates");
    const base = candFile.replace(/\.[^.]+$/, "") || "output";
    XLSX.writeFile(wb, `${base}_demand_matched.xlsx`);
  };

  const preview = useMemo(() => {
    if (!matchResult) return null;
    return matchResult.rows.slice(0, 20);
  }, [matchResult]);

  return (
    <>
      <div className="header">
        <h1>Demand ↔ Candidate Matcher</h1>
        <p>
          Upload a <strong>Candidates</strong> file and a{" "}
          <strong>Demand</strong> file. Candidates are processed, then matched
          against demand requirements. Only eligible candidates appear in the
          output.
        </p>
      </div>

      {/* Upload section */}
      <div className="panel">
        <div className="upload-pair">
          {/* Candidate upload */}
          <div className="upload-slot">
            <div className="upload-label">📄 Candidates File</div>
            <div
              className={`dropzone mini ${candDragging ? "dragging" : ""}`}
              onClick={() => candRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setCandDragging(true);
              }}
              onDragLeave={() => setCandDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCandDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readExcel(file, setCandRows, setCandFile);
              }}
            >
              {candFile ? (
                <span>
                  ✓ <strong>{candFile}</strong>
                  {candRows ? ` (${candRows.length} rows)` : ""}
                </span>
              ) : (
                <span>Click or drop .xlsx file</span>
              )}
              <input
                ref={candRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readExcel(file, setCandRows, setCandFile);
                }}
              />
            </div>
          </div>

          {/* Demand upload */}
          <div className="upload-slot">
            <div className="upload-label">📋 Demand File</div>
            <div
              className={`dropzone mini ${demandDragging ? "dragging" : ""}`}
              onClick={() => demandRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDemandDragging(true);
              }}
              onDragLeave={() => setDemandDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDemandDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readExcel(file, setDemandRows, setDemandFile);
              }}
            >
              {demandFile ? (
                <span>
                  ✓ <strong>{demandFile}</strong>
                  {demandRows ? ` (${demandRows.length} rows)` : ""}
                </span>
              ) : (
                <span>Click or drop .xlsx file</span>
              )}
              <input
                ref={demandRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readExcel(file, setDemandRows, setDemandFile);
                }}
              />
            </div>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button
            className="btn-primary"
            onClick={processAndMatch}
            disabled={!candRows || !demandRows}
          >
            Match Candidates to Demand
          </button>
          <button
            className="btn-secondary"
            onClick={download}
            disabled={!matchResult || !matchResult.rows.length}
          >
            Download Matched Candidates
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      {/* Results */}
      {matchResult && (
        <div className="panel">
          <div className="stats">
            <div className="stat">
              <div className="num">{matchResult.stats.totalCandidates}</div>
              <div className="label">Total candidates</div>
            </div>
            <div className="stat">
              <div className="num">{matchResult.stats.uniqueDemandSkills}</div>
              <div className="label">Demand core skills</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--green)" }}>
                {matchResult.stats.matched}
              </div>
              <div className="label">Matched ✓</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--red)" }}>
                {matchResult.stats.unmatched}
              </div>
              <div className="label">No demand match</div>
            </div>
          </div>

          {/* Demand skills detected */}
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Demand skills detected:
            </div>
            <div className="demand-chips">
              {matchResult.stats.demandSkills.map((s) => (
                <span key={s} className="demand-chip">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: 16 }}>
                Preview (first {preview.length} matched rows):
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {matchResult.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {matchResult.columns.map((c) => (
                          <td key={c}>{String(row[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {matchResult.rows.length === 0 && (
            <div className="error" style={{ marginTop: 16 }}>
              No candidates matched the demand requirements. Check if the
              candidate skills align with the demand file's core skills.
            </div>
          )}
        </div>
      )}
    </>
  );
}
