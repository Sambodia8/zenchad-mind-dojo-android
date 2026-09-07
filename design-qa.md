# Yoga with Mark redesign QA

## Evidence

- Source visual truth: `design-reference/yoga-landing-selected-option-1.png`
- Rendered implementation: `test-screenshots/yoga-landing-redesign-browser-412x915.png`
- Side-by-side comparison: `tmp/yoga-design-qa-comparison.png`
- Viewport: 412 × 915 CSS pixels, device scale factor 1
- Source pixels: 842 × 1872, normalized to 412 × 915 for comparison
- Implementation pixels: 412 × 915
- State: Yoga landing, dark appearance, standard text size
- Real-device evidence: `test-screenshots/yoga-redesign-device/01-yoga-landing.png` through `05-yoga-builder.png`

## Full-view comparison evidence

The implementation preserves the selected mockup's hierarchy: compact app chrome, large display heading on the left, a dominant seated Mark on the right, cosmic-dark teal/indigo atmosphere, two paired actions, and persistent app navigation. Mark's scale and vertical placement were increased after the first comparison so his face and seated body now carry the hero rather than reading as a small strip image.

## Focused-region evidence

No separate crop was needed because the equal-size 412 × 915 comparison keeps the heading, hero face, paragraph, action labels, icons, and navigation legible in one view. The browser and class-detail screens were also inspected directly at 412 × 915 to verify cover crops and text contrast.

## Required fidelity surfaces

- Fonts and typography: passed. A restrained Georgia display face recreates the editorial heading while the existing app sans-serif remains readable for controls. Heading wrapping and optical weight match the selected direction closely.
- Spacing and layout rhythm: passed. Hero, Mark, and paired actions fit above the bottom navigation without horizontal overflow. The implementation keeps slightly more breathing room around the action dock for reliable tap targets.
- Colors and visual tokens: passed. Yoga now uses shared light/dark appearance tokens. Dark mode joins the main app with near-black navy, teal, sage and restrained violet; Light and Auto resolve correctly.
- Image quality and asset fidelity: passed. The final Mark hero and four class-cover families use production raster assets. Mark's current longer hair, rectangular glasses and beard remain recognisable. All assets are sized for the rendered slots and no placeholders remain.
- Copy and content: passed. The required landing labels are present and the class cards use concise timing, duration, title, benefit and action copy. Evidence and muscle detail are on the class-detail screen.

## Interaction and responsive checks

- Landing actions, class browser, class detail, class start, exit, Tap/Timed selector, sound toggle, recovery safety gate, and routine-builder pose selection passed.
- Immersive class mode hides the global top bar and bottom navigation, restores them on exit, and keeps its own exit, title, progress, sound and advance controls visible.
- Builder renders a two-column 45-pose grid at phone width, supports two-line names, and uses a larger focused-pose preview.
- Light, Dark and Auto appearance modes passed at 412 × 915.
- No browser console errors were present.

## Comparison history

1. Initial pass: P2 — Mark was too small/low, body copy crossed into the artwork, and the generated hero contained a checkerboard edge. Fixed by producing a true-alpha asset, narrowing the paragraph, and increasing/lifting Mark.
2. Active-class pass: P2 — fixed controls overlapped the sensation panel. Fixed by making the player a viewport grid with a scrollable pose stage and a dedicated control row above the safe area.
3. Android pass: P2 — Android's system bars reduced the usable landing height and initially obscured the action labels. Fixed with a compact phone-height composition that preserves Mark's scale and keeps both actions above the app navigation.
4. Dark-mode pass: P3 — the inherited pale back control was replaced with the shared Yoga surface and border tokens.
5. Final pass: no actionable P0/P1/P2 differences remain.

## Follow-up polish

- P3: the coded hero uses a simpler orbital motif than the generated mockup so it can adapt cleanly between Light and Dark appearances.
- P3: the action tiles include short subtitles for clarity; the selected mockup showed a slightly more minimal treatment.

final result: passed
