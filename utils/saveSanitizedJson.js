import fs from "node:fs/promises";
import path from "node:path";

function safeName(name) {
  // Avoid accidental nested paths / illegal filename characters
  return String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

/**
 * Saves a sanitized JSON object to:
 *   <outputRoot>/<folderName>/<fileBase>.sanitized.json
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