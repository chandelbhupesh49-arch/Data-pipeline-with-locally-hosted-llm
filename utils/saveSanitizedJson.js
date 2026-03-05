import fs from "node:fs/promises";
import path from "node:path";

function safeName(name) {
  // Avoid accidental nested paths / illegal filename characters
  return String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

/**
 * Saves a sanitized JSON object to:
 *   <outputRoot>/<folderName>/<fileBase>.json
 */
export async function saveSanitizedJson(outputRoot, folderName, originalFileName, jsonObj) {
  const folderSafe = safeName(folderName);
  const fileSafe = safeName(path.basename(originalFileName));

  const fileBase = fileSafe.replace(/\.(pdf|json)$/i, "");
  const outDir = path.resolve(outputRoot, folderSafe);
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, `${fileBase}.json`);
  await fs.writeFile(outPath, JSON.stringify(jsonObj, null, 2), "utf8");

  return outPath;
}

export async function saveJsonInFolder(outputRoot, folderName, outFileName, jsonObj) {
  const folderSafe = safeName(folderName);
  const outDir = path.resolve(outputRoot, folderSafe);
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, safeName(outFileName));
  await fs.writeFile(outPath, JSON.stringify(jsonObj, null, 2), "utf8");

  return outPath;
}

/**
 * Save raw LLM JSON per material & source to:
 *   <outputRoot>/<materialName>/<materialName> - <source>.json
 */
export async function saveRawLlmJson(outputRoot, materialName, source, jsonObj) {
  const materialSafe = safeName(materialName || "unknown_material");
  const sourceLabel = source ? String(source) : "unknown_source";

  const baseFileName = safeName(
    materialName ? `${materialName} - ${sourceLabel}` : sourceLabel
  );

  const outDir = path.resolve(outputRoot, materialSafe);
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, `${baseFileName}.json`);
  await fs.writeFile(outPath, JSON.stringify(jsonObj, null, 2), "utf8");

  return outPath;
}

