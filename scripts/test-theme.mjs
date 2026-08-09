import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

process.env.TZ = "Europe/London";

const outDir = resolve(".theme-test-output");
const tsc = resolve("node_modules/typescript/bin/tsc");

try {
  execFileSync(process.execPath, [
    tsc,
    "src/themeLogic.ts",
    "--outDir", outDir,
    "--target", "ES2022",
    "--module", "ES2022",
    "--moduleResolution", "Bundler",
    "--skipLibCheck", "true"
  ], { stdio: "inherit" });

  const {
    millisecondsUntilNextAppearanceBoundary,
    nextAppearanceBoundary,
    resolveAppearance
  } = await import(`${pathToFileURL(resolve(outDir, "themeLogic.js")).href}?t=${Date.now()}`);

  const at = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0);

  assert.equal(resolveAppearance("auto", at(2026, 8, 9, 6, 59)), "dark", "06:59 should be dark");
  assert.equal(resolveAppearance("auto", at(2026, 8, 9, 7, 0)), "light", "07:00 should be light");
  assert.equal(resolveAppearance("auto", at(2026, 8, 9, 18, 59)), "light", "18:59 should be light");
  assert.equal(resolveAppearance("auto", at(2026, 8, 9, 19, 0)), "dark", "19:00 should be dark");
  assert.equal(resolveAppearance("light", at(2026, 8, 9, 23, 0)), "light", "manual light ignores the clock");
  assert.equal(resolveAppearance("dark", at(2026, 8, 9, 12, 0)), "dark", "manual dark ignores the clock");

  assert.equal(nextAppearanceBoundary(at(2026, 8, 9, 6, 59)).getTime(), at(2026, 8, 9, 7, 0).getTime());
  assert.equal(nextAppearanceBoundary(at(2026, 8, 9, 7, 0)).getTime(), at(2026, 8, 9, 19, 0).getTime());
  assert.equal(nextAppearanceBoundary(at(2026, 8, 9, 18, 59)).getTime(), at(2026, 8, 9, 19, 0).getTime());
  assert.equal(nextAppearanceBoundary(at(2026, 8, 9, 19, 0)).getTime(), at(2026, 8, 10, 7, 0).getTime());
  assert.equal(millisecondsUntilNextAppearanceBoundary(at(2026, 8, 9, 6, 59)), 60_000);

  // Local Date#setHours/setDate should remain correct across UK DST transition days.
  assert.equal(nextAppearanceBoundary(at(2026, 3, 29, 6, 30)).getHours(), 7);
  assert.equal(nextAppearanceBoundary(at(2026, 10, 25, 19, 30)).getHours(), 7);
  assert.equal(nextAppearanceBoundary(at(2026, 10, 25, 19, 30)).getDate(), 26);

  console.log("Appearance boundary tests passed.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
