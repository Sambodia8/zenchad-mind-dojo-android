# Archived Yoga Visual Review — 2026-08-19

> Preserved during source-tree consolidation. The canonical Android tree now contains a newer Yoga implementation that addresses many of these observations; this is historical review evidence, not the active product plan.

Based on a real-device review of the Yoga flow at the Android reference viewport. The latest local Android build, version 1.6, was installed on the connected phone before the second review. This is a visual proposal only; no app code has been changed.

## Highest priority

- [ ] **Bring every Yoga screen into the shared dark-mode system.** Replace Yoga-specific pale backgrounds, white image panels, green pills and light audio controls with shared appearance tokens. Add explicit dark overrides for the Yoga hero, class cards, ready screen, soundtrack picker, pose stage, builder panels and pose tiles.
- [ ] **Make Mark the visual focus on the Yoga home screen.** Replace the small strip of several poses with a much larger Mark-led hero image. Aim for Mark to occupy roughly half of the hero height, with the pose sequence used as a secondary supporting visual rather than the main subject.
- [ ] **Give the Yoga section the same visual confidence as Home.** Reuse the Home screen’s stronger illustration treatment: larger artwork, clearer focal point, richer contrast, and less empty pale card space.

## Screen-specific visual changes

### Yoga landing screen

- [ ] Increase the hero artwork substantially; the current Mark figures read as a small decorative strip beneath the copy.
- [ ] Test a single large representative pose or portrait of Mark, with the sequence moved into a smaller secondary preview.
- [ ] Reduce the amount of copy above the image so the artwork can grow without making the screen excessively tall.
- [ ] Consider one featured “Start with Mark” class card directly below the hero so the first action feels more visual and immediate.

### Class browser

- [ ] Replace the narrow left thumbnail column with a larger visual block, approximately one-third to one-half of the card width.
- [ ] Stop using the full multi-pose strip as the main thumbnail; it compresses Mark into tiny figures and leaves too much unused white space.
- [ ] Use one representative pose or a deliberately cropped Mark image per class, with consistent subject scale across all eight classes.
- [ ] Keep class duration and focus tags, but reduce text density so the artwork has more room.
- [ ] Avoid truncating class names where possible; use two lines before ellipsising.

### Class ready/detail screen

- [ ] Rework the wide artwork banner so Mark is larger vertically. The current sequence is visible, but individual figures remain small inside a very large empty panel.
- [ ] Try a featured-pose composition: large Mark image on one side, class title and “Mark is your instructor” treatment on the other.
- [ ] Keep the instructor badge, but make it feel attached to the artwork rather than floating in the lower-right corner.
- [ ] Consider a dark image panel or tinted illustration background in dark mode instead of a white canvas.

### Active class/player

- [ ] Increase the active pose image, especially on the 412 × 915 layout; the current figure is readable but has less presence than the surrounding controls.
- [ ] Give the pose stage more vertical priority and reduce competing controls above it.
- [ ] Prevent the floating playback controls and bottom navigation from covering instructional copy or the lower part of the pose card.
- [ ] Consider an immersive player state that hides or minimises the global bottom navigation while a class is running.
- [ ] Make the current pose image, pose name and progress feel like one clear visual unit.

### Routine builder and pose library

- [ ] Consider two columns instead of three on the phone layout so each pose image and title has more room.
- [ ] Allow pose names to wrap to two lines rather than truncating many names with ellipses.
- [ ] Increase the focused pose preview above the grid; the current compact preview is useful but too small to feel like Mark is guiding the choice.
- [ ] Make selected poses more visually obvious with a larger order badge and stronger selected-state contrast.
- [ ] Check that the bottom navigation does not hide the last row of pose tiles while scrolling.

## Visual consistency and polish

- [ ] Define a small Yoga visual token set: dark/light surface, artwork panel, accent green, accent violet, border, shadow and muted text.
- [ ] Standardise artwork treatment: consistent crop rules, transparent-background handling, subject scale and corner radius.
- [ ] Use one clear illustration hierarchy across Yoga: hero artwork > featured class art > pose thumbnail > compact status preview.
- [ ] Match the stronger home-screen contrast and spacing rhythm instead of relying on large pale cards with small artwork.
- [ ] Review the top-bar subtitle and headings so “Yoga with Mark” feels like a named destination, not a separate light-theme mini-app.

## Verification checklist for implementation

- [ ] Check the Yoga landing, browser, ready/detail, active player, pose guide and builder in both Light and Dark modes.
- [ ] Verify the 412 × 915 reference layout with the artwork at its intended larger scale.
- [ ] Check large text/system font scaling so the enlarged artwork does not push the primary action below the fold unexpectedly.
- [ ] Confirm pose instructions, progress, playback controls and bottom navigation remain readable and unobstructed.
- [ ] Recheck contrast for muted copy, green pills, violet accents and illustration panels in Dark mode.

## Evidence captured

Latest version 1.6 review:

- `tmp/yoga-audit-v1.6/01-home-v1.6.png` — Home comparison: the rest of the app is in dark mode and gives its hero artwork strong scale.
- `tmp/yoga-audit-v1.6/02-yoga-home-v1.6.png` — Yoga landing: still light mode, with Mark reduced to a small multi-pose strip.
- `tmp/yoga-audit-v1.6/03-yoga-classes-v1.6.png` — Class browser: the class thumbnail remains compressed and visually secondary.
- `tmp/yoga-audit-v1.6/04-yoga-detail-v1.6.png` — Class ready/detail: large panel, but individual Mark figures remain small.
- `tmp/yoga-audit-v1.6/06-yoga-active-v1.6.png` — Active player: readable pose, but the image and controls compete for vertical space.
- `tmp/yoga-audit-v1.6/07-yoga-builder-v1.6.png` and `tmp/yoga-audit-v1.6/08-yoga-builder-library-v1.6.png` — Builder and pose grid review.

- `tmp/yoga-audit/01-home-clean.png` — Home comparison: Mark is large and clearly the hero subject.
- `tmp/yoga-audit/02-yoga-home.png` — Yoga landing: Mark appears as a small multi-pose strip.
- `tmp/yoga-audit/03-yoga-classes.png` — Class browser: compressed thumbnails and excess white image space.
- `tmp/yoga-audit/04-yoga-class-detail.png` — Class ready/detail: wide sequence with small individual figures.
- `tmp/yoga-audit/07-yoga-active.png` — Active player: pose is readable but controls compete for vertical space.
- `tmp/yoga-audit/10-yoga-builder.png` and `tmp/yoga-audit/11-yoga-builder-library.png` — Builder and pose grid review.

## Evidence limits

- The latest build confirms the reported mismatch directly: Home is dark while Yoga remains light. Several Yoga-specific surfaces also use hard-coded light colours and need explicit appearance-aware styling.
- I did not complete a timed class or verify audio, animation, screen-reader output, or every completion state.
