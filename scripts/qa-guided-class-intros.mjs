// Run with the repository's TypeScript loader. QA_PLAYWRIGHT may point to a
// bundled Playwright installation; no production browser dependency is needed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { YOGA_CLASSES, expandYogaClassSlides, getYogaClassDuration } from "../src/data.ts";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT || "playwright");
const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER ? { executablePath: process.env.QA_BROWSER } : {}) });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const output = path.resolve("test-screenshots/guided-class-intros");
fs.mkdirSync(output, { recursive: true });
const results = [];
const time = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const expectedAction = id => ["before-run", "before-cycling"].includes(id) ? "BEGIN WARM-UP"
  : ["after-run", "after-cycling"].includes(id) ? "BEGIN COOL-DOWN" : id === "gentle-leg-recovery" ? "BEGIN GENTLY" : "START CLASS";

async function contrast() {
  const checks = await page.locator(".guided-class-intro").evaluate(root => {
    const rgb = value => [...value.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(",").map(Number)).filter(values => values.length < 4 || values[3] > 0);
    const luminance = values => values.slice(0, 3).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    return [...root.querySelectorAll("*")].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && getComputedStyle(element).display !== "none").map(element => {
      const style = getComputedStyle(element);
      let backgrounds = [];
      for (let parent = element; parent && !backgrounds.length; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        backgrounds = [...rgb(css.backgroundColor), ...rgb(css.backgroundImage)];
      }
      const foreground = rgb(style.color)[0];
      const ratios = backgrounds.map(bg => { const a = luminance(foreground), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
      return { text: element.textContent.trim().slice(0, 70), ratio: Math.min(...ratios), fontSize: parseFloat(style.fontSize) };
    });
  });
  for (const item of checks) assert.ok(item.ratio >= (item.fontSize >= 24 ? 3 : 4.5), `${item.text}: contrast ${item.ratio}`);
  return Math.min(...checks.map(item => item.ratio));
}

async function browse() {
  await page.getByRole("button", { name: "Yoga", exact: true }).click();
  await page.getByRole("button", { name: "Browse classes" }).click();
}

async function checkIntro(routine, scheme) {
  const slides = expandYogaClassSlides(routine);
  assert.equal(await page.locator("#class-intro-title").innerText(), routine.name);
  assert.equal(await page.locator(".class-intro-stats b").first().innerText(), time(getYogaClassDuration(routine)));
  assert.equal(await page.locator(".class-intro-stats b").last().innerText(), `${slides.length} ${slides.length === 1 ? "movement" : "movements"}`);
  const actual = await page.locator(".class-movement-carousel li").evaluateAll(items => items.map(item => ({ id: item.dataset.movementId, side: item.dataset.side || "" })));
  assert.deepEqual(actual, slides.map(slide => ({ id: slide.movement.id, side: String(slide.side || "") })), "Preview preserves every expanded movement and side in order");
  const start = page.locator(".class-intro-start");
  assert.match(await start.innerText(), new RegExp(expectedAction(routine.id)));
  const box = await start.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 412 && box.y >= 0 && box.y + box.height < 845, "Start fits above navigation");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 412, "No page overflow");
  await page.locator(".class-intro-hero img").evaluate(async image => { await image.decode(); });
  await page.locator(".class-movement-carousel img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: path.join(output, `${routine.id}-${scheme}.png`) });
  let minimumContrast = await contrast();
  await page.locator(".class-intro-evidence summary").click();
  assert.equal(await page.locator(".class-intro-evidence p").innerText(), routine.evidence);
  if (routine.sourceUrl) assert.equal(await page.locator(".class-intro-evidence a").getAttribute("href"), routine.sourceUrl);
  minimumContrast = Math.min(minimumContrast, await contrast());
  await page.locator(".class-intro-evidence summary").click();
  for (const name of ["Warm Grounding", "Lo-fi Limber", "Soft Sunrise"]) {
    const track = page.getByRole("button", { name, exact: true });
    await track.click();
    assert.equal(await track.getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("button", { name: "Music on", exact: true }).click();
  assert.equal(await page.locator('.class-track[aria-pressed="true"]').count(), 0);
  await page.getByRole("button", { name: "Music off", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Stretching music volume" });
  await slider.focus();
  await slider.press("Home");
  await slider.press("ArrowRight");
  assert.equal(await slider.inputValue(), "1");
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.screenshot({ path: path.join(output, `${routine.id}-${scheme}-soundtrack.png`) });
  if (routine.safetyGate) {
    assert.equal(await start.isDisabled(), true);
    const safety = page.getByRole("checkbox");
    await safety.check();
    assert.equal(await start.isEnabled(), true);
    await safety.uncheck();
    assert.equal(await start.isDisabled(), true);
    await safety.check();
  }
  await start.click();
  await page.locator(".yoga-player").waitFor();
  assert.equal(await page.locator(".pose-name-line h1").innerText(), slides[0].movement.name);
  await page.getByRole("button", { name: "Yoga", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: "Yoga", exact: true }).isVisible(), false, "Immersive player hides navigation");
  await page.getByRole("button", { name: "Exit class", exact: true }).click();
  await page.getByRole("button", { name: "Browse classes" }).waitFor();
  results.push({ id: routine.id, scheme, duration: time(getYogaClassDuration(routine)), count: slides.length, action: expectedAction(routine.id), minimumContrast, passed: true });
  console.log(`Passed ${routine.name} (${scheme})`);
}

try {
  await page.goto(process.env.QA_URL || "http://127.0.0.1:5173");
  await page.locator(".xp-collection-overlay").waitFor({ state: "hidden" });
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("zenchad_app_data_v1"));
    data.preferences.reducedMotion = true;
    data.preferences.uiSoundsEnabled = false;
    localStorage.setItem("zenchad_app_data_v1", JSON.stringify(data));
  });
  await page.reload();
  for (const scheme of ["dark", "light"]) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const routine of YOGA_CLASSES) {
      await browse();
      await page.locator(".yoga-class-card").filter({ has: page.getByRole("heading", { name: routine.name, exact: true }) }).getByRole("button", { name: "View class" }).click();
      // The product intentionally locks its dark appearance. Also exercise the
      // legacy light cascade to catch inherited pale-on-pale control rules.
      await page.evaluate(mode => document.documentElement.dataset.appearance = mode, scheme);
      await checkIntro(routine, scheme);
    }
  }
  const custom = { ...YOGA_CLASSES[0], id: "custom-intro-qa", name: "My Evening Flow", timing: "Custom flow", description: "A custom sequence created by you.", evidence: "Keep every pose comfortable.", sourceUrl: "", image: "assets/yoga/intros/daily-reset.webp", steps: [{ movementId: "kneeling-lunge", seconds: 15 }, { movementId: "childs-pose", seconds: 30 }, { movementId: "kneeling-lunge", seconds: 20 }] };
  await page.evaluate(routine => {
    const data = JSON.parse(localStorage.getItem("zenchad_app_data_v1"));
    data.customYogaClasses.push(routine);
    localStorage.setItem("zenchad_app_data_v1", JSON.stringify(data));
  }, custom);
  await page.reload();
  await browse();
  await page.locator(".yoga-class-card").filter({ has: page.getByRole("heading", { name: custom.name, exact: true }) }).getByRole("button", { name: "View class" }).click();
  await checkIntro(custom, "custom");
  await browse();
  await page.locator(".yoga-class-card").filter({ has: page.getByRole("heading", { name: "Before Running", exact: true }) }).getByRole("button", { name: "View class" }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.screenshot({ path: path.join(output, "before-run-small.png"), fullPage: true });
  await page.getByRole("button", { name: "Skip warm-up and start Just Run" }).click();
  assert.equal(await page.locator(".guided-class-intro").count(), 0);
  assert.equal(await page.locator(".yoga-player").count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ results, errors, smallViewport: "passed", standaloneSkip: "passed" }, null, 2));
  console.log("All 13 introductions, both cascades, custom order/repetitions, safety gate, soundtrack controls, launch/exit and small-phone skip passed.");
} finally {
  await browser.close();
}
