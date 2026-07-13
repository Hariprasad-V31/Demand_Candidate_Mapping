# Skill Mapper - Copilot Extension

A GitHub Copilot Extension that classifies candidate skills into core job categories using a **hybrid approach**: known skills are mapped instantly from a built-in database, while unknown skills are classified using AI via the GitHub Models API.

## Setup

### 1. Install dependencies

```bash
cd copilot-extension
npm install
```

### 2. Run the server

```bash
npm start        # production
npm run dev       # development (auto-reload)
```

The server starts on port 3000 (configurable via `PORT` environment variable).

### 3. Register as a GitHub App

1. Go to **Settings > Developer settings > GitHub Apps > New GitHub App**
2. Set the **Callback URL** to your server's public URL
3. Under **Copilot**, set the **Agent endpoint** to `https://your-server.com/api/copilot`
4. Grant the following permissions:
   - Copilot Chat: Read
5. Install the app on your account/organization

### 4. Use in Copilot Chat

Once installed, use it in GitHub Copilot Chat with:

```
@skill-mapper classify Oracle DBA
@skill-mapper map these: Kubernetes, Docker, Ansible
@skill-mapper show Java
@skill-mapper list categories
```

## Commands

| Command | Description |
|---------|-------------|
| `classify <skill>` | Classify a single skill (AI fallback for unknowns) |
| `map these: skill1, skill2, ...` | Batch classify multiple skills |
| `lookup <skill>` | Check if a skill is in the built-in map |
| `show <category>` | Show all skills in a core category |
| `list categories` | List all core skill categories |
| `help` | Show available commands |

## Architecture

```
shared/
  skillMap.js        -- Hardcoded SKILL_MAP (single source of truth)
  aiClassifier.js    -- AI fallback using GitHub Models API
copilot-extension/
  server.js          -- Express server implementing Copilot agent protocol
  package.json
frontend/
  src/               -- Web UI (fallback, runs on GitHub Pages)
```
