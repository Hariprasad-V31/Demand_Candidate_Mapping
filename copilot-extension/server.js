import express from "express";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import {
  SKILL_MAP,
  mapCoreSkill,
  normalizeName,
  stripCategoryPrefix,
} from "../shared/skillMap.js";
import {
  classifySkill,
  classifySkillsBatch,
} from "../shared/aiClassifier.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", agent: "Skill Mapper Copilot Extension" });
});

// Copilot Extension endpoint -- receives messages from GitHub Copilot Chat.
// Implements the Copilot agent protocol with SSE streaming responses.
app.post("/api/copilot", async (req, res) => {
  const payload = req.body;
  const messages = payload.messages || [];
  const lastMessage =
    messages.filter((m) => m.role === "user").pop()?.content || "";
  const token = (req.headers["x-github-token"] || "").toString();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const response = await handleMessage(lastMessage, token);
    sendSSE(res, response);
  } catch (err) {
    sendSSE(
      res,
      `**Error:** ${err.message}\n\nPlease try again or check your GitHub token.`
    );
  }
});

function sendSSE(res, content) {
  // Send as a single SSE event following the Copilot agent protocol.
  const event = {
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

async function handleMessage(message, token) {
  const lower = message.toLowerCase().trim();

  // Help / intro
  if (
    lower === "help" ||
    lower === "hi" ||
    lower === "hello" ||
    lower.includes("what can you do")
  ) {
    return getHelpText();
  }

  // List all core skill categories
  if (
    lower.includes("list") &&
    (lower.includes("skill") || lower.includes("categor"))
  ) {
    return listCategories();
  }

  // Classify a single skill
  if (lower.startsWith("classify ") || lower.startsWith("map ")) {
    const skillName = message.replace(/^(classify|map)\s+/i, "").trim();
    return classifySingleSkill(skillName, token);
  }

  // Look up which category a skill belongs to
  if (lower.startsWith("lookup ") || lower.startsWith("find ")) {
    const skillName = message.replace(/^(lookup|find)\s+/i, "").trim();
    return lookupSkill(skillName);
  }

  // Show skills in a category
  if (lower.startsWith("show ")) {
    const category = message.replace(/^show\s+/i, "").trim();
    return showCategory(category);
  }

  // Classify multiple skills (comma or newline separated)
  if (lower.includes("classify these") || lower.includes("map these")) {
    const skillsText = message
      .replace(/^.*?(classify|map)\s+these[:\s]*/i, "")
      .trim();
    const skills = skillsText
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (skills.length === 0) {
      return "Please provide skills to classify, separated by commas or newlines.";
    }
    return classifyMultipleSkills(skills, token);
  }

  // Default: try to classify the input as a skill name
  if (lower.length > 2 && !lower.includes(" ")) {
    return classifySingleSkill(message.trim(), token);
  }

  return getHelpText();
}

function getHelpText() {
  return `## Skill Mapper Agent

I can help you classify candidate skills into core job categories. Here's what I can do:

| Command | Description |
|---------|-------------|
| **classify \`<skill>\`** | Classify a single skill (uses AI if not in the known map) |
| **map these: \`skill1, skill2, ...\`** | Classify multiple skills at once |
| **lookup \`<skill>\`** | Check if a skill exists in the known mapping |
| **show \`<category>\`** | List all detailed skills in a core category |
| **list categories** | Show all core skill categories |

### Examples
- \`classify Oracle DBA\`
- \`map these: Kubernetes, Docker, Ansible, Chef\`
- \`show Java\`
- \`lookup Spring Boot\`

> **Hybrid mode:** Known skills are mapped instantly from the built-in database. Unknown skills are classified using AI (GitHub Models API).`;
}

function listCategories() {
  const categories = Object.keys(SKILL_MAP);
  const list = categories.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return `## Core Skill Categories (${categories.length})\n\n${list}`;
}

function showCategory(category) {
  // Find exact or fuzzy match
  const match = Object.keys(SKILL_MAP).find(
    (k) => k.toLowerCase() === category.toLowerCase()
  );
  if (!match) {
    const suggestions = Object.keys(SKILL_MAP)
      .filter((k) => k.toLowerCase().includes(category.toLowerCase()))
      .slice(0, 5);
    return suggestions.length
      ? `Category "${category}" not found. Did you mean: ${suggestions.join(", ")}?`
      : `Category "${category}" not found. Use \`list categories\` to see all options.`;
  }

  const details = SKILL_MAP[match];
  const skillNames = [
    ...new Set(details.map((d) => d.split("[")[0].trim())),
  ];
  const list = skillNames.map((s) => `- ${s}`).join("\n");
  return `## ${match}\n\nDetailed skills (${skillNames.length}):\n${list}`;
}

function lookupSkill(skillName) {
  const core = mapCoreSkill(skillName);
  if (core) {
    return `**${skillName}** maps to core category: **${core}** (from built-in map)`;
  }
  return `**${skillName}** is not in the built-in map. Use \`classify ${skillName}\` to classify it with AI.`;
}

async function classifySingleSkill(skillName, token) {
  if (!token) {
    // Without a token, only try the hardcoded map.
    const core = mapCoreSkill(skillName);
    if (core) {
      return `| Skill | Core Category | Source |\n|-------|--------------|--------|\n| ${skillName} | **${core}** | Built-in map |`;
    }
    return `**${skillName}** is not in the built-in map. To use AI classification, ensure your GitHub token is available.`;
  }

  const result = await classifySkill(skillName, token);
  const sourceLabel =
    result.source === "map" ? "Built-in map" : "AI classified";
  return `| Skill | Core Category | Source |\n|-------|--------------|--------|\n| ${skillName} | **${result.core}** | ${sourceLabel} |`;
}

async function classifyMultipleSkills(skills, token) {
  if (!token) {
    // Without token, only use hardcoded map.
    const rows = skills.map((s) => {
      const core = mapCoreSkill(s);
      return `| ${s} | ${core || "Unknown"} | ${core ? "Built-in map" : "No token for AI"} |`;
    });
    return `| Skill | Core Category | Source |\n|-------|--------------|--------|\n${rows.join("\n")}`;
  }

  const results = await classifySkillsBatch(skills, token);
  const rows = skills.map((s) => {
    const r = results.get(s) || { core: "Unknown", source: "ai" };
    const sourceLabel =
      r.source === "map" ? "Built-in map" : "AI classified";
    return `| ${s} | **${r.core}** | ${sourceLabel} |`;
  });
  return `| Skill | Core Category | Source |\n|-------|--------------|--------|\n${rows.join("\n")}`;
}

app.listen(PORT, () => {
  console.log(`Skill Mapper Copilot Extension running on port ${PORT}`);
});
