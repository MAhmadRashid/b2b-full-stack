# Autonomous Workflow Rules: Ralph Loop & GSD (Get Shit Done)

The user has explicitly mandated:
**"Saro ma agli baar sa ralph loop or gsd use karna"**
*(In all upcoming features, tasks, and phases, always use the Ralph Loop autonomous cycle and GSD workflow system).*

---

## 1. Core Workflow Mandate

Whenever executing, planning, or implementing any feature or task in this repository:
1. **GSD (Get Shit Done) Framework**:
   - Utilize GSD principles from the local [get-shit-done](file:///d:/Ahmad%20new%5D/get-shit-done) framework.
   - Follow systematic phases: `spec-phase` -> `plan-phase` -> `execute-phase` -> `verify-work` -> `audit-fix`.
   - Maintain concise progress, atomic task units, and ruthless pragmatism.
2. **Ralph Autonomous Loop**:
   - Structure features into right-sized user stories in `ralph/prd.json` following the [ralph skill](file:///d:/Ahmad%20new%5D/.agents/skills/ralph/SKILL.md).
   - Ensure every user story is scoped to fit within a single iteration context window.
   - Acceptance criteria must explicitly include passing tests (`npm test`) and strict type checks (`tsc --noEmit`).
   - Execute the Ralph iteration loop via `npm run ralph` or `npm run ralph:dry` when required.
3. **Git Worktree Runner (gtr)**:
   - Cloned in [`git-worktree-runner`](file:///d:/Ahmad%20new%5D/git-worktree-runner).
   - Use `npm run gtr <command>` or `& "C:\Program Files\Git\bin\bash.exe" git-worktree-runner/bin/gtr <command>`.
   - Isolate parallel task iterations and bugfix branches without polluting the active working tree.

---

## 2. Iteration Boundaries & Story Sizing
- Never attempt monolithic features in one unsegmented step.
- Split every epic into:
  1. Database Schema & Migrations (`prisma`)
  2. Core Backend Services & Auth Checks (`src/lib`)
  3. API Route Endpoints & Validation (`src/app/api`)
  4. Frontend UI Components & State (`src/app/dashboard`)
  5. Automated Verification & Regression Tests (`tests/`)
- Verify `passes: true` in `prd.json` only after confirmed, live automated test passage.
