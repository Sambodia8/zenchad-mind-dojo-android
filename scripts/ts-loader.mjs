import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".")) {
    const parentPath = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const candidate = resolvePath(parentPath, `${specifier}.ts`);
    try {
      await access(candidate);
      return nextResolve(pathToFileURL(candidate).href, context);
    } catch {
      // Let Node resolve the original specifier when it is not a TypeScript module.
    }
  }
  return nextResolve(specifier, context);
}
