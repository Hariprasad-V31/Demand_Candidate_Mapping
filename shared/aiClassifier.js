// AI-powered skill classifier using GitHub Models API.
// Falls back to this when a skill is not found in the hardcoded SKILL_MAP.

import { mapCoreSkill, getCoreSkillCategories } from "./skillMap.js";

const GITHUB_MODELS_ENDPOINT =
  "https://models.inference.ai.azure.com/chat/completions";

/**
 * Classify a skill using the hardcoded map first, then AI as fallback.
 * @param {string} skillName - The detailed skill name to classify.
 * @param {string} token - GitHub personal access token for Models API.
 * @param {string} [model="gpt-4o-mini"] - Model to use for AI classification.
 * @returns {Promise<{core: string, source: "map"|"ai"}>}
 */
export async function classifySkill(skillName, token, model = "gpt-4o-mini") {
  // Try hardcoded map first (fast, no API call).
  const mapped = mapCoreSkill(skillName);
  if (mapped) {
    return { core: mapped, source: "map" };
  }

  // Fall back to AI classification.
  const aiResult = await classifyWithAI(skillName, token, model);
  return { core: aiResult, source: "ai" };
}

/**
 * Classify multiple skills in a single AI call for efficiency.
 * Skills found in the hardcoded map are resolved locally;
 * only unmapped skills are sent to the AI in one batch.
 * @param {string[]} skillNames - Array of skill names to classify.
 * @param {string} token - GitHub personal access token.
 * @param {string} [model="gpt-4o-mini"] - Model to use.
 * @returns {Promise<Map<string, {core: string, source: "map"|"ai"}>>}
 */
export async function classifySkillsBatch(
  skillNames,
  token,
  model = "gpt-4o-mini"
) {
  const results = new Map();
  const unmapped = [];

  for (const name of skillNames) {
    const core = mapCoreSkill(name);
    if (core) {
      results.set(name, { core, source: "map" });
    } else {
      unmapped.push(name);
    }
  }

  if (unmapped.length > 0) {
    const aiResults = await classifyBatchWithAI(unmapped, token, model);
    for (const [name, core] of aiResults) {
      results.set(name, { core, source: "ai" });
    }
  }

  return results;
}

async function classifyWithAI(skillName, token, model) {
  const categories = getCoreSkillCategories();
  const prompt = buildPrompt([skillName], categories);

  const response = await callGitHubModels(prompt, token, model);
  return parseAIResponse(response, [skillName]).get(skillName) || "Unknown";
}

async function classifyBatchWithAI(skillNames, token, model) {
  const categories = getCoreSkillCategories();
  const prompt = buildPrompt(skillNames, categories);

  const response = await callGitHubModels(prompt, token, model);
  return parseAIResponse(response, skillNames);
}

function buildPrompt(skillNames, categories) {
  const categoryList = categories.join(", ");
  const skillList = skillNames
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  return `You are a skill classification assistant. Given detailed IT skill names, classify each into the most appropriate core skill category from the list below.

Core skill categories:
${categoryList}

Skills to classify:
${skillList}

Rules:
- If a skill clearly fits one of the categories, return that category name exactly as listed.
- If a skill does not fit any category, suggest a short new category name (2-4 words).
- Respond ONLY with a JSON array of objects: [{"skill": "...", "core": "..."}]
- No explanations, no markdown, just the JSON array.`;
}

async function callGitHubModels(prompt, token, model) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a precise skill classification assistant. You respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  };

  const res = await fetch(GITHUB_MODELS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `GitHub Models API error (${res.status}): ${errorText}`
    );
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "[]";
}

function parseAIResponse(responseText, skillNames) {
  const results = new Map();

  try {
    // Strip markdown code fences if present.
    const cleaned = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.skill && item.core) {
          results.set(item.skill, item.core);
        }
      }
    }
  } catch {
    // If AI response is not valid JSON, map all skills as Unknown.
    for (const name of skillNames) {
      results.set(name, "Unknown");
    }
  }

  // Ensure every skill has a result.
  for (const name of skillNames) {
    if (!results.has(name)) {
      results.set(name, "Unknown");
    }
  }

  return results;
}
