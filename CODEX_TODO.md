# ZenChad — Codex Feature TODO

This is the current feature backlog for Codex. Keep changes incremental and preserve the existing local-first architecture unless a task genuinely requires otherwise.

## Explicitly out of scope

- [ ] **DO NOT implement Beacon / live location sharing.** The Strava-style safety beacon idea has been deliberately scrapped because it adds too much backend/cloud complexity.

---

## 1. ZenPoints currency

### Goal
Add a spendable currency earned primarily through meditation, while keeping existing XP/levels separate.

- [ ] Add persisted `zenPoints` balance.
- [ ] Add persisted `lifetimeZenPoints` total so spending does not erase lifetime progress.
- [ ] Award ZenPoints when a meditation is completed.
- [ ] Keep ZenPoints completely separate from XP and level progression.
- [ ] Show current ZenPoints somewhere visible but unobtrusive in the main UI/HUD.
- [ ] Add a small celebratory feedback animation when ZenPoints are earned.
- [ ] Make all new fields backwards-compatible with existing saved `AppData`.

### Starting economy
Use these as initial values, but keep prices/rewards centralized so they are easy to rebalance later.

- Meditation completion: `5 ZP + 1 ZP per completed minute`.
- Example: a 10-minute meditation earns 15 ZP.

---

## 2. Zen Shop

### Goal
Create a shop where ZenPoints can be spent on collectibles, cosmetics and forgiving gamification mechanics.

- [ ] Add a dedicated **Zen Shop** screen/route.
- [ ] Create a centralized shop catalogue rather than hard-coding items into UI components.
- [ ] Add atomic purchase logic: check balance -> deduct ZenPoints -> grant item -> persist.
- [ ] Add purchase history/inventory data.
- [ ] Add satisfying but short purchase feedback/animation.
- [ ] Prevent duplicate purchases where an item is intended to be unique.

### Priority shop items

- [ ] **Mala beads** for building/customising a mala bracelet.
- [ ] **Streak Freeze** consumables.

### Candidate shop items
These are ideas rather than hard requirements; implement after the priority items and keep the catalogue extensible.

- [ ] Different bead materials/colours such as tiger eye, jade and amethyst.
- [ ] Rare/celestial beads.
- [ ] Special guru bead.
- [ ] Tassels and charms.
- [ ] ZenChad avatar cosmetics/clothing.
- [ ] Dojo decorations.
- [ ] Meditation bell visual skins.
- [ ] Celebration animation variants.
- [ ] Roulette-wheel / challenge-wheel skins.

Avoid locking core wellbeing/meditation functionality behind purchases. Purchases should mainly be cosmetic, collectible or forgiving mechanics.

---

## 3. Mala bracelet collection

### Goal
Give ZenPoints a long-term collectible use by letting the user gradually build a mala bracelet.

- [ ] Create persisted mala/bracelet state.
- [ ] Support a traditional 108-bead layout, plus a guru bead.
- [ ] Allow purchased beads to be placed into bracelet slots.
- [ ] Allow swapping/rearranging owned beads without repurchasing them.
- [ ] Visually show incomplete vs completed bead slots.
- [ ] Make the bracelet feel like a collection/progression object rather than a plain inventory list.

---

## 4. Streak Freezes

### Goal
Let a purchased Streak Freeze automatically protect a meditation streak when one day is missed.

- [ ] Persist the number of owned Streak Freezes.
- [ ] Integrate freeze handling into the existing streak-date calculation.
- [ ] If exactly one eligible day is missed and a freeze is available, consume one automatically instead of resetting the streak.
- [ ] Clearly tell the user when a freeze was consumed.
- [ ] Never require the user to remember to manually activate the freeze after missing a day.
- [ ] Add tests around date boundaries, multiple missed days and exhausted freeze inventory.

---

## 5. Automatic dark mode

### Goal
Add a proper dark theme that can switch automatically at night, similar in spirit to Google Maps.

### Theme modes

- [ ] `Light`
- [ ] `Dark`
- [ ] `Auto`

### Implementation

- [ ] Add a persisted `themeMode: "light" | "dark" | "auto"` setting.
- [ ] Refactor hard-coded UI colours into shared theme/CSS variables before styling individual screens.
- [ ] Create a complete dark palette: deep charcoal/navy background, slightly lighter cards/surfaces, readable softened light text, existing ZenChad accent colours preserved where practical.
- [ ] Avoid pure black for every surface unless visually necessary.
- [ ] Theme every existing screen, modal, dialog, card, form field, button, progress bar, achievement/reward UI and celebration state.
- [ ] Match Android status bar/navigation bar colours to the active theme.
- [ ] Re-evaluate Auto mode when the app launches and resumes.
- [ ] Ensure the theme can change while the app remains open across the day/night boundary.

### Auto behaviour

- [ ] Auto mode should become dark at night and light during the day without requiring location permission.
- [ ] Keep the day/night rule centralized and easy to change.
- [ ] Initial fallback schedule: approximately 19:00–07:00 local device time.
- [ ] If Android/system scheduled dark-mode information can be used reliably, prefer respecting that where appropriate while still providing predictable ZenChad Auto behaviour.

---

## 6. Random timed-meditation achievements

### Concept
Add achievements/challenges that ask the user to meditate during a specific time window. Example: **complete a meditation between 14:00 and 15:00**.

The challenge time should vary from day to day so it creates novelty rather than becoming another fixed routine.

### Daily challenge generation

- [ ] Generate one randomized meditation time window for the day.
- [ ] Use a one-hour window initially, e.g. `14:00–15:00`.
- [ ] Randomize within sensible waking hours rather than generating ridiculous challenges at 03:00.
- [ ] Keep the allowed random-time bounds configurable in one place.
- [ ] Initial reasonable default bounds: roughly 09:00–21:00 local time.
- [ ] Generate/store the day's challenge deterministically enough that reopening the app does not change today's window.
- [ ] Generate a new window when the local calendar day changes.
- [ ] Handle timezone/date changes sensibly.

### Completion / achievement logic

- [ ] Count the challenge as completed when a qualifying meditation is started within the active time window and successfully completed.
- [ ] Do not award it for an abandoned/cancelled meditation.
- [ ] Award the challenge only once per day.
- [ ] Persist completion history.
- [ ] Surface the current window prominently enough that the user can actually notice it.
- [ ] Give a distinct celebration/reward when the timed challenge is completed.
- [ ] Consider a longer-term badge/achievement ladder for repeated successes, e.g. first timed challenge, 5 completed, 10 completed, 25 completed, etc.
- [ ] Optionally award bonus ZenPoints for successful timed challenges; keep the amount configurable if added.

### Reminder notification

- [ ] Add an opt-in notification toggle for the current timed-meditation challenge.
- [ ] The user must be able to use the challenge without enabling notifications.
- [ ] Schedule a local Android notification for the randomized window.
- [ ] Default reminder should fire at or shortly before the beginning of the window.
- [ ] Tapping the notification should open ZenChad in the relevant meditation/challenge context.
- [ ] If today's challenge is already completed, cancel any remaining notification for it.
- [ ] Reschedule correctly after app restart/device reboot if needed by the existing notification architecture.
- [ ] Request Android notification permission only when needed and handle denial gracefully.
- [ ] Do not spam repeated notifications during the one-hour window.

### Example copy

> **TIME CHALLENGE**  
> Meditate between **2:00 PM and 3:00 PM** today.

Notification example:

> **Your Zen window is opening**  
> Today's timed meditation challenge is 2:00–3:00 PM.

---

## 7. Outdoor activity tracking — no Beacon

### Goal
Retain the useful Strava-inspired exercise metrics without any live-location sharing or cloud safety feature.

- [ ] Support at least `Run`, `Walk` and `Bike` activity types.
- [ ] Track elapsed time.
- [ ] Track distance.
- [ ] Track current and average running pace.
- [ ] Track current and average cycling speed.
- [ ] Track elevation and total ascent/descent where device GPS data is adequate.
- [ ] Show a simple route/map only if it can remain local and does not create unnecessary backend complexity.
- [ ] Make background/screen-off tracking reliable using the appropriate Android foreground location service if/when this feature is implemented.
- [ ] Integrate the Bike activity tracker with the existing Bike Quest rather than replacing Bike Quest's gamified preparation/reward flow.
- [ ] Keep all recorded activity data local by default.

**Do not add live sharing, safety contacts, public tracking URLs or a Beacon backend.**

---

## Suggested implementation order

1. [ ] ZenPoints data model + earning + HUD.
2. [ ] Zen Shop + purchase/inventory foundation.
3. [ ] Mala bracelet.
4. [ ] Streak Freezes.
5. [ ] Theme token refactor + Light/Dark/Auto mode.
6. [ ] Timed-meditation daily challenge data model/UI.
7. [ ] Timed-challenge Android local notifications.
8. [ ] Outdoor activity data model/UI.
9. [ ] Native Android background GPS tracking and Bike Quest integration.

## Codex implementation notes

- Follow `AGENTS.md`.
- Prefer direct implementation for each focused item rather than producing another large planning document.
- Complete and verify one coherent feature slice at a time.
- Preserve existing user data with migrations/defaults whenever persisted models change.
- Keep configurable values (ZenPoint rewards, shop prices, challenge time bounds, dark-mode hours, achievement thresholds) centralized rather than scattered through components.
- QA Android layouts at the repo's standard 412 x 915 CSS-pixel reference size.
