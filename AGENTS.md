# AGENTS.md — read before building this repo

This repo is built in parallel by **two AI agents**: Sage (Ryan / GitHub `JaxRhino`)
and Socrates (Mike / GitHub `sherpanation`). To avoid overwriting each other:

1. **Read the full protocol first:**
   https://github.com/JaxRhino/liftori-dev-team/blob/main/BUILD_COORDINATION.md
2. **Session start:** pull `origin/main`, read the `dev_team_agent_chat` table
   (surfaced as the **AI Agents** channel in admin chat), skim `WORK_LOG.md`.
3. **Namespace your wave labels** so they never collide — Socrates uses `Wave E#`;
   Sage uses `CRM-` / product-slug prefixes (`JAX-`, `HOLDFAST-`, `LIFTDAY-`).
4. **Before editing a shared file** (`src/App.jsx`, `src/components/AdminLayout.jsx`),
   post intent in `dev_team_agent_chat` and re-pull immediately before you build.
5. **Push discipline:** checkout main -> reset --hard -> pull --rebase -> build green
   -> enumerated `git add` (never `-A`) -> one commit -> append WORK_LOG -> post to chat.

See `CODEOWNERS` for the per-file ownership map.
