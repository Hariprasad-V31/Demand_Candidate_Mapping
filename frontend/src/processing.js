// Browser port of eliminate_e0.py + add_priority_skill.py
import { SKILL_MAP, CORE_TO_DOMAIN } from "./skillMap.js";

export const PRIMARY_COL = "Primary";
export const SECONDARY_COL = "Secondary";
export const OUT_SKILL_COL = "Highest Priority Detailed Skillset";
export const OUT_CORE_COL = "Mapped Core Skill";
export const OUT_SCORE_COL = "Score";

// Fixed output layout. `keys` are header keywords matched against the input
// (normalized, alphanumeric only); `computed` pulls from a value generated
// during processing. Unmatched source columns are emitted blank.
export const OUTPUT_TEMPLATE = [
  { out: "QT", keys: ["qt"] },
  { out: "Week", keys: ["week"] },
  { out: "Date", keys: ["date"] },
  { out: "Profile shared time", keys: ["profilesharedtime", "sharedtime"] },
  { out: "Service Line(DU)", keys: ["serviceline", "serviceline du", "du"] },
  { out: "profile shared by", keys: ["profilesharedby", "sharedby"] },
  { out: "Source", keys: ["source"] },
  { out: "Location", keys: ["location"] },
  { out: "War room(Y/N)", keys: ["warroom"] },
  { out: "Emp", keys: ["empid", "employeeid", "emp"] },
  { out: "Emp Name", keys: ["empname", "employeename", "candidatename", "name"] },
  { out: "Contact Number", keys: ["contactnumber", "contact", "mobile", "phone"] },
  { out: "Grade", keys: ["grade"] },
  { out: "Exp", keys: ["expbucket", "experience", "exp"] },
  { out: "CoreSkill", computed: OUT_CORE_COL },
  { out: "Detail Skill Set", computed: OUT_SKILL_COL },
  { out: "Domain", domain: true },
  { out: "Ranking/Score", computed: OUT_SCORE_COL },
];

// Resolve the Domain value for a core skill using demand data mapping.
function domainForCore(core) {
  if (!core) return "";
  return CORE_TO_DOMAIN[core] || "";
}

// Normalize a header to lowercase alphanumerics for template matching.
function normTemplateHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Spring Boot and Microservices core skills are grouped as "Java-Backend".
function relabelCoreSkill(core) {
  const key = String(core).trim().toLowerCase();
  if (key === "spring boot" || key === "microservices") return "Java-Backend";
  return core;
}

// Find the input column matching any of `keys` (exact first, then substring),
// skipping columns already assigned via `used`.
function matchTemplateColumn(columns, used, keys) {
  for (const key of keys) {
    const k = normTemplateHeader(key);
    const exact = columns.find(
      (c) => !used.has(c) && normTemplateHeader(c) === k
    );
    if (exact) return exact;
  }
  for (const key of keys) {
    const k = normTemplateHeader(key);
    const partial = columns.find(
      (c) => !used.has(c) && normTemplateHeader(c).includes(k)
    );
    if (partial) return partial;
  }
  return null;
}

// Matches any segment containing an E0 level indicator: "[ E0" or "[E0".
// Works whether or not there is a closing bracket.
const E0_PATTERN = /\[\s*E0\b/;
// Captures the level letter and number inside the first bracket,
// e.g. "[ E2 2 Yrs ]" -> ["E", "2"], "[ L1 <1 Yrs ]" -> ["L", "1"].
const LEVEL_PATTERN = /\[\s*([A-Za-z]+)\s*(\d+)/;

// E-levels always outrank L-levels (and any other letter). Within the same
// tier the higher number wins. Composite = tier * 1000 + number.
function levelPriority(letter, number) {
  const tier = letter.toUpperCase() === "E" ? 1 : 0;
  return tier * 1000 + number;
}

function unescapeHtml(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeName(name) {
  return unescapeHtml(name)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Strip a leading category prefix such as "Digital : " so that
// "Digital : Cloud DevOps" becomes "Cloud DevOps". Only the first
// " : " separated prefix is removed.
export function stripCategoryPrefix(name) {
  const text = unescapeHtml(name).replace(/\u00a0/g, " ");
  const idx = text.indexOf(" : ");
  return (idx !== -1 ? text.slice(idx + 3) : text).replace(/\s+/g, " ").trim();
}

function buildReverseMap(skillMap) {
  const reverse = new Map();
  for (const [core, details] of Object.entries(skillMap)) {
    for (const entry of details) {
      const detailName = entry.split("[")[0];
      // Index both the full name and the prefix-stripped name so values
      // like "Digital : Cloud DevOps" and "Cloud DevOps" both resolve.
      reverse.set(normalizeName(detailName), core);
      reverse.set(normalizeName(stripCategoryPrefix(detailName)), core);
    }
  }
  return reverse;
}

const REVERSE_MAP = buildReverseMap(SKILL_MAP);

// --- E0 elimination ---------------------------------------------------------
export function cleanE0(value) {
  if (value === null || value === undefined) return value;
  const kept = String(value)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !E0_PATTERN.test(s));
  return kept.join(" ; ");
}

// --- Priority skill selection ----------------------------------------------
function parseSkills(cell) {
  const result = [];
  if (cell === null || cell === undefined) return result;
  for (const raw of String(cell).split(";")) {
    const segment = raw.trim();
    if (!segment) continue;
    const match = segment.match(LEVEL_PATTERN);
    if (!match) continue;
    const rawName = segment.split("[")[0].trim();
    const skillName = stripCategoryPrefix(rawName);
    const level = levelPriority(match[1], parseInt(match[2], 10));
    if (skillName) result.push({ skillName, level });
  }
  return result;
}

export function highestPrioritySkill(primaryCell, secondaryCell) {
  return rankedSkills(primaryCell, secondaryCell)[0]?.skillName || "";
}

// Build a single list of all skills across both columns, ranked by priority:
// higher level first, and within the same level Primary wins over Secondary,
// then earlier position wins. Returns [{ skillName, level }, ...].
function rankedSkills(primaryCell, secondaryCell) {
  const items = [];
  [primaryCell, secondaryCell].forEach((cell, origin) => {
    parseSkills(cell).forEach(({ skillName, level }, pos) => {
      items.push({ skillName, level, origin, pos });
    });
  });
  items.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level; // higher level first
    if (a.origin !== b.origin) return a.origin - b.origin; // Primary before Secondary
    return a.pos - b.pos; // earlier position first
  });
  return items;
}

/**
 * Pick the skill to report for a row.
 * Walks skills in priority order and returns the first one that maps to a
 * core skill. If none of the skills map, falls back to the single highest
 * priority skill (even though it has no mapping).
 * @returns {{ skill: string, core: string }}
 */
export function selectSkillAndCore(primaryCell, secondaryCell) {
  const ranked = rankedSkills(primaryCell, secondaryCell);
  if (!ranked.length) return { skill: "", core: "" };

  for (const { skillName } of ranked) {
    const core = mapCoreSkill(skillName);
    if (core) return { skill: skillName, core };
  }
  // No mapping for any skill -> fall back to the top-priority skill.
  return { skill: ranked[0].skillName, core: "" };
}

export function mapCoreSkill(skillName) {
  if (!skillName) return "";
  return (
    REVERSE_MAP.get(normalizeName(skillName)) ||
    REVERSE_MAP.get(normalizeName(stripCategoryPrefix(skillName))) ||
    ""
  );
}

// --- Flexible column detection ---------------------------------------------
// Normalize a header for fuzzy matching: lowercase, strip non-letters.
function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z]/g, "");
}

// Levenshtein distance for typo tolerance (e.g. "frimary" -> "primary").
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Find the column whose header best matches `keyword` (e.g. "primary").
function findColumn(columns, keyword) {
  const key = normalizeHeader(keyword);

  // 1. Header that contains the keyword as a substring.
  const contains = columns.filter((c) => normalizeHeader(c).includes(key));
  if (contains.length) {
    // Prefer one that also mentions "competency"/"skill", else the shortest.
    const preferred = contains.find((c) =>
      /competenc|skill/.test(normalizeHeader(c))
    );
    return preferred || contains.sort((a, b) => a.length - b.length)[0];
  }

  // 2. Fuzzy match against any whitespace-separated word in each header.
  let best = null;
  let bestDist = Infinity;
  const maxDist = Math.max(1, Math.floor(key.length / 3));
  for (const col of columns) {
    for (const word of String(col).toLowerCase().split(/[^a-z]+/)) {
      if (!word) continue;
      const dist = levenshtein(word, key);
      if (dist < bestDist) {
        bestDist = dist;
        best = col;
      }
    }
  }
  return bestDist <= maxDist ? best : null;
}

// Find the "days unallocated" column, preferring a numeric day-count header
// (e.g. "No Of Days Unallocated") and rejecting text columns that merely share
// the word "unallocated" such as "Unallocated Reason"/"Unallocated Status".
function findDaysColumn(columns) {
  const candidates = columns.filter((c) => {
    const n = normalizeHeader(c);
    const relevant = n.includes("unallocated") || n.includes("days") || n.includes("aging");
    const isText = n.includes("reason") || n.includes("status") || n.includes("comment");
    return relevant && !isText;
  });
  if (!candidates.length) return null;
  // Prefer a header that actually mentions "days" (a count) over a bare
  // "unallocated"; within a tier pick the shortest header.
  const withDays = candidates.filter((c) => normalizeHeader(c).includes("days"));
  const pool = withDays.length ? withDays : candidates;
  return pool.sort((a, b) => a.length - b.length)[0];
}

export function detectColumns(columns) {
  const primary = findColumn(columns, "primary");
  const secondary = findColumn(columns, "secondary");
  // The experience column is often named "EXP - Bucket"; try a few keywords.
  const experience =
    findColumn(columns, "experience") ||
    findColumn(columns, "exp") ||
    findColumn(columns, "bucket");
  const grade = findColumn(columns, "grade");
  // "No. of Days Unallocated" / "Unallocated Days" / "Aging" (numeric count).
  const daysUnallocated = findDaysColumn(columns);
  return { primary, secondary, experience, grade, daysUnallocated };
}

// Parse the first number out of a cell (used for days unallocated).
function parseNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

// Fixed points for years of experience (uses bucket lower bound).
function experienceScore(exp) {
  if (Number.isNaN(exp)) return 0;
  if (exp >= 11) return 50;
  if (exp >= 9) return 40;
  if (exp >= 7) return 30;
  if (exp >= 5) return 20;
  return 0;
}

// Fixed points for number of days unallocated (fewer days -> more points).
function daysScore(days) {
  if (Number.isNaN(days)) return 0;
  if (days < 10) return 50;
  if (days < 20) return 45;
  if (days < 30) return 40;
  if (days < 40) return 30;
  if (days < 50) return 20;
  if (days <= 55) return 10;
  return 5;
}

// Only candidates in these grades are kept (case-insensitive match).
export const ALLOWED_GRADES = [
  "S1",
  "BPO1",
  "BPO2",
  "BPO3",
  "BPO4",
  "BPO5",
  "BPO6",
  "CS1",
  "CS3S",
  "C1",
  "C2",
  "C3A",
  "C3B",
  "B",
];
const ALLOWED_GRADE_SET = new Set(
  ALLOWED_GRADES.map((g) => g.toUpperCase())
);

function normalizeGrade(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase();
}

// Parse a numeric experience value out of a cell. Handles plain numbers,
// strings like "5.5", "6 yrs", and bucket ranges such as "4-6", "4 - 6 Yrs"
// or ">4". For a range we use the LOWER bound; for ">N" / "N+" we use N.
function parseExperience(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  const text = String(value);
  const numbers = text.match(/\d+(\.\d+)?/g);
  if (!numbers || !numbers.length) return NaN;
  return parseFloat(numbers[0]);
}

/**
 * Transform an array of row objects.
 * @param {Object[]} rows
 * @param {{removeE0:boolean, addPriority:boolean}} options
 * @returns {{rows:Object[], columns:string[], stats:Object}}
 */
export function processRows(rows, options) {
  const { removeE0, addPriority } = options;
  if (!rows.length) return { rows: [], columns: [], stats: { rowsProcessed: 0 } };

  const baseColumns = Object.keys(rows[0]);
  const {
    primary: primaryCol,
    secondary: secondaryCol,
    experience: experienceCol,
    grade: gradeCol,
    daysUnallocated: daysCol,
  } = detectColumns(baseColumns);

  if (!primaryCol || !secondaryCol) {
    const missing = [];
    if (!primaryCol) missing.push("Primary");
    if (!secondaryCol) missing.push("Secondary");
    throw new Error(
      `Could not find a ${missing.join(" and ")} competency column. Found: ${baseColumns.join(", ")}`
    );
  }

  // Only consider candidates whose experience is strictly greater than 4.
  // For bucket ranges (e.g. "4-6") the lower bound is used.
  const MIN_EXPERIENCE = 4;
  let rowsExcludedByExperience = 0;
  let workingRows = rows;
  if (experienceCol) {
    workingRows = workingRows.filter((row) => {
      const exp = parseExperience(row[experienceCol]);
      const keep = !Number.isNaN(exp) && exp > MIN_EXPERIENCE;
      if (!keep) rowsExcludedByExperience++;
      return keep;
    });
  }

  // Only keep candidates whose grade is in the allowed list.
  let rowsExcludedByGrade = 0;
  if (gradeCol) {
    workingRows = workingRows.filter((row) => {
      const keep = ALLOWED_GRADE_SET.has(normalizeGrade(row[gradeCol]));
      if (!keep) rowsExcludedByGrade++;
      return keep;
    });
  }

  let mapped = 0;
  let unmapped = 0;

  const outRows = workingRows.map((row) => {
    const out = { ...row };

    if (removeE0) {
      out[primaryCol] = cleanE0(out[primaryCol]);
      out[secondaryCol] = cleanE0(out[secondaryCol]);
    }

    if (addPriority) {
      const { skill, core } = selectSkillAndCore(
        out[primaryCol],
        out[secondaryCol]
      );
      out[OUT_SKILL_COL] = skill;
      out[OUT_CORE_COL] = core;
      if (skill) (core ? mapped++ : unmapped++);
    }

    // Stash raw numerics for scoring (removed before returning rows).
    out.__exp = experienceCol ? parseExperience(out[experienceCol]) : NaN;
    out.__days = daysCol ? parseNumber(out[daysCol]) : NaN;

    return out;
  });

  // --- Score: fixed band points (experience + days unallocated) -------------
  // Higher experience and fewer unallocated days score more. Computed only
  // when both inputs are available.
  if (addPriority && experienceCol && daysCol) {
    for (const r of outRows) {
      r[OUT_SCORE_COL] = experienceScore(r.__exp) + daysScore(r.__days);
    }
  }

  // Group by Mapped Core Skill (alphabetical, empty last), then Score desc.
  // Spring Boot + Microservices are merged into one Java-Backend group first.
  if (addPriority) {
    const hasScore = experienceCol && daysCol;
    outRows.sort((a, b) => {
      const av = relabelCoreSkill(String(a[OUT_CORE_COL] ?? "").trim());
      const bv = relabelCoreSkill(String(b[OUT_CORE_COL] ?? "").trim());
      if (av || bv) {
        if (!av) return 1;
        if (!bv) return -1;
        const cmp = av.localeCompare(bv);
        if (cmp !== 0) return cmp;
      }
      if (hasScore) {
        const as = Number(a[OUT_SCORE_COL]);
        const bs = Number(b[OUT_SCORE_COL]);
        const asv = Number.isNaN(as) ? -Infinity : as;
        const bsv = Number.isNaN(bs) ? -Infinity : bs;
        return bsv - asv; // higher score first within a group
      }
      return 0;
    });
  }

  // Drop temporary scoring fields.
  for (const r of outRows) {
    delete r.__exp;
    delete r.__days;
  }

  // --- Remap to the required fixed output template ---------------------------
  // Source columns are matched from the input by header (specific names first
  // so e.g. "Emp" doesn't grab "Emp Name"); unmatched ones are left blank.
  const used = new Set();
  const srcByOut = new Map();
  OUTPUT_TEMPLATE.filter((t) => t.keys)
    .slice()
    .sort(
      (a, b) =>
        Math.max(...b.keys.map((k) => k.length)) -
        Math.max(...a.keys.map((k) => k.length))
    )
    .forEach((t) => {
      const col = matchTemplateColumn(baseColumns, used, t.keys);
      if (col) {
        srcByOut.set(t.out, col);
        used.add(col);
      }
    });

  const columns = OUTPUT_TEMPLATE.map((t) => t.out);
  const finalRows = outRows.map((row) => {
    const o = {};
    const core = relabelCoreSkill(String(row[OUT_CORE_COL] ?? "").trim());
    for (const t of OUTPUT_TEMPLATE) {
      if (t.domain) {
        o[t.out] = domainForCore(core);
      } else if (t.computed) {
        let val = row[t.computed] ?? "";
        // Spring Boot / Microservices core skills are reported as Java-Backend.
        if (t.out === "CoreSkill") val = core;
        o[t.out] = val;
      } else {
        const src = srcByOut.get(t.out);
        o[t.out] = src ? row[src] ?? "" : "";
      }
    }
    return o;
  });

  return {
    rows: finalRows,
    columns,
    stats: {
      rowsProcessed: finalRows.length,
      mapped,
      unmapped,
      primaryCol,
      secondaryCol,
      experienceCol,
      rowsExcludedByExperience,
      gradeCol,
      rowsExcludedByGrade,
      daysCol,
    },
  };
}
