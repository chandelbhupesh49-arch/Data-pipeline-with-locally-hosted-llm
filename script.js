import { mergeRecordsByFieldPriority } from "./utils/unify.js"
import { priorityByPath } from "./utils/unify.js";
import "dotenv/config";
import { disconnect } from "./utils/prisma.js"
import { createDataInDB } from "./utils/createDataInDB.js";
import { getNamesInDB } from "./utils/getNamesInDB.js";
import { processPdfFromUrl } from "./utils/processPdfFromUrl.js";
import { processJsonFromUrl } from "./utils/processJsonFromUrl.js";
import { sanitizeUnifiedJson, sanitizeGenericAndClassifyPolymer } from "./utils/sanitizeJson.js";
import { saveSanitizedJson, saveJsonInFolder } from "./utils/saveSanitizedJson.js";
import { canonicalizeUnitsByFieldPath, collectCanonicalUnitMismatches } from "./utils/unitNormalization.js";
import { finalSchemaTransformation } from "./utils/finalSchema.js";
import logger from "./utils/logger/logger.js";

function setFolderName(obj, folderName) {
    if (!obj || typeof obj !== "object") return obj;
    if (!obj.general || typeof obj.general !== "object") obj.general = {};
    if (!obj.general.name || typeof obj.general.name !== "object") obj.general.name = { value: null };
    obj.general.name.value = folderName ?? null;
    return obj;
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PER_FILE_MODE = (process.env.PER_FILE_MODE || "false").toLowerCase() === "true";
const PER_FILE_OUTPUT_DIR = process.env.PER_FILE_OUTPUT_DIR || "./per_file_sanitized";

// Keywords for determining source (matching is already handled at server, but we need to extract source)
const PDF_NAME_KEYWORDS = ["supplier", "mdc", "ul", "campusplastics","marketing"];
const SPECIALCHEM_KEYWORD = "specialchem";

/**
 * Extracts the matched keyword from filename to determine the source
 * Server already filters files, but we need to identify which keyword matched for source tracking
 * 
 * @param {string} filename - The filename to check
 * @param {string[]} keywords - Array of keywords to match against
 * @returns {string|null} - The matched keyword or null
 */


/**
 * Extracts the matched keyword from filename to determine the source.
 * New behavior:
 *  - Prefer matching ONLY in the part(s) after " - " (dash separator).
 *  - Use whole-word-ish matching so "ul" doesn't match inside "Ultradur".
 *
 * @param {string} filename
 * @param {string[]} keywords
 * @returns {string|null}
 */

function getMatchedKeyword(filename, keywords) {
    if (!filename || !Array.isArray(keywords) || keywords.length === 0) return null;

    const normalize = (s) =>
        String(s)
            .normalize("NFKC")
            .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
            .trim();

    // Normalize + remove extension
    const base = normalize(filename).replace(/\.[^.]+$/, "");
    const lower = base.toLowerCase();

    // Split on a wide set of dash-like characters (hyphen/en/em/non-breaking/minus/fullwidth)
    const DASH = /[\-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D]/;
    const parts = lower.split(new RegExp(`\\s*${DASH.source}\\s*`, "g")).map((p) => p.trim()).filter(Boolean);

    const suffix = parts.length > 1 ? parts[parts.length - 1] : lower;

    // Tokenize suffix into alphanumeric tokens
    const tokens = normalize(suffix)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean);

    // Normalize keywords (trim) and prefer longer first
    const normKeywords = keywords
        .map((k) => normalize(k))
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

    const variantsFor = (kw) => {
        const k = kw.toLowerCase();
        if (k.length >= 6) {
            // simple plural/singular tolerance
            return k.endsWith("s") ? [k, k.slice(0, -1)] : [k, `${k}s`];
        }
        return [k];
    };

    // 1) Match in suffix tokens (preferred)
    for (const originalKw of normKeywords) {
        for (const v of variantsFor(originalKw)) {
            if (tokens.includes(v)) return originalKw;
        }
    }

    // 2) Fallback: tokenize whole filename and try again
    const allTokens = normalize(lower)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean);

    for (const originalKw of normKeywords) {
        for (const v of variantsFor(originalKw)) {
            if (allTokens.includes(v)) return originalKw;
        }
    }

    return null;
}

/**
 * Fetches assets from the API endpoint
 * Returns an object with folder names as keys and arrays of filenames as values
 * 
 * @returns {Promise<Object>} - Object mapping folder names to arrays of filenames
 */
async function fetchAssets() {
    try {
        const response = await fetch(`${BASE_URL}/assets`);
        if (!response.ok) {
            throw new Error(`Failed to fetch assets from ${BASE_URL}/assets: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        // console.error("Error fetching assets:", error);
        logger.error("Error fetching assets:", error?.message ?? error);
        throw error;
    }
}

// Main execution flow
// Step 1: Fetch assets from API endpoint
// console.log(`Fetching assets from ${BASE_URL}/assets...`);
logger.info(`Fetching assets from ${BASE_URL}/assets...`);
const assetsData = await fetchAssets();
// console.log(`Received assets for ${Object.keys(assetsData).length} folders\n`);
logger.info(`Received assets for ${Object.keys(assetsData).length} folders\n`);

// Step 2: Get array of names from database to check for existing entries
const names = new Set(await getNamesInDB());

// Step 3: Process each folder
for (const [folderName, filenames] of Object.entries(assetsData)) {
    const formedJsons = [];

    // Check if folder already exists in database
    if (names.has(folderName)) {
        // console.log(`${folderName} already exists in database \n`);
        logger.info(`${folderName} already exists in database \n`);
        continue;
    }

    // Process all files in this folder (sorted for deterministic merge order)
    const sortedFilenames = [...filenames].sort();
    await makeEntryForThisFolder(folderName, sortedFilenames, formedJsons);
}

await disconnect();

/**
 * Processes all files for a given folder
 * 
 * CHANGED FLOW:
 * - Now receives folder name and array of filenames from API instead of reading from filesystem
 * - Files are accessed via URLs: ${base_url}/data/${folder_name}/${file_name}
 * - PDFs: Download from URL, parse with pdf-parse, then call OpenAI API via text_to_json
 * - JSONs: Download from URL, then call OpenAI API for transformation
 * 
 * @param {string} folderName - The name of the folder (used as key in assets response)
 * @param {string[]} filenames - Array of filenames for this folder (already filtered by server)
 * @param {Array} formedJsons - Array to collect processed JSON data
 */
async function makeEntryForThisFolder(folderName, filenames, formedJsons) {
    // console.log(`Processing folder: ${folderName} with ${filenames.length} files`);
    logger.info(`Processing folder: ${folderName} with ${filenames.length} files`);

    // Loop through all files in this folder
    for (const fileName of filenames) {
        // Determine file type and source keyword
        const isPdf = fileName.toLowerCase().endsWith(".pdf");
        const isJson = fileName.toLowerCase().endsWith(".json");

        if (isPdf) {
            // For PDFs: Extract source keyword from filename
            // Server already filtered files, so we know it contains one of the keywords
            const matchedKeyword = getMatchedKeyword(fileName, PDF_NAME_KEYWORDS);

            if (!matchedKeyword) {
                // console.log(`Skipping PDF (no keyword matched): ${fileName}`);
                logger.info(`Skipping PDF (no keyword matched): ${fileName}`);
                continue;
            }

            // Construct PDF URL: ${base_url}/data/${folder_name}/${file_name}
            const pdfUrl = `${BASE_URL}/data/${folderName}/${fileName}`;
            // console.log(`Processing PDF: ${pdfUrl} (source: ${matchedKeyword})`);
            logger.info(`Processing PDF: ${pdfUrl} (source: ${matchedKeyword})`);

            try {
                // Process PDF from URL: downloads, parses, and converts to JSON via OpenAI
                let jsonData = await processPdfFromUrl(pdfUrl, matchedKeyword, folderName);

                //! console.log(`raw pdf to json : ${pdfUrl} : `, jsonData);

                // Sanitize + canonicalize per-file AND for merge.
                // Note: sanitizeUnifiedJson drops top-level `source`, but merge needs it for priority logic.

                // console.log("RAW volume_resistivity:", JSON.stringify(jsonData?.electrical?.volume_resistivity, null, 2));

                let sanitizedSingle = sanitizeUnifiedJson(jsonData);
                sanitizedSingle = canonicalizeUnitsByFieldPath(sanitizedSingle, { strict: false });
                sanitizedSingle = sanitizeGenericAndClassifyPolymer(sanitizedSingle);
                setFolderName(sanitizedSingle, folderName);
                if (jsonData && typeof jsonData === "object" && jsonData.source) {
                    sanitizedSingle = { ...sanitizedSingle, source: jsonData.source };
                }

                // console.log(`-------sanitizedSingle (pdf)-------------: \n`, sanitizedSingle);
                // console.log("SANITIZED volume_resistivity:", JSON.stringify(sanitizedSingle?.electrical?.volume_resistivity, null, 2));

                if (PER_FILE_MODE) {
                    const mismatches = collectCanonicalUnitMismatches(sanitizedSingle);
                    if (mismatches.length) {
                        // console.log(`[unit-mismatch] per-file ${folderName}/${fileName}:`);
                        logger.warn(`[unit-mismatch] per-file ${folderName}/${fileName}:`);
                        for (const m of mismatches) {
                            // console.log(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
                            logger.warn(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
                        }
                    }
                    const outPath = await saveSanitizedJson(PER_FILE_OUTPUT_DIR, folderName, fileName, sanitizedSingle);
                    // console.log(`Saved per-file sanitized JSON -> ${outPath}\n`);
                    logger.info(`Saved per-file sanitized JSON -> ${outPath}`);
                }

                formedJsons.push(sanitizedSingle);
            } catch (err) {
                // console.error(`Failed to process PDF ${pdfUrl}:`, err);
                logger.error(`Failed to process PDF ${pdfUrl}: ${err?.message ?? err}`);
            }

            continue;
        }

        if (isJson) {
            // For JSONs: Check if it's specialchem (server already filtered, but double-check)
            if (!fileName.toLowerCase().includes(SPECIALCHEM_KEYWORD)) {
                // console.log(`Skipping JSON (not Specialchem): ${fileName}`);
                logger.info(`Skipping JSON (not Specialchem): ${fileName}`);
                continue;
            }

            // Construct JSON URL: ${base_url}/data/${folder_name}/${file_name}
            const jsonUrl = `${BASE_URL}/data/${folderName}/${fileName}`;
            // console.log(`Processing JSON: ${jsonUrl}`);
            logger.info(`Processing JSON: ${jsonUrl}`);

            try {
                // Process JSON from URL: downloads, then transforms via OpenAI API
                const transformedJson = await processJsonFromUrl(jsonUrl, SPECIALCHEM_KEYWORD, folderName);

                // Sanitize + canonicalize per-file AND for merge.
                // Note: sanitizeUnifiedJson drops top-level `source`, but merge needs it for priority logic.

                //! console.log(`raw transformed json : ${jsonUrl} : `, transformedJson);

                // console.log("RAW volume_resistivity:", JSON.stringify(transformedJson?.electrical?.volume_resistivity, null, 2));


                let sanitizedSingle = sanitizeUnifiedJson(transformedJson,{ strict: false });
                sanitizedSingle = canonicalizeUnitsByFieldPath(sanitizedSingle, { strict: false });
                sanitizedSingle = sanitizeGenericAndClassifyPolymer(sanitizedSingle);
                setFolderName(sanitizedSingle, folderName);
                if (transformedJson && typeof transformedJson === "object" && transformedJson.source) {
                    sanitizedSingle = { ...sanitizedSingle, source: transformedJson.source };
                }

                // console.log("SANITIZED volume_resistivity:", JSON.stringify(sanitizedSingle?.electrical?.volume_resistivity, null, 2));

                // console.log(`--------------sanitizedSingle (json)--------------------: \n`, sanitizedSingle);

                if (PER_FILE_MODE) {
                    const mismatches = collectCanonicalUnitMismatches(sanitizedSingle);
                    if (mismatches.length) {
                        // console.log(`[unit-mismatch] per-file ${folderName}/${fileName}:`);
                        logger.warn(`[unit-mismatch] per-file ${folderName}/${fileName}:`);
                        for (const m of mismatches) {
                            // console.log(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
                            logger.warn(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
                        }
                    }
                    const outPath = await saveSanitizedJson(PER_FILE_OUTPUT_DIR, folderName, fileName, sanitizedSingle);
                    // console.log(`Saved per-file sanitized JSON -> ${outPath}\n`);
                    logger.info(`Saved per-file sanitized JSON -> ${outPath}`);
                }

                formedJsons.push(sanitizedSingle);
            } catch (err) {
                // console.error(`Failed to process JSON ${jsonUrl}:`, err);
                logger.error(`Failed to process JSON ${jsonUrl}: ${err?.message ?? err}`);
            }

            continue;
        }

        // Skip files that are neither PDF nor JSON
        // console.log(`Skipping file (not PDF or JSON): ${fileName}`);
        logger.info(`Skipping file (not PDF or JSON): ${fileName}`);
    }

    // Unify all processed JSONs using priority logic (same as before)
    const unifiedJson = mergeRecordsByFieldPriority(formedJsons, priorityByPath);
    // console.log(`---------unified-json-------------------\n`, unifiedJson);

    // Sanitize the unified JSON to fix any parsing errors before storing in database
    // This fixes issues like: decimal comma (13,5 -> 13.5), leading/trailing special chars, etc.
    let sanitizedJson = await sanitizeUnifiedJson(unifiedJson, { strict: false });
    sanitizedJson = sanitizeGenericAndClassifyPolymer(sanitizedJson);
    setFolderName(sanitizedJson, folderName);


    // Required mismatch report (should end up empty after canonicalization)
    const finalMismatches = collectCanonicalUnitMismatches(sanitizedJson);
    if (finalMismatches.length) {
        // console.log(`[unit-mismatch] merged final.json for folder ${folderName}:`);
        logger.warn(`[unit-mismatch] merged final.json for folder ${folderName}:`);
        for (const m of finalMismatches) {
            // console.log(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
            logger.warn(`  - ${m.path}: "${m.unit}" != "${m.canonical}"`);
        }
    } else {
        // console.log(`[unit-mismatch] merged final.json for folder ${folderName}: none`);
        logger.info(`[unit-mismatch] merged final.json for folder ${folderName}: none`);
    }

    // final json transformation
    const finalJson = await finalSchemaTransformation(sanitizedJson);

    if (PER_FILE_MODE) {
        // const finalPath = await saveJsonInFolder(PER_FILE_OUTPUT_DIR, folderName, "final.json", sanitizedJson);
        const finalPath = await saveJsonInFolder(PER_FILE_OUTPUT_DIR, folderName, "final.json", finalJson);
        // console.log(`Saved unified final JSON -> ${finalPath} \n`);
        logger.info(`\nSaved unified final JSON -> ${finalPath} \n`);
    }

    const flag = await createDataInDB(finalJson, folderName, folderName);


    if (flag) {
        // console.log(`Added data for folder: ${folderName} successfully`);
        logger.info(`Added data for folder: ${folderName} successfully`);
    }


}        