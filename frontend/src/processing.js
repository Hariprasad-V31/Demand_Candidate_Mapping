// Browser port of eliminate_e0.py + add_priority_skill.py
import { SKILL_MAP } from "./skillMap.js";

export const PRIMARY_COL = "Primary";
export const SECONDARY_COL = "Secondary";
export const OUT_SKILL_COL = "Highest Priority Detailed Skillset";
export const OUT_CORE_COL = "Mapped Core Skill";

// Matches an [ E0 ... ] level block (E00, E01 are not matched due to \b).
const E0_PATTERN = /\[\s*E0\b[^\]]*\]/;
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

export function detectColumns(columns) {
  const primary = findColumn(columns, "primary");
  const secondary = findColumn(columns, "secondary");
  // The experience column is often named "EXP - Bucket"; try a few keywords.
  const experience =
    findColumn(columns, "experience") ||
    findColumn(columns, "exp") ||
    findColumn(columns, "bucket");
  return { primary, secondary, experience };
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
  const { primary: primaryCol, secondary: secondaryCol, experience: experienceCol } =
    detectColumns(baseColumns);

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
    workingRows = rows.filter((row) => {
      const exp = parseExperience(row[experienceCol]);
      const keep = !Number.isNaN(exp) && exp > MIN_EXPERIENCE;
      if (!keep) rowsExcludedByExperience++;
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

    return out;
  });

  // Sort rows alphabetically by the Mapped Core Skill (empty values last).
  if (addPriority) {
    outRows.sort((a, b) => {
      const av = String(a[OUT_CORE_COL] ?? "").trim();
      const bv = String(b[OUT_CORE_COL] ?? "").trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv);
    });
  }

  // Build column order: keep originals, insert new columns right after Secondary.
  let columns = [...baseColumns];
  if (addPriority) {
    columns = columns.filter((c) => c !== OUT_SKILL_COL && c !== OUT_CORE_COL);
    const idx = columns.indexOf(secondaryCol) + 1;
    columns.splice(idx, 0, OUT_SKILL_COL, OUT_CORE_COL);
  }

  return {
    rows: outRows,
    columns,
    stats: {
      rowsProcessed: outRows.length,
      mapped,
      unmapped,
      primaryCol,
      secondaryCol,
      experienceCol,
      rowsExcludedByExperience,
    },
  };
}
