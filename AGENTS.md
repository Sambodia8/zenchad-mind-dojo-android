# Agent Guidelines & User Preferences

## Task Execution & Planning Policy
- **Direct Execution for Simple Tasks**: Skip creating implementation plans for straightforward, simple, or direct feature requests. Proceed directly to code modification and verification.
- **When to Plan**: Only create implementation plans for major multi-system architectural refactors or highly ambiguous requests requiring explicit user design decisions.

## Android Browser QA Defaults
- Use a 412 x 915 CSS-pixel viewport for Android UI checks and screenshots. This matches the Pixel-sized layout reference in `design-qa.md`.
- Prefer one focused pass through each state transition. Do not replay full timed routines when a control/state transition can be verified directly.
- Capture only the key evidence screens requested by the task.
