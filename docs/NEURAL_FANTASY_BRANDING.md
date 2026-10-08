# Neural Fantasy identity

Sam confirmed **Neural Fantasy** on 2026-10-08, matching the supplied artwork; the pasted brief's “Neuro Fantasy” spelling is superseded.

Assets in `public/assets/branding/neural-fantasy/`:

- `full-title.png`: Sam's original 1448 × 1086 artwork, unchanged. Used for loading and the fitted Android splash.
- `wordmark.png`: transparent mobile title derived from that artwork. Replaces the randomly selected four header fonts.
- `emblem.png`: transparent square launcher emblem derived from the same profile, brain and celestial motifs, without title text.

The built-in imagegen tool prepared the wordmark and emblem. The production assets are saved in the repository; generated originals are retained locally. Android launcher density assets and the favicon are fitted from the emblem without stretching. Android themed icons use a monochrome four-point star corresponding to the supplied title ornament. Android 12+ uses the emblem during the system splash; the Capacitor splash and HTML loading fallback use the full title.

## Asset prompts

**Wordmark:** Use case: background-extraction. Asset type: production mobile header wordmark for Neural Fantasy. Extract ONLY the exact existing words 'Neural Fantasy' and the thin celestial underline/star ornament from the supplied artwork. Preserve the supplied tall elegant fantasy serif lettering, exact spelling, pale silver-white lavender-cyan letter coloring, sharp edges and tasteful subtle luminous details. Remove the entire woman/brain illustration and navy background. Tight wide horizontal composition with minimal transparent padding, suitable for a 190px-wide mobile header. No additional words, no new design, no boxes. Genuine transparent background. Save the image locally and return its file path.

**Emblem:** Use case: compositing. Asset type: Neural Fantasy Android launcher emblem, transparent square. Prepare a compact, recognizable emblem derived directly from the supplied artwork: the existing serene woman's left-facing profile with its flowing luminous violet-cyan hair framed by a simplified brain-shaped celestial energy outline and the prominent four-point star above. No text, no wordmark, no lettering, no background. Preserve the visual identity and colors of the supplied artwork. Simplify fine constellations for legibility at 48px, strong pale profile silhouette and clear blue-violet flowing outline. Center artwork within a square with 12% transparent edge clearance; do not squash the horizontal full title into the icon. Genuine transparency, sharp clean silhouette. Save image locally and return file path.

## Compatibility

- Keep `com.zenchad.minddojo`, the signing certificate, URL scheme, plugin names, notification channel IDs, local-storage and native preference keys unchanged.
- Keep historical backup paths, export filenames and `zenchad-sync` JSON format readable. Visible messages use the new brand.
- Fantasy Shop, Fantasy Guide, Adventure Coach and Fantasy Points/FP are presentation labels. Component names, saved `zenPoints` balances, purchases, rewards and data schemas retain their existing identifiers.
- Retain the equipped avatar, guide illustration and meditation artwork. They are existing feature artwork, not obsolete app wordmarks.
- The supported appearance remains dark, including when Android/the browser requests light mode. Theme accents and system-bar handling remain supported.
- Desktop packaging identifiers and product metadata are unchanged because desktop work was not requested.

## Release

Continue building from `ZenChadAndroid/` and increment both Android versions. Use `NeuralFantasy-<version>-<description>.apk`. Deliver the identical filename into `releases/` and the existing `D:\My Drive\ZenChad` release folder; retain older APKs. The repository and folder paths retain historical names for continuity.
