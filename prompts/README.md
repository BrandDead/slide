# AI Code Generation Prompts

This directory contains self-contained prompts designed for use with enterprise AI coding models. Each prompt includes all the context, types, existing code references, and design guidelines needed for the AI model to generate 100% usable, production-ready code without access to the codebase.

---

## Prompt Index

| # | File | Target System | Recommended AI Model | Complexity | Files Generated |
|---|------|---------------|---------------------|------------|-----------------|
| 1 | `PROMPT_1_SLIDE_COMBAT_UI.md` | SLIDE Battleship combat grid UI | `deepseek-v3.1:671b-cloud` | High | 8 files (store + 6 components + barrel) |
| 2 | `PROMPT_2_ALCHEMY_LAB_UI.md` | COOK LAB drug crafting UI | `qwen3-coder:480b-cloud` | Medium | 8 files (store + 6 components + barrel) |
| 3 | `PROMPT_3_TERRITORY_MAP_UI.md` | Territory Map with Mapbox | `deepseek-v3.1:671b-cloud` | High | 7 files (store + 5 components + barrel) |
| 4 | `PROMPT_4_AUTH_GANG_ECONOMY_UI.md` | Auth + Gang Mgmt + Economy | `qwen3-coder:480b-cloud` | Medium | 12 files (3 stores + 9 components) |
| 5 | `PROMPT_5_CASINO_MISSIONS_SHELL.md` | Casino + Missions + OSShell | `gpt-oss:120b-cloud` | Medium-High | 13 files (3 stores + 1 type + 9 components) |
| 6 | `PROMPT_6_BACKEND_REALTIME_SERVER.md` | Node.js Socket.IO server | `deepseek-v3.1:671b-cloud` | High | 9 files (full server project) |
| 7 | `PROMPT_7_VISUAL_ASSETS_UI_POLISH.md` | Shared UI + Theme + Hooks | `qwen3-coder:480b-cloud` | Medium | 15+ files (theme + components + hooks) |

**Total files to be generated across all prompts: ~72 files**

---

## Model Selection Rationale

| Model | Best For | Why |
|-------|----------|-----|
| `deepseek-v3.1:671b-cloud` | Complex systems (combat, server, maps) | Largest context window, best at multi-file generation with complex interdependencies |
| `qwen3-coder:480b-cloud` | UI components, stores, standard patterns | Optimized for code generation, excellent at React/TypeScript patterns |
| `gpt-oss:120b-cloud` | Mixed tasks (casino games + mission system) | Good balance of creativity and code quality for game logic |
| `qwen3-vl:235b-cloud` | Visual asset generation, UI review | Multimodal understanding for visual consistency checks |
| `minimax-m2:cloud` | Creative writing (mission descriptions, flavor text) | Strong at narrative and creative content |
| `glm-4.6:cloud` | Documentation, README generation | Good at structured technical writing |

---

## Usage Instructions

1. Copy the entire content of a prompt file.
2. Paste it into the recommended AI model's chat interface.
3. The model will generate all specified files.
4. Copy each generated file into the correct path in the repository.
5. Run `npm run dev` to verify compilation.
6. Test the component in the browser.

---

## Execution Order

For best results, generate prompts in this order:

1. **Prompt 7** (Shared UI) — Creates the foundation that all other components depend on.
2. **Prompt 4** (Auth + Gang + Economy) — Creates the auth system needed to test other features.
3. **Prompt 1** (SLIDE Combat) — Core combat system.
4. **Prompt 2** (Alchemy Lab) — Drug crafting system.
5. **Prompt 3** (Territory Map) — Map integration.
6. **Prompt 5** (Casino + Missions + Shell) — Remaining game modes and navigation.
7. **Prompt 6** (Backend Server) — Real-time multiplayer server.
