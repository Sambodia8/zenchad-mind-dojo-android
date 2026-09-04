# Agent Guidelines & User Preferences

## Primary Product Target
- **Android is the default app**: This directory is the sole canonical ZenChad source tree. If the user says "the app" without naming a platform, edit and verify the Android app here.
- **Running Mode identifies the current product**: Preserve the Running Mode implementation and the latest working-tree changes when resolving history or conflicts.
- **No standalone web edition**: React/Vite is the UI asset and browser-QA layer packaged by Capacitor. Do not describe, deploy, fork, or maintain it as a separate web app.
- **Desktop is explicit-only**: Keep `electron/` functional, but do not alter or package desktop behavior unless the user specifically requests the desktop app.
- **Native completion**: After UI/source changes, use Android-focused checks. Run `npm run android:sync` only when native assets need updating or the user requests a build/check that requires it.

## GitHub completion
- After any meaningful Zen Chad change, once the relevant checks pass, commit the changes and push the commit to GitHub unless the user explicitly says not to push.

## Temporary Development Server Lifecycle
- `npm run dev` starts Vite for browser QA and asset work; it is not a permanent background service.
- When automation starts a ZenChad dev server, record the process tree and port, keep it scoped to the current task, and stop the Vite process together with its `npm`/shell wrappers when checks are complete.
- Do not leave duplicate ZenChad dev servers running. Before handing work back, verify that no task-created ZenChad Vite processes remain and that ports 5173/5175 are free unless the user explicitly asked to keep a server running.
- If a previous task may have ended unexpectedly, inspect and clean up stale ZenChad dev-server trees before starting another one.

## Task Execution & Planning Policy
- **Direct Execution for Simple Tasks**: Skip creating implementation plans for straightforward, simple, or direct feature requests. Proceed directly to code modification and verification.
- **When to Plan**: Only create implementation plans for major multi-system architectural refactors or highly ambiguous requests requiring explicit user design decisions.

## Android Browser QA Defaults
- Use a 412 x 915 CSS-pixel viewport for Android UI checks and screenshots. This matches the Pixel-sized layout reference in `design-qa.md`.
- Prefer one focused pass through each state transition. Do not replay full timed routines when a control/state transition can be verified directly.
- Capture only the key evidence screens requested by the task.
