import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const indexPath = path.resolve(
  projectRoot,
  argumentValue("--index") || "audio-production/catalogue/catalogue-index.json"
);
const index = JSON.parse(await readFile(indexPath, "utf8"));
const generate = process.argv.includes("--generate");

for (const [indexNumber, manifest] of index.manifests.entries()) {
  console.log(`Catalogue track ${indexNumber + 1}/${index.manifests.length}: ${manifest}`);
  const args = ["scripts/generate-timed-meditation.mjs", "--manifest", manifest];
  if (generate) args.push("--generate");
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Catalogue stopped at ${manifest}; no retry was attempted.`);
  }
}

console.log(`Catalogue ${generate ? "generation" : "dry run"} completed without retries.`);
