// Runtime "active mapping" store.
//
// The Demand Matcher matches candidates and demand against a skill -> core-skill
// map. By default this is the built-in Master Skill Table (shared/masterSkillMap.js),
// but users can edit it in the Skill Mapping editor. Their edits are persisted in
// localStorage and become the "active" map used by all matching — no rebuild/redeploy
// required. Reset restores the built-in default.
import { useSyncExternalStore } from "react";
import {
  MASTER_SKILL_MAP,
  buildMasterReverseMap,
} from "../../shared/masterSkillMap.js";

const STORAGE_KEY = "dcm_skill_map_override_v1";

/** A fresh deep copy of the built-in default map. */
export function defaultMap() {
  return JSON.parse(JSON.stringify(MASTER_SKILL_MAP));
}

/**
 * Coerce arbitrary input into a clean { core: [detail, ...] } map:
 * string keys, string[] values, trimmed, de-duplicated (case-insensitive),
 * empty entries dropped.
 */
export function sanitizeMap(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [rawCore, rawDetails] of Object.entries(input)) {
    const core = String(rawCore).replace(/\s+/g, " ").trim();
    if (!core) continue;
    const list = Array.isArray(rawDetails) ? rawDetails : [rawDetails];
    const seen = new Set();
    const details = [];
    for (const d of list) {
      const detail = String(d ?? "").replace(/\s+/g, " ").trim();
      if (!detail) continue;
      const key = detail.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      details.push(detail);
    }
    // keep cores even with no detail skills (still a valid category)
    out[core] = details;
  }
  return out;
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const clean = sanitizeMap(parsed);
      if (Object.keys(clean).length) return clean;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return defaultMap();
}

let activeMap = loadInitial();
let activeReverse = buildMasterReverseMap(activeMap);
let version = 0;
const listeners = new Set();

function emit() {
  version += 1;
  for (const fn of listeners) fn();
}

/** Current active map (object). Do not mutate — treat as read-only. */
export function getActiveMap() {
  return activeMap;
}

/** Reverse lookup Map (normalized detail -> core) for the active map. */
export function getActiveReverse() {
  return activeReverse;
}

/** Ordered list of the active core skill categories. */
export function getCoreList() {
  return Object.keys(activeMap);
}

/** True when the active map differs from the built-in default (persisted override present). */
export function isCustomized() {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

/** Replace the active map, persist it, and notify subscribers. */
export function setActiveMap(map) {
  activeMap = sanitizeMap(map);
  activeReverse = buildMasterReverseMap(activeMap);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeMap));
  } catch {
    /* storage may be full/unavailable; in-memory map still updates */
  }
  emit();
}

/** Restore the built-in default map and clear any persisted override. */
export function resetActiveMap() {
  activeMap = defaultMap();
  activeReverse = buildMasterReverseMap(activeMap);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * React hook: returns a version number that changes whenever the active map is
 * updated, so components re-render (and re-run matching) after edits.
 */
export function useMappingVersion() {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  );
}
