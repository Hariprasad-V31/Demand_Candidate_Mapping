import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const AI_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
const AI_MODEL = "gpt-4o-mini";

/**
 * Call the GitHub Models API with a prompt.
 */
async function callAI(token, systemPrompt, userPrompt, temperature = 0.1) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Parse JSON from AI response (handles markdown code blocks).
 */
function parseAIJson(content) {
  const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * AI-powered: Detect relevant columns in any Excel file.
 * Sends the column headers to the AI and asks it to identify skill-related columns.
 */
async function aiDetectColumns(token, columns, fileType) {
  const systemPrompt = `You are a data column detection assistant. Given column headers from an Excel file, identify which columns contain relevant information.`;

  const userPrompt = fileType === "candidate"
    ? `These are column headers from a CANDIDATE/EMPLOYEE Excel file:
${columns.map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Identify which columns contain:
1. "primary_skill" - Primary skill/competency column (usually has bracketed levels like [E2 2Yrs])
2. "secondary_skill" - Secondary skill/competency column
3. "emp_id" - Employee ID
4. "emp_name" - Employee/Candidate name
5. "experience" - Experience/years
6. "grade" - Grade/level
7. "location" - Location/city
8. "service_line" - Service line or department

Respond ONLY with a JSON object mapping the field names above to the exact column header string. Use null if not found.
Example: {"primary_skill": "Primary Competency", "secondary_skill": "Secondary", "emp_id": "Emp No", "emp_name": "Name", "experience": "EXP", "grade": "Grade", "location": "Location", "service_line": "DU"}`
    : `These are column headers from a DEMAND/REQUIREMENT Excel file:
${columns.map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Identify which columns contain:
1. "core_skill" - Core skill group/category
2. "detail_skill" - Detailed/specific skill requirement
3. "role" - Role title
4. "domain" - Domain/area
5. "experience" - Required experience
6. "location" - Location
7. "grade" - Grade requirement
8. "status" - Demand status (open/closed/filled)
9. "id" - Demand ID

Respond ONLY with a JSON object mapping the field names above to the exact column header string. Use null if not found.
Example: {"core_skill": "Core Skill Group", "detail_skill": "Detail Skill", "role": "Role", "domain": "Domain", "experience": "Exp", "location": "Location", "grade": "Grade", "status": "Status", "id": "ID"}`;

  const content = await callAI(token, systemPrompt, userPrompt);
  return parseAIJson(content);
}

/**
 * AI-powered: Classify candidate skills into core skill categories.
 * Processes a batch of skill texts and returns their core skill mappings.
 */
async function aiClassifyCandidateSkills(token, skillTexts, onProgress) {
  const systemPrompt = `You are an IT skill classification expert. Given raw skill descriptions from employee profiles, classify each into a standardized core skill category.

Common core skills include (but are not limited to):
Java, .NET, Python, React, Angular, SAP, Salesforce, Cloud DevOps, Data Engineering, Testing/QA, Project Management, Business Analysis, Scrum Master, DevOps, AWS, Azure, SQL, Oracle, ServiceNow, Pega, Machine Learning, Data Science, Cybersecurity, Network Engineering, iOS, Android, Flutter, Mainframe, Embedded Systems, UI/UX Design, Power BI, Tableau, Hadoop, Spark, Kubernetes, Docker, Terraform, etc.

Rules:
- Extract the skill name from bracketed text like "Java [E2 2 Yrs]" → skill is "Java"
- Classify into the MOST SPECIFIC appropriate core skill category
- If a skill has a prefix like "Digital : Cloud DevOps", the core skill is "Cloud DevOps"
- Return the core skill as a concise, standardized category name`;

  const batchSize = 20;
  const results = new Map();

  for (let i = 0; i < skillTexts.length; i += batchSize) {
    const batch = skillTexts.slice(i, i + batchSize);
    if (onProgress) {
      onProgress(`AI classifying candidate skills: ${i + batch.length}/${skillTexts.length}`);
    }

    const userPrompt = `Classify these skill descriptions into core skill categories:
${batch.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")}

Respond ONLY with a JSON array: [{"input": "...", "core_skill": "..."}]`;

    try {
      const content = await callAI(token, systemPrompt, userPrompt);
      const parsed = parseAIJson(content);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.input && item.core_skill) {
            results.set(item.input, item.core_skill.trim());
          }
        }
      }
    } catch (err) {
      console.warn("AI candidate classification batch error:", err);
    }
  }
  return results;
}

/**
 * AI-powered: Classify demand requirements into core skill categories.
 */
async function aiClassifyDemandSkills(token, demandEntries, onProgress) {
  const systemPrompt = `You are an IT demand/requirement classification expert. Given demand entries (which may include role, skill group, detail skill, or combined text), classify each into a standardized core skill category.

Rules:
- Use the most specific core skill category that fits
- Common categories: Java, .NET, Python, React, Angular, SAP, Salesforce, Cloud DevOps, Data Engineering, Testing/QA, Project Management, Business Analysis, Scrum Master, DevOps, AWS, Azure, SQL, etc.
- If the demand mentions a role like "Java Developer" or "React Lead", extract the technology as core skill
- Return standardized, concise category names`;

  const batchSize = 15;
  const results = [];

  for (let i = 0; i < demandEntries.length; i += batchSize) {
    const batch = demandEntries.slice(i, i + batchSize);
    if (onProgress) {
      onProgress(`AI classifying demand skills: ${i + batch.length}/${demandEntries.length}`);
    }

    const userPrompt = `Classify these demand/requirement entries into core skill categories:
${batch.map((entry, idx) => `${idx + 1}. ${JSON.stringify(entry)}`).join("\n")}

Respond ONLY with a JSON array: [{"index": 1, "core_skill": "...", "confidence": "high|medium|low"}]`;

    try {
      const content = await callAI(token, systemPrompt, userPrompt);
      console.log("AI demand classification response:", content.slice(0, 300));
      const parsed = parseAIJson(content);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const idx = (item.index || 1) - 1;
          if (idx >= 0 && idx < batch.length) {
            results.push({
              original: batch[idx],
              coreSkill: (item.core_skill || "").trim(),
              confidence: item.confidence || "medium",
            });
          }
        }
      } else {
        console.warn("AI demand response not parseable as array:", content.slice(0, 200));
        // Fallback: use the core_skill field from the input directly
        for (const entry of batch) {
          const direct = entry.core_skill || entry.detail_skill || entry.role || "";
          results.push({ original: entry, coreSkill: direct, confidence: "fallback" });
        }
      }
    } catch (err) {
      console.warn("AI demand classification batch error:", err);
      // Fallback: use input data as-is
      for (const entry of batch) {
        const direct = entry.core_skill || entry.detail_skill || entry.role || "";
        results.push({ original: entry, coreSkill: direct, confidence: "error" });
      }
    }
  }
  return results;
}

/**
 * AI-powered: Match candidates to demands based on skill alignment.
 */
async function aiMatchCandidates(token, candidateSummaries, demandSkills, onProgress) {
  const systemPrompt = `You are an IT staffing matching expert. Given a candidate's skills and a list of demand core skills, determine if the candidate is eligible for ANY of the demands.

Rules:
- A candidate matches if their core skill aligns with any demand core skill
- Consider related skills: e.g., "Spring Boot" matches "Java" demands, "React" matches "Frontend" demands
- Be inclusive — if there's reasonable alignment, it's a match
- Consider experience level and skill depth when available`;

  if (onProgress) onProgress("AI matching candidates to demands...");

  // For efficiency, do a simple core-skill set intersection first,
  // then use AI only for uncertain cases
  const demandSkillSet = new Set(demandSkills.map(s => s.toLowerCase().trim()));
  const matched = [];
  const uncertain = [];

  for (const cand of candidateSummaries) {
    const candCore = (cand.coreSkill || "").toLowerCase().trim();
    if (candCore && demandSkillSet.has(candCore)) {
      matched.push({ ...cand, matchMethod: "direct" });
    } else if (candCore) {
      uncertain.push(cand);
    }
  }

  // AI decides on uncertain candidates in batches
  if (uncertain.length > 0 && onProgress) {
    onProgress(`AI evaluating ${uncertain.length} borderline candidates...`);
  }

  const uncertainBatchSize = 25;
  for (let i = 0; i < uncertain.length; i += uncertainBatchSize) {
    const batch = uncertain.slice(i, i + uncertainBatchSize);
    if (onProgress) {
      onProgress(`AI matching: ${i + batch.length}/${uncertain.length} borderline candidates...`);
    }

    const userPrompt = `Available demand core skills: ${demandSkills.join(", ")}

Candidates to evaluate:
${batch.map((c, idx) => `${idx + 1}. Core Skill: "${c.coreSkill}", Detail: "${c.detailSkill || ""}"`).join("\n")}

For each candidate, determine if they match ANY demand skill (consider related technologies).
Respond ONLY with a JSON array: [{"index": 1, "matches": true/false, "matched_demand": "...or empty"}]`;

    try {
      const content = await callAI(token, systemPrompt, userPrompt);
      const parsed = parseAIJson(content);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const idx = (item.index || 1) - 1;
          if (idx >= 0 && idx < batch.length && item.matches) {
            matched.push({
              ...batch[idx],
              matchMethod: "ai",
              matchedDemand: item.matched_demand || "",
            });
          }
        }
      }
    } catch (err) {
      console.warn("AI matching batch error:", err);
    }
  }

  return matched;
}

export default function DemandMatcher() {
  const [candFile, setCandFile] = useState("");
  const [candRows, setCandRows] = useState(null);
  const [candDragging, setCandDragging] = useState(false);
  const candRef = useRef(null);

  const [demandFile, setDemandFile] = useState("");
  const [demandRows, setDemandRows] = useState(null);
  const [demandDragging, setDemandDragging] = useState(false);
  const demandRef = useRef(null);

  const [ghToken, setGhToken] = useState(import.meta.env.VITE_GH_TOKEN || "");
  const hasEnvToken = Boolean(import.meta.env.VITE_GH_TOKEN);
  const [showManualToken, setShowManualToken] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");

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

  const processAndMatch = async () => {
    setError("");
    setMatchResult(null);
    setProcessing(true);

    if (!candRows || !demandRows) {
      setError("Please upload both Candidates and Demand files.");
      setProcessing(false);
      return;
    }

    if (!ghToken.trim()) {
      setError("GitHub token is required — all processing is AI-powered.");
      setProcessing(false);
      return;
    }

    const token = ghToken.trim();

    try {
      // ───────────────────────────────────────────────────────────
      // STEP 1: AI detects columns in both files
      // ───────────────────────────────────────────────────────────
      setProgress("🤖 AI analyzing candidate file structure...");
      const candCols = Object.keys(candRows[0]);
      const candColMap = await aiDetectColumns(token, candCols, "candidate");
      console.log("AI detected candidate columns:", candColMap);

      setProgress("🤖 AI analyzing demand file structure...");
      const demandCols = Object.keys(demandRows[0]);
      const demandColMap = await aiDetectColumns(token, demandCols, "demand");
      console.log("AI detected demand columns:", demandColMap);

      if (!candColMap || (!candColMap.primary_skill && !candColMap.secondary_skill)) {
        setError(`AI could not identify skill columns in the candidate file. Columns found: ${candCols.slice(0, 10).join(", ")}`);
        setProcessing(false);
        return;
      }

      // ───────────────────────────────────────────────────────────
      // STEP 2: AI classifies candidate skills
      // ───────────────────────────────────────────────────────────
      setProgress("🤖 AI extracting candidate skills...");

      // Extract unique skill texts from candidates
      const primaryCol = candColMap.primary_skill;
      const secondaryCol = candColMap.secondary_skill;
      const uniqueSkills = new Set();

      for (const row of candRows) {
        const primary = primaryCol ? String(row[primaryCol] || "").trim() : "";
        const secondary = secondaryCol ? String(row[secondaryCol] || "").trim() : "";
        // Split semicolons and collect individual skill segments
        for (const cell of [primary, secondary]) {
          for (const seg of cell.split(";")) {
            const s = seg.trim();
            if (s && s.length < 200) uniqueSkills.add(s);
          }
        }
      }

      setProgress(`🤖 AI classifying ${uniqueSkills.size} unique candidate skills...`);
      const skillClassifications = await aiClassifyCandidateSkills(
        token,
        [...uniqueSkills],
        setProgress
      );

      // Build processed candidate data with AI-assigned core skills
      const processedCandidates = candRows.map((row) => {
        const primary = primaryCol ? String(row[primaryCol] || "").trim() : "";
        const secondary = secondaryCol ? String(row[secondaryCol] || "").trim() : "";

        // Find the highest-classified skill
        let bestSkill = "";
        let bestCore = "";
        for (const cell of [primary, secondary]) {
          for (const seg of cell.split(";")) {
            const s = seg.trim();
            if (s && skillClassifications.has(s) && !bestCore) {
              bestSkill = s;
              bestCore = skillClassifications.get(s);
            }
          }
        }

        return {
          ...row,
          _aiCoreSkill: bestCore,
          _aiDetailSkill: bestSkill,
          _empId: candColMap.emp_id ? row[candColMap.emp_id] : "",
          _empName: candColMap.emp_name ? row[candColMap.emp_name] : "",
        };
      });

      // ───────────────────────────────────────────────────────────
      // STEP 3: AI classifies demand skills
      // ───────────────────────────────────────────────────────────
      setProgress("🤖 AI extracting demand requirements...");

      const coreSkillCol = demandColMap?.core_skill;
      const detailSkillCol = demandColMap?.detail_skill;
      const roleCol = demandColMap?.role;

      // Build demand entries for AI to classify
      // Also look for any column with "skill", "technology", "competenc" in its name as fallback
      const demandColNames = Object.keys(demandRows[0]);
      const fallbackSkillCols = demandColNames.filter((c) => {
        const cl = c.toLowerCase();
        return (
          cl.includes("skill") ||
          cl.includes("skil") ||
          cl.includes("technology") ||
          cl.includes("competenc") ||
          cl.includes("primary tech")
        );
      });

      console.log("Demand column mapping:", { coreSkillCol, detailSkillCol, roleCol, fallbackSkillCols });

      const demandEntries = [];
      const seenDemandTexts = new Set();

      for (const row of demandRows) {
        const core = coreSkillCol ? String(row[coreSkillCol] || "").trim() : "";
        const detail = detailSkillCol ? String(row[detailSkillCol] || "").trim() : "";
        const role = roleCol ? String(row[roleCol] || "").trim() : "";

        // Fallback: grab text from any skill-like column
        let fallbackText = "";
        if (!core && !detail) {
          for (const fc of fallbackSkillCols) {
            const val = String(row[fc] || "").trim();
            if (val && val.length < 200) {
              fallbackText = val;
              break;
            }
          }
        }

        const key = `${core}|${detail}|${role}|${fallbackText}`;
        if (!seenDemandTexts.has(key) && (core || detail || role || fallbackText)) {
          seenDemandTexts.add(key);
          demandEntries.push({
            core_skill: core || fallbackText,
            detail_skill: detail,
            role,
          });
        }
      }

      if (demandEntries.length === 0) {
        setError("AI could not extract any skill requirements from the demand file. The file may be empty or have unexpected format.");
        setProcessing(false);
        return;
      }

      setProgress(`🤖 AI classifying ${demandEntries.length} unique demand entries...`);
      const demandClassifications = await aiClassifyDemandSkills(
        token,
        demandEntries,
        setProgress
      );

      // Collect unique demand core skills
      const demandCoreSkills = new Set();
      const demandLog = [];
      for (const item of demandClassifications) {
        if (item.coreSkill) {
          demandCoreSkills.add(item.coreSkill);
          demandLog.push({ ...item, method: "ai" });
        } else {
          demandLog.push({ ...item, method: "unresolved" });
        }
      }

      if (demandCoreSkills.size === 0) {
        setError("AI could not identify any core skills from the demand file entries.");
        setProcessing(false);
        return;
      }

      // ───────────────────────────────────────────────────────────
      // STEP 4: AI matches candidates to demands
      // ───────────────────────────────────────────────────────────
      setProgress("🤖 AI matching candidates to demand requirements...");

      const candidateSummaries = processedCandidates.map((c, i) => ({
        index: i,
        coreSkill: c._aiCoreSkill,
        detailSkill: c._aiDetailSkill,
      }));

      const matchedResults = await aiMatchCandidates(
        token,
        candidateSummaries,
        [...demandCoreSkills],
        setProgress
      );

      // Build output rows
      const matchedIndices = new Set(matchedResults.map((m) => m.index));
      const outputColumns = [
        ...(candColMap.emp_id ? [candColMap.emp_id] : []),
        ...(candColMap.emp_name ? [candColMap.emp_name] : []),
        ...(candColMap.experience ? [candColMap.experience] : []),
        ...(candColMap.grade ? [candColMap.grade] : []),
        ...(candColMap.location ? [candColMap.location] : []),
        ...(candColMap.service_line ? [candColMap.service_line] : []),
        ...(primaryCol ? [primaryCol] : []),
        ...(secondaryCol ? [secondaryCol] : []),
        "AI Core Skill",
        "AI Matched Demand",
      ];

      const outputRows = [];
      for (const m of matchedResults) {
        const row = processedCandidates[m.index];
        const outRow = {};
        for (const col of outputColumns) {
          if (col === "AI Core Skill") outRow[col] = row._aiCoreSkill;
          else if (col === "AI Matched Demand") outRow[col] = m.matchedDemand || row._aiCoreSkill;
          else outRow[col] = row[col] ?? "";
        }
        outputRows.push(outRow);
      }

      setMatchResult({
        rows: outputRows,
        columns: outputColumns,
        stats: {
          totalCandidates: candRows.length,
          totalDemands: demandRows.length,
          uniqueDemandSkills: demandCoreSkills.size,
          uniqueCandSkills: skillClassifications.size,
          matched: outputRows.length,
          unmatched: candRows.length - outputRows.length,
          demandSkills: [...demandCoreSkills].sort(),
          demandLog,
          aiSteps: [
            `Detected ${candCols.length} candidate columns`,
            `Detected ${demandCols.length} demand columns`,
            `Classified ${uniqueSkills.size} unique candidate skills`,
            `Classified ${demandEntries.length} unique demand entries → ${demandCoreSkills.size} core skills`,
            `Matched ${outputRows.length}/${candRows.length} candidates`,
          ],
        },
      });
    } catch (err) {
      setError(`Processing error: ${err.message}`);
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress("");
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
    XLSX.writeFile(wb, `${base}_ai_matched.xlsx`);
  };

  const preview = useMemo(() => {
    if (!matchResult) return null;
    return matchResult.rows.slice(0, 20);
  }, [matchResult]);

  return (
    <>
      <div className="header">
        <h1>🤖 AI-Powered Demand ↔ Candidate Matcher</h1>
        <p>
          Upload a <strong>Candidates</strong> file and a{" "}
          <strong>Demand</strong> file. <em>Everything</em> is handled by AI —
          column detection, skill classification, and intelligent matching.
        </p>
      </div>

      <div className="panel">
        <div className="upload-pair">
          {/* Candidate upload */}
          <div className="upload-slot">
            <div className="upload-label">📄 Candidates File</div>
            <div
              className={`dropzone mini ${candDragging ? "dragging" : ""}`}
              onClick={() => candRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setCandDragging(true); }}
              onDragLeave={() => setCandDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCandDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readExcel(file, setCandRows, setCandFile);
              }}
            >
              {candFile ? (
                <span>✓ <strong>{candFile}</strong>{candRows ? ` (${candRows.length} rows)` : ""}</span>
              ) : (
                <span>Click or drop .xlsx file</span>
              )}
              <input ref={candRef} type="file" accept=".xlsx,.xls" hidden
                onChange={(e) => { const file = e.target.files?.[0]; if (file) readExcel(file, setCandRows, setCandFile); }}
              />
            </div>
          </div>

          {/* Demand upload */}
          <div className="upload-slot">
            <div className="upload-label">📋 Demand File</div>
            <div
              className={`dropzone mini ${demandDragging ? "dragging" : ""}`}
              onClick={() => demandRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDemandDragging(true); }}
              onDragLeave={() => setDemandDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDemandDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) readExcel(file, setDemandRows, setDemandFile);
              }}
            >
              {demandFile ? (
                <span>✓ <strong>{demandFile}</strong>{demandRows ? ` (${demandRows.length} rows)` : ""}</span>
              ) : (
                <span>Click or drop .xlsx file</span>
              )}
              <input ref={demandRef} type="file" accept=".xlsx,.xls" hidden
                onChange={(e) => { const file = e.target.files?.[0]; if (file) readExcel(file, setDemandRows, setDemandFile); }}
              />
            </div>
          </div>
        </div>

        {/* GitHub token */}
        <div className="token-section">
          {hasEnvToken && !showManualToken && (
            <>
              <div className="token-configured">
                ✓ AI processing is pre-configured (GitHub Models API)
                <button
                  style={{ marginLeft: 12, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 8px" }}
                  onClick={() => setShowManualToken(true)}
                >
                  Use different token
                </button>
              </div>
            </>
          )}
          {(!hasEnvToken || showManualToken) && (
            <>
              <label className="upload-label">🔑 GitHub Token (powers all AI processing)</label>
              <input
                type="password"
                className="token-input"
                placeholder="github_pat_... or ghp_..."
                value={showManualToken ? (ghToken === import.meta.env.VITE_GH_TOKEN ? "" : ghToken) : ghToken}
                onChange={(e) => setGhToken(e.target.value)}
              />
              <div className="token-hint">
                Paste your GitHub token with <strong>Models: Read</strong> permission. Get one at{" "}
                <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer">github.com/settings/tokens</a>
              </div>
              {showManualToken && (
                <button
                  style={{ marginTop: 6, fontSize: 12, cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 8px" }}
                  onClick={() => { setShowManualToken(false); setGhToken(import.meta.env.VITE_GH_TOKEN || ""); }}
                >
                  ← Use pre-configured token
                </button>
              )}
            </>
          )}
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button
            className="btn-primary"
            onClick={processAndMatch}
            disabled={!candRows || !demandRows || processing}
          >
            {processing ? "🤖 AI Processing..." : "🤖 AI Match Candidates to Demand"}
          </button>
          <button
            className="btn-secondary"
            onClick={download}
            disabled={!matchResult || !matchResult.rows.length}
          >
            Download Matched Candidates
          </button>
        </div>

        {progress && <div className="progress-bar">{progress}</div>}
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

          {/* AI Steps breakdown */}
          <div className="classification-info">
            <span className="class-tag ai">🤖 100% AI-Powered Pipeline</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <details>
              <summary className="muted" style={{ cursor: "pointer" }}>AI Processing Steps</summary>
              <ul style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
                {matchResult.stats.aiSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </details>
          </div>

          {/* Demand skills detected */}
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              AI-detected demand core skills:
            </div>
            <div className="demand-chips">
              {matchResult.stats.demandSkills.map((s) => (
                <span key={s} className="demand-chip">{s}</span>
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
              No candidates matched the demand requirements. The AI could not
              find skill alignment between the two files.
            </div>
          )}
        </div>
      )}
    </>
  );
}
