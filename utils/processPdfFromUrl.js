import { pdf_url_to_json } from "./text_to_json.js";
import { fetch as undiciFetch, Agent } from "undici";
import { jsonrepair } from "jsonrepair";
import fs from "node:fs";
import path from "node:path";
import { saveRawLlmJson } from "./saveSanitizedJson.js";


const dispatcher = new Agent({
    headersTimeout: 20 * 60 * 1000, // 10 min
    bodyTimeout: 20 * 60 * 1000,
});

const RAW_LLM_SAVE =
    (process.env.RAW_LLM_SAVE || "false").toLowerCase() === "true";
const RAW_LLM_SAVE_OUTPUT_DIR =
    process.env.RAW_LLM_SAVE_OUTPUT_DIR || "./raw_llm_save";

const OCR_OUTPUT_SAVE =
    (process.env.OCR_OUTPUT_SAVE || "false").toLowerCase() === "true";
const OCR_OUTPUT_SAVE_OUTPUT_DIR =
    process.env.OCR_OUTPUT_SAVE_OUTPUT_DIR || "./ocr_streams";


const PROG_BAR_WIDTH = 30;
let _cursorHidden = false;

function hideCursor() {
    if (!_cursorHidden) {
        process.stdout.write("\x1B[?25l"); // hide cursor
        _cursorHidden = true;
    }
}
function showCursor() {
    if (_cursorHidden) {
        process.stdout.write("\x1B[?25h"); // show cursor
        _cursorHidden = false;
    }
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function barString(done, total) {
    const ratio = total > 0 ? done / total : 0;
    const filled = clamp(Math.round(ratio * PROG_BAR_WIDTH), 0, PROG_BAR_WIDTH);
    return "█".repeat(filled) + "░".repeat(PROG_BAR_WIDTH - filled);
}

function progressUpdate(label, done, total) {
    hideCursor();
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${label} ${done}/${total} ${barString(done, total)}`);
}

function progressFinish(label, total) {
    // Print one final full bar and move to the next line (keeps it on screen)
    progressUpdate(label, total, total);
    process.stdout.write(" completed!\n");
}

process.on("exit", showCursor);

process.on("SIGINT", () => {   // Ctrl+C
    showCursor();
    process.exit(130);
});

process.on("uncaughtException", (e) => {
    showCursor();
    throw e; // keep default crash behavior after restoring cursor
});

function safeName(name) {
    return String(name ?? "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .trim() || "unnamed";
}

function getMaterialAndFileFromPdfUrl(pdfUrl) {
    const urlObj = new URL(pdfUrl);
    const parts = urlObj.pathname.split("/").filter(Boolean);

    const pdfFileName = decodeURIComponent(parts[parts.length - 1] || "");
    const materialName = decodeURIComponent(parts[parts.length - 2] || "unknown_material");

    return { materialName, pdfFileName };
}


function safeJsonParse(maybeJson) {
    if (maybeJson && typeof maybeJson === "object") {
        if (Array.isArray(maybeJson)) throw new Error("Top-level JSON must be an object, got array");
        return maybeJson;
    }

    if (typeof maybeJson !== "string") {
        throw new Error(`LLM output not string/object: ${typeof maybeJson}`);
    }

    let s = maybeJson.trim();

    // Strip code fences
    s = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    // If model added leading/trailing junk, try to isolate outermost {...}
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
        s = s.slice(first, last + 1);
    }

    // First attempt: strict parse
    try {
        const obj = JSON.parse(s);
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            throw new Error("Top-level JSON must be an object");
        }
        return obj;
    } catch (e1) {
        // Second attempt: repair then parse
        try {
            const repaired = jsonrepair(s); // fixes missing commas, quotes, trailing commas, etc.
            const obj = JSON.parse(repaired);
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
                throw new Error("Top-level JSON must be an object");
            }
            return obj;
        } catch (e2) {
            throw new Error(
                `JSON parse failed. directErr=${e1.message}; repairErr=${e2.message}`
            );
        }
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function previewText(x, n = 1200) {
    if (x == null) return "";
    const s = typeof x === "string" ? x : JSON.stringify(x);
    return s.length > n ? s.slice(0, n) + "…(truncated)" : s;
}

function looksTruncatedJson(s) {
    if (typeof s !== "string") return false;
    // quick heuristic: missing closing brace
    const trimmed = s.trim();
    if (!trimmed.includes("{")) return false;
    if (!trimmed.endsWith("}")) return true;

    // brace balance heuristic (rough, but helpful)
    let bal = 0;
    for (const ch of trimmed) {
        if (ch === "{") bal++;
        else if (ch === "}") bal--;
    }
    return bal !== 0;
}



// function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// function previewText(x, n = 1200) {
//   if (x == null) return "";
//   const s = typeof x === "string" ? x : JSON.stringify(x);
//   return s.length > n ? s.slice(0, n) + "…(truncated)" : s;
// }



function normalizeToTemplate(template, candidate) {
    if (template === null) {
        if (candidate === null) return null;
        const t = typeof candidate;
        return (t === "string" || t === "number" || t === "boolean") ? candidate : null;
    }

    if (Array.isArray(template)) {
        if (!Array.isArray(candidate)) return [];
        if (template.length === 0) return [];
        return candidate.map((x) => normalizeToTemplate(template[0], x));
    }

    if (typeof template === "object") {
        const out = {};
        const c = (candidate && typeof candidate === "object") ? candidate : {};
        for (const k of Object.keys(template)) {
            out[k] = normalizeToTemplate(template[k], c[k]);
        }
        return out; // ✅ extra keys dropped
    }

    return null;
}


function schemaFromTemplate(template) {
    if (template === null) {
        return {
            anyOf: [
                { type: "null" },
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
            ],
        };
    }

    if (Array.isArray(template)) {
        return {
            type: "array",
            items: template[0] ? schemaFromTemplate(template[0]) : {},
        };
    }

    if (typeof template === "object") {
        const properties = {};
        const required = Object.keys(template);
        for (const k of required) properties[k] = schemaFromTemplate(template[k]);
        return {
            type: "object",
            properties,
            required,
            additionalProperties: false,
        };
    }

    return { type: typeof template }; // "string" | "number" | "boolean"
}


export const outputSchema = {
    source: null,
    general: {
        name: { value: null },
        internal_genics_name: { value: null },
        suppliers_trade_name: { value: null },
        supplier: { value: null },
        alternative_names: { value: null },
        chemical_family: { value: null },
        polymer_type: { value: null },
        generic_type: { value: null },
        filler: { value: null },
        filler_percent: { value: null, unit: null },
        other_additives: { value: null },
        processing: { value: null },
        delivery_form: { value: null },
        regional_availability: { value: null },
        description: { value: null },
        application_space: { value: null },
        est_price: { value: null, unit: null },
        avrg_carbon_footprint: { value: null, unit: null },
        certifications_and_compliance: { value: null }
    },

    mechanical: {
        tensile_modulus: { value: null, unit: null, test_condition: null, test_method: null },
        stress_at_break: { value: null, unit: null, test_condition: null, test_method: null },
        strain_at_break: { value: null, unit: null, test_condition: null, test_method: null },
        flexural_modulus: { value: null, unit: null, test_condition: null, test_method: null },
        flexural_strength: { value: null, unit: null, test_condition: null, test_method: null },
        flexural_strain_at_flexural_strength: { value: null, unit: null, test_condition: null, test_method: null },
        charpy_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
        charpy_impact_strength_minus_30c: { value: null, unit: null, test_condition: null, test_method: null },
        charpy_notched_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
        charpy_notched_impact_strength_minus_30c: { value: null, unit: null, test_condition: null, test_method: null },
        izod_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
        izod_impact_strength_minus_30c: { value: null, unit: null, test_condition: null, test_method: null }
    },

    physical: {
        density: { value: null, unit: null, test_method: null },
        humidity_absorption: { value: null, unit: null, test_method: null },
        water_absorption: { value: null, unit: null, test_condition: null, test_method: null }
    },

    rheological: {
        melt_volume_flow_rate_mvr: { value: null, unit: null, test_condition: null, test_method: null },
        density_melt: { value: null, unit: null },
        specific_heat_capacity_melt: { value: null, unit: null },
        thermal_conductivity_melt: { value: null, unit: null },
        molding_shrinkage_normal: { value: null, unit: null, test_condition: null, test_method: null },
        molding_shrinkage_parallel: { value: null, unit: null, test_condition: null, test_method: null }
    },

    processing: {
        drying_temperature_circulating_air_dryer: { value: null, unit: null },
        drying_time_circulating_air_dryer_min: { value: null, unit: null },
        drying_time_circulating_air_dryer_max: { value: null, unit: null },
        residual_moisture_content_min: { value: null, unit: null, test_method: null },
        residual_moisture_content_max: { value: null, unit: null, test_method: null },
        melt_temperature_min: { value: null, unit: null },
        melt_temperature_max: { value: null, unit: null },
        mold_temperature_min: { value: null, unit: null },
        mold_temperature_max: { value: null, unit: null },
        ejection_temperature: { value: null, unit: null },
        permitted_residence_time_prt_min: { value: null, unit: null },
        permitted_residence_time_prt_max: { value: null, unit: null }
    },

    electrical: {
        relative_permittivity_100hz: { value: null, test_condition: null, test_method: null },
        relative_permittivity_1mhz: { value: null, test_condition: null, test_method: null },
        dissipation_factor_100hz: { value: null, unit: null, test_condition: null, test_method: null },
        dissipation_factor_1mhz: { value: null, unit: null, test_condition: null, test_method: null },
        volume_resistivity: { value: null, unit: null, test_condition: null, test_method: null },
        surface_resistivity: { value: null, unit: null, test_condition: null, test_method: null },
        electric_strength: { value: null, unit: null, test_method: null, test_condition: null },
        comparative_tracking_index_cti: { value: null, unit: null, test_method: null },
        comparative_tracking_index_cti_plc: { value: null, unit: null, test_method: null }
    },

    thermal: {
        melting_temperature_10c_per_min: { value: null, unit: null, test_condition: null, test_method: null },
        temp_of_deflection_under_load_1_80_mpa: { value: null, unit: null, test_method: null },
        temp_of_deflection_under_load_0_45_mpa: { value: null, unit: null, test_method: null },
        coeff_of_linear_therm_expansion_cte_parallel: { value: null, unit: null, test_condition: null, test_method: null },
        coeff_of_linear_therm_expansion_cte_normal: { value: null, unit: null, test_condition: null, test_method: null },
        vicat_softening_temperature: { value: null, unit: null, test_condition: null, test_method: null },
        inherent_flame_resistance: { value: null, unit: null },
        flame_retardant_fr_rating: { value: null },
        flame_rating_ul_94: { value: null, unit: null, test_condition: null, test_method: null },
        burning_behavior_yellow_card_available: { value: null },
        burning_rate_thickness_1_mm: { value: null, unit: null, test_method: null },
        oxygen_index: { value: null, unit: null, test_condition: null, test_method: null },
        glow_wire_flammability_index_gwfi: { value: null, unit: null, test_condition: null, test_method: null }
    },

    chemical: {
        hydrolysis_resistant_hr: { value: null }
    }
};

/**
 * Read a newline-delimited JSON (NDJSON) stream from undici fetch Response.body.
 * Yields one *line* at a time (without the trailing newline).
 */
async function* iterNdjsonLines(body) {
    if (!body) return;

    const decoder = new TextDecoder();
    let buffer = "";

    // undici's fetch uses a WHATWG ReadableStream, but in some environments it can be async-iterable.
    if (typeof body.getReader === "function") {
        const reader = body.getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);
                if (line.trim()) yield line;
            }
        }
        // flush remaining decoder bytes
        buffer += decoder.decode();
    } else if (Symbol.asyncIterator in body) {
        for await (const chunk of body) {
            if (typeof chunk === "string") {
                buffer += chunk;
            } else {
                buffer += decoder.decode(chunk, { stream: true });
            }
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);
                if (line.trim()) yield line;
            }
        }
        buffer += decoder.decode();
    } else {
        throw new Error("Unsupported response body type; cannot stream NDJSON");
    }

    if (buffer.trim()) yield buffer;
}



async function performULStreaming(pdfUrl, source) {
    const base = process.env.DEEPSEEK_OCR_2_SERVER_BASE_URL;

    const urlObj = new URL(pdfUrl);
    const pdf_filename = decodeURIComponent(urlObj.pathname.split("/").pop() || ""); // e.g. "CELANEX 3216 - Ul.pdf"

    const reachablePdfUrl = encodeURI(pdfUrl);

    const response = await undiciFetch(`${base}/extract/ul/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            pdf_url: reachablePdfUrl,
            pdf_filename,          // ✅ NEW
        }),
        dispatcher,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`UL stream server error ${response.status}: ${errText}`);
    }

    const pageTexts = [];
    let sawAnyPage = false;

    let totalPages = 0;
    let pagesDone = 0;
    const label = "Pages done : ";

    try {
        for await (const line of iterNdjsonLines(response.body)) {
            let msg;
            try { msg = JSON.parse(line); } catch { continue; }

            if (msg?.event === "meta") {
                totalPages = Number(msg.pages ?? 0);
                // show 0/total immediately
                if (totalPages > 0) progressUpdate(label, pagesDone, totalPages);
                continue;
            }

            if (msg?.event === "page_start") continue;

            if (msg?.event === "page") {
                sawAnyPage = true;
                const pageNo = Number(msg.page ?? 0);
                const text = msg.text ?? "";
                if (pageNo > 0) pageTexts[pageNo - 1] = text;


                //! progress update :
                if (totalPages > 0) {
                    pagesDone = clamp(pageNo, 0, totalPages);
                    progressUpdate(label, pagesDone, totalPages);
                }

                continue;
            }

            if (msg?.event === "page_error") {
                console.warn(`UL page error (page ${msg.page}): ${msg.error}`);
                continue;
            }

            if (msg?.event === "error") {
                throw new Error(`UL stream error: ${msg.error}`);
            }
        }

        const extracted = pageTexts.filter((t) => (t ?? "").trim()).join("\n\n");
        if (!sawAnyPage || !extracted.trim()) throw new Error("UL stream produced no text");

        if (OCR_OUTPUT_SAVE) {
            try {
                const { materialName, pdfFileName } = getMaterialAndFileFromPdfUrl(pdfUrl);
                const folderSafe = safeName(materialName);
                const sourceLabel = source ? String(source) : "ul";

                const materialBase =
                    materialName && materialName !== "unknown_material"
                        ? materialName
                        : pdfFileName.replace(/\.(pdf|json)$/i, "") || "ocr_output";

                const fileBase = safeName(`${materialBase} - ${sourceLabel}`);

                const dir = path.resolve(OCR_OUTPUT_SAVE_OUTPUT_DIR, folderSafe);
                const filePath = path.join(dir, `${fileBase}.txt`);

                await fs.promises.mkdir(dir, { recursive: true });
                await fs.promises.writeFile(filePath, extracted, "utf8");
            } catch (e) {
                console.warn("Failed to save UL OCR extracted text:", e);
            }
        }

        return extracted;

    } finally {
        showCursor();
    }
}



async function performOCRStreaming(pdfUrl, source) {
    const base = process.env.DEEPSEEK_OCR_2_SERVER_BASE_URL;
    const reachablePdfUrl = encodeURI(pdfUrl);

    const response = await undiciFetch(`${base}/extract/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_url: reachablePdfUrl }),
        dispatcher,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OCR stream server error ${response.status}: ${errText}`);
    }

    const pageTexts = [];
    let sawAnyPage = false;

    let totalPages = 0;
    let pagesDone = 0;
    const label = "Pages done : ";

    try {
        for await (const line of iterNdjsonLines(response.body)) {
            let msg;
            try {
                msg = JSON.parse(line);
            } catch (e) {
                console.warn("Skipping invalid NDJSON line (not JSON):", line.slice(0, 200));
                continue;
            }

            if (msg?.event === "meta") {
                totalPages = Number(msg.pages ?? 0);
                if (totalPages > 0) progressUpdate(label, pagesDone, totalPages);
                continue;
            }

            if (msg?.event === "page_start") {
                // console.log(`OCR page started: ${msg.page}`);
                continue;
            }

            if (msg?.event === "page") {
                sawAnyPage = true;
                const pageNo = Number(msg.page ?? 0);
                const text = (msg.text ?? "");
                if (pageNo > 0) pageTexts[pageNo - 1] = text;

                if (totalPages > 0) {
                    pagesDone = clamp(pageNo, 0, totalPages);
                    progressUpdate(label, pagesDone, totalPages);
                }

                continue;
            }

            //! can be added for future improvements 
            // if (msg?.event === "page") {
            //     sawAnyPage = true;
            //     const rawPage = Number(msg.page ?? 0);
            //     const idx = rawPage >= 1 ? rawPage - 1 : rawPage; // 1-based or 0-based
            //     const textChunk = String(msg.text ?? "");

            //     pageTexts[idx] = (pageTexts[idx] ?? "") + textChunk; // append (future-proof)
            //     continue;
            // }

            if (msg?.event === "page_error") {
                console.warn(`OCR page error (page ${msg.page}): ${msg.error}`);
                continue;
            }

            if (msg?.event === "error") {
                throw new Error(`OCR stream error: ${msg.error}`);
            }
        }

        const extracted_text = pageTexts.filter((t) => (t ?? "").trim()).join("\n\n");

        if (!sawAnyPage || !extracted_text.trim()) {
            throw new Error("OCR stream completed but produced no extracted text");
        }

        if (OCR_OUTPUT_SAVE) {
            try {
                const { materialName, pdfFileName } = getMaterialAndFileFromPdfUrl(pdfUrl);
                const folderSafe = safeName(materialName);
                const sourceLabel = source ? String(source) : "ocr";

                const materialBase =
                    materialName && materialName !== "unknown_material"
                        ? materialName
                        : pdfFileName.replace(/\.(pdf|json)$/i, "") || "ocr_output";

                const fileBase = safeName(`${materialBase} - ${sourceLabel}`);

                const dir = path.resolve(OCR_OUTPUT_SAVE_OUTPUT_DIR, folderSafe);
                const filePath = path.join(dir, `${fileBase}.txt`);

                await fs.promises.mkdir(dir, { recursive: true });
                await fs.promises.writeFile(filePath, extracted_text, "utf8");
            } catch (e) {
                console.warn("Failed to save OCR extracted text:", e);
            }
        }

        return extracted_text;

    } finally {
        showCursor();
    }
}

async function performOCR(pdfUrl, source) {
    const useStreaming = (process.env.DEEPSEEK_OCR_STREAMING ?? "true").toLowerCase() !== "false";

    // Prefer streaming to avoid long "time to first byte" waits on large PDFs
    if (useStreaming) {
        try {
            return await performOCRStreaming(pdfUrl, source);
        } catch (e) {
            console.warn(
                `Streaming OCR failed for ${pdfUrl}. Falling back to non-streaming /extract. Reason:`,
                e?.message ?? e
            );
        }
    }

    // Legacy (non-streaming) endpoint
    try {
        const base = process.env.DEEPSEEK_OCR_2_SERVER_BASE_URL;
        const reachablePdfUrl = encodeURI(pdfUrl);

        const response = await undiciFetch(`${base}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf_url: reachablePdfUrl }),
            dispatcher,
        });

        // If server returned an error, read the body for debugging
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OCR server error ${response.status}: ${errText}`);
        }

        const res = await response.json();
        const extracted_text = res?.data;

        if (!extracted_text) {
            throw new Error(`No extracted text in response: ${JSON.stringify(res)}`);
        }

        return extracted_text;
    } catch (error) {
        console.error(
            `Error processing PDF from URL ${pdfUrl} in DEEPSEEK-OCR-2 BLOCK:`,
            error
        );
        throw error;
    }
}



async function makeJSONfromExtractedTextUsingLLM(extractedText, pdfUrl, source, materialName) {

    const isUL = String(source).toLowerCase() === "ul";

    //     const ulRules = isUL ? `
    // UL MODE (VERY IMPORTANT)
    // - The text is pre-cleaned from a UL Prospector comparison table.
    // - Generic column values have been removed.
    // - Only use values that appear after "VALUE=" in the evidence lines.
    // - If a property has no VALUE= line, return null (do NOT guess, do NOT use other numbers).
    // - Ignore any disclaimer/noise lines.
    // - Treat each evidence line as authoritative: SECTION, PROPERTY/FIELD, CONDITION, VALUE, UNIT, TEST_METHOD.

    // CRITICAL: MAP UL PROPERTY NAMES TO THIS SCHEMA (EXACT MAPPING)
    // Use these mappings ONLY when you see a matching PROPERTY line.

    // GENERAL
    // - SECTION=General FIELD=Name -> general.name.value
    // - SECTION=General FIELD=Description -> general.description.value
    // - SECTION=General FIELD=Availability -> general.regional_availability.value
    // - Certifications:
    //   - If description contains "UL94" or "V-0" etc, add "UL94 V-0" to general.certifications_and_compliance.value
    //   - If any line mentions "UL Yellow Card" (not in your current cleaned output), add "UL Yellow Card"
    //   - Keep comma-separated unique items.

    // PHYSICAL
    // - PROPERTY="Density / Specific Gravity" -> physical.density (value/unit/test_method) and put CONDITION into test_condition if present
    // - PROPERTY contains "Water Absorption" -> physical.water_absorption (value/unit/test_condition/test_method)

    // RHEOLOGICAL
    // - PROPERTY contains "Melt Mass-Flow Rate" or "MFR" -> rheological.melt_volume_flow_rate_mvr ONLY IF the CONDITION mentions "MVR"
    // - PROPERTY contains "Melt Volume-Flow Rate" or "MVR" -> rheological.melt_volume_flow_rate_mvr
    // - PROPERTY contains "Molding Shrinkage":
    //     - CONDITION contains "Flow" -> rheological.molding_shrinkage_parallel
    //     - CONDITION contains "Across Flow" or "Transverse" -> rheological.molding_shrinkage_normal

    // MECHANICAL
    // - PROPERTY="Tensile Modulus" -> mechanical.tensile_modulus
    // - PROPERTY="Tensile Strength" AND CONDITION contains "Break" -> mechanical.stress_at_break
    // - PROPERTY="Tensile Elongation" AND CONDITION contains "Break" -> mechanical.strain_at_break
    // - PROPERTY="Flexural Modulus" -> mechanical.flexural_modulus
    // - PROPERTY="Flexural Strength" -> mechanical.flexural_strength
    // - PROPERTY contains "Charpy Notched" AND CONDITION contains "23°C" -> mechanical.charpy_notched_impact_strength_23c
    // - PROPERTY contains "Charpy Notched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_notched_impact_strength_minus_30c
    // - PROPERTY contains "Charpy Unnotched" AND CONDITION contains "23°C" -> mechanical.charpy_impact_strength_23c
    // - PROPERTY contains "Charpy Unnotched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_impact_strength_minus_30c
    // - PROPERTY contains "Notched Izod" AND CONDITION contains "23°C" -> mechanical.izod_impact_strength_23c
    // - PROPERTY contains "Notched Izod" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.izod_impact_strength_minus_30c

    // THERMAL
    // - PROPERTY contains "Glass Transition Temperature" -> thermal.glass_transition_temperature (NOTE: your schema does not have this. So ignore unless you add it.)
    // - PROPERTY contains "Melting Temperature" -> thermal.melting_temperature_10c_per_min
    // - PROPERTY contains "Deflection Temperature Under Load":
    //     - CONDITION contains "0.45" -> thermal.temp_of_deflection_under_load_0_45_mpa
    //     - CONDITION contains "1.8" -> thermal.temp_of_deflection_under_load_1_80_mpa
    // - PROPERTY="CLTE" or contains "Coeff" and "Therm" and "Expansion":
    //     - CONDITION contains "Flow" or "Parallel" -> thermal.coeff_of_linear_therm_expansion_cte_parallel
    //     - CONDITION contains "Transverse" or "Normal" -> thermal.coeff_of_linear_therm_expansion_cte_normal
    // - PROPERTY contains "Flame Rating" or UL94 -> thermal.flame_rating_ul_94 (keep VALUE like V-0/5VA as string)

    // ELECTRICAL
    // - PROPERTY contains "Dielectric Constant":
    //     - CONDITION contains "100 Hz" -> electrical.relative_permittivity_100hz
    //     - CONDITION contains "1 MHz" -> electrical.relative_permittivity_1mhz
    // - PROPERTY contains "Dissipation Factor":
    //     - CONDITION contains "100 Hz" -> electrical.dissipation_factor_100hz
    //     - CONDITION contains "1 MHz" -> electrical.dissipation_factor_1mhz
    // - PROPERTY contains "Volume Resistivity" -> electrical.volume_resistivity
    // - PROPERTY contains "Surface Resistivity" -> electrical.surface_resistivity
    // - PROPERTY contains "Dielectric Strength" -> electrical.electric_strength
    // - PROPERTY contains "Comparative Tracking Index" OR "CTI" (and if UNIT=V) -> electrical.comparative_tracking_index_cti
    // - If CTI is shown as PLC (no V unit), put it into electrical.comparative_tracking_index_cti_plc instead.

    // PROCESSING (Injection section)
    // - If SECTION=Injection PROPERTY="Drying Temperature" -> processing.drying_temperature_circulating_air_dryer
    // - If SECTION=Injection PROPERTY="Drying Time" and CONDITION contains "Desiccant Dryer":
    //     -> processing.drying_time_circulating_air_dryer_min/max:
    //        - If VALUE is a single number, set both min=max=value
    //        - If VALUE is a range, split into min/max
    // - If SECTION=Injection FIELD="Suggested Max Moisture" and VALUE contains "<":
    //     -> processing.residual_moisture_content_max.value = "< 0.020" (string), unit="%" (if present)
    // - If SECTION=Injection PROPERTY contains "Processing (Melt) Temp" and VALUE is a range:
    //     -> processing.melt_temperature_min/max from range
    // - If SECTION=Injection PROPERTY contains "Mold Temperature" and VALUE is a range:
    //     -> processing.mold_temperature_min/max from range\

    // A) PROCESSING: Melt temp min/max
    // If you see:
    // SECTION=Injection | PROPERTY=Drying Time | CONDITION=Processing (Melt) Temp | VALUE=<V> | UNIT=<U>
    // Then:
    // - Parse <V> as a range/single using the existing RANGE PARSING rules.
    // - Write results to:
    //   processing.melt_temperature_min.value
    //   processing.melt_temperature_max.value
    // - Set unit for BOTH min and max to <U> if <U> exists (usually "°C").

    // B) PROCESSING: Mold temp min/max
    // If you see:
    // SECTION=Injection | PROPERTY=Drying Time | CONDITION=Mold Temperature | VALUE=<V> | UNIT=<U>
    // Then:
    // - Parse <V> as a range/single using RANGE PARSING.
    // - Write results to:
    //   processing.mold_temperature_min.value
    //   processing.mold_temperature_max.value
    // - Set unit for BOTH to <U> if <U> exists (usually "°C").

    // IMPORTANT: “Melt Temperature, Optimum” and “Mold Temperature, Optimum” are NOT the min/max range fields.
    // - Do NOT use “…Optimum” lines for *_min/max unless the range lines are missing.
    // - If only Optimum exists, leave min/max null (do not guess).

    // C) ELECTRICAL: Comparative Tracking Index (CTI) 250 V
    // If you see:
    // SECTION=Electrical | PROPERTY=Arc Resistance | CONDITION=Comparative Tracking Index | VALUE=<V> | UNIT=V | TEST_METHOD=<M>
    // Then:
    // - Set electrical.comparative_tracking_index_cti.value = <V> (number if pure number)
    // - Set electrical.comparative_tracking_index_cti.unit = "V"
    // - Set electrical.comparative_tracking_index_cti.test_method = <M> if present
    // - Set electrical.comparative_tracking_index_cti.test_condition = "Comparative Tracking Index" (or keep null if your schema doesn’t include it)

    // Do NOT leave this field null if that evidence line exists.

    // D) ELECTRICAL: Relative permittivity test_condition
    // If you see:
    // SECTION=Electrical | PROPERTY=Dielectric Constant | CONDITION=100 Hz | VALUE=<V> | TEST_METHOD=<M>
    // Then:
    // - electrical.relative_permittivity_100hz.value = <V>
    // - electrical.relative_permittivity_100hz.test_condition = "100 Hz"
    // - electrical.relative_permittivity_100hz.test_method = <M>

    // If you see:
    // SECTION=Electrical | PROPERTY=Dielectric Constant | CONDITION=1 MHz | VALUE=<V> | TEST_METHOD=<M>
    // Then:
    // - electrical.relative_permittivity_1mhz.value = <V>
    // - electrical.relative_permittivity_1mhz.test_condition = "1 MHz"
    // - electrical.relative_permittivity_1mhz.test_method = <M>

    // Do NOT set test_condition to null when CONDITION explicitly contains “100 Hz” or “1 MHz”.

    // ADDITIONAL INFORMATION
    // - SECTION=Additional Information PROPERTY="Emission of Organic Compounds" -> ignore (not in schema)

    // CHOOSING BETWEEN MULTIPLE LINES
    // - If multiple rows map to the same schema field, choose the one with:
    //   1) a specific CONDITION (e.g., "23°C", "-30°C", "0.45 MPa") over blank
    //   2) a TEST_METHOD present over missing
    //   3) a numeric VALUE over "--"
    //   Do NOT overwrite a better row with a worse row.

    // RANGE PARSING (MANDATORY)
    // - Apply range parsing ONLY for the min/max schema fields listed in the prompt:
    //   - If VALUE is "240 to 260" -> min=240 max=260
    //   - If VALUE is "< 0.020" -> min=null max="< 0.020" (as STRING because of "<")
    //   - If VALUE is "4.0" and field expects min/max -> min=4.0 max=4.0

    //   UL MODE - EXTRA HARD RULES (PATCH)
    // - SCIENTIFIC NOTATION RULE: If VALUE= contains "E" or "e" (example: 3.3E-3, 1.0E+16), keep it EXACTLY as a STRING. Do NOT convert it to decimals.
    // - MULTI-HIT RULE: If multiple VALUE= lines exist for the same property name, prefer:
    //   (1) the line whose CONDITION looks most specific (contains °C, hr, Hz, MPa, mm, RH, etc),
    //   (2) otherwise the first VALUE= line.
    // - UL→SCHEMA ALIAS MAP (use these exact mappings):
    //   - density ← "Density / Specific Gravity"
    //   - tensile_modulus ← "Tensile Modulus"
    //   - flexural_modulus ← "Flexural Modulus"
    //   - flexural_strength ← "Flexural Strength"
    //   - electric_strength ← "Dielectric Strength"
    //   - volume_resistivity ← "Volume Resistivity"
    //   - surface_resistivity ← "Surface Resistivity"
    //   - flame_rating_ul_94 ← "Flame Rating" (keep thickness like "0.38 mm" in test_condition)

    // ` : "";

    //     const ulRules = isUL ? `
    // UL MODE (VERY IMPORTANT)
    // - The text is pre-cleaned from a UL Prospector comparison table.
    // - Generic column values have been removed.
    // - Only use values that appear after "VALUE=" in the evidence lines.
    // - If a property has no VALUE= line, return null (do NOT guess, do NOT use other numbers).
    // - Ignore any disclaimer/noise lines.
    // - Treat each evidence line as authoritative: SECTION, PROPERTY/FIELD, CONDITION, VALUE, UNIT, TEST_METHOD.

    // CRITICAL: DO NOT "NORMALIZE" VALUES
    // - NEVER compute or re-format values.
    // - If VALUE contains scientific notation (E/e), keep it EXACTLY as in VALUE= (string).
    // - If VALUE contains a range like "0.90 to 1.2" keep it EXACTLY as in VALUE= (string).
    // - Do NOT replace "3.6E-5" with "0.000036".
    // - Do NOT replace "0.90 to 1.2" with "0.9".

    // GENERAL (explicit field mappings)
    // - SECTION=General FIELD=Name -> general.name.value
    // - SECTION=General FIELD=Description -> general.description.value
    // - SECTION=General FIELD=Availability -> general.regional_availability.value
    // - SECTION=General FIELD=Manufacturer / Supplier -> general.supplier.value
    // - SECTION=General FIELD=Processing Method -> general.processing.value
    // - SECTION=General FIELD=Forms -> general.delivery_form.value
    // - SECTION=General FIELD=Generic Symbol -> general.generic_type.value

    // CERTIFICATIONS (keep only real certifications, not test methods)
    // - general.certifications_and_compliance.value may include ONLY:
    //   - "UL94 V-0" (or UL94 with rating if present)
    //   - "UL Yellow Card" (if any FIELD mentions "UL Yellow Card")
    // - DO NOT add ISO/IEC/ASTM/EN/UL 746B/60695/etc into certifications (those are test methods).

    // FILLER + FILLER_PERCENT (CRITICAL FIX)
    // Goal: general.filler.value must be the MATERIAL (e.g., "Glass Fiber"), NOT "Weight".
    // Goal: general.filler_percent.value must be the number (e.g., 15) and unit "%".

    // Priority order (highest wins; do NOT overwrite a better one with a worse one):
    // 1) If you see:
    //    - SECTION=General FIELD=Filler -> general.filler.value
    //    - SECTION=General FIELD=Filler Percent -> general.filler_percent.value/unit
    //    - SECTION=General PROPERTY=Filler Percent -> general.filler_percent.value/unit (same meaning)
    // 2) Else, if you see SECTION=General FIELD=Filler / Reinforcement with VALUE that contains BOTH a filler material + a percent,
    //    e.g. "Glass Fiber, 15% Filler by Weight":
    //    - general.filler.value = "Glass Fiber"
    //    - general.filler_percent.value = 15
    //    - general.filler_percent.unit = "%"
    //    IMPORTANT: If FIELD=Filler / Reinforcement VALUE is ONLY "Weight" (or "Volume"), that is NOT a filler material.
    //    In that case: DO NOT set general.filler to "Weight". Leave filler null unless you find a real filler elsewhere.
    // 3) Else, parse from any General FIELD that contains "UL Yellow Card" if it includes filler info like:
    //    "Glass Fiber, 15% Filler by Weight"
    //    Same extraction as rule #2.
    // 4) Else, parse from Description ONLY if it explicitly states something like:
    //    "15% glass-fiber reinforced"
    //    Then:
    //    - filler = "Glass Fiber"
    //    - filler_percent = 15 "%"
    //    (This is allowed because it is explicitly present in the text.)

    // PHYSICAL
    // - PROPERTY="Density / Specific Gravity" -> physical.density (value/unit/test_method)
    // - PROPERTY contains "Water Absorption" -> physical.water_absorption (value/unit/test_condition/test_method)

    // RHEOLOGICAL
    // - PROPERTY contains "Melt Mass-Flow Rate" or "MFR" -> rheological.melt_volume_flow_rate_mvr ONLY IF the CONDITION mentions "MVR"
    // - PROPERTY contains "Melt Volume-Flow Rate" or "MVR" -> rheological.melt_volume_flow_rate_mvr
    // - PROPERTY contains "Molding Shrinkage":
    //     - CONDITION contains "Flow" -> rheological.molding_shrinkage_parallel
    //     - CONDITION contains "Across Flow" or "Transverse" -> rheological.molding_shrinkage_normal
    //   IMPORTANT: if VALUE contains "to" (range), keep it as STRING exactly (do not reduce to first number).

    // MECHANICAL
    // - PROPERTY="Tensile Modulus" -> mechanical.tensile_modulus
    // - PROPERTY="Tensile Strength"-> mechanical.stress_at_break 
    // - PROPERTY="Tensile Elongation"-> mechanical.strain_at_break
    // - PROPERTY="Flexural Modulus" -> mechanical.flexural_modulus
    // - PROPERTY="Flexural Strength" -> mechanical.flexural_strength
    // - PROPERTY contains "Charpy Notched" AND CONDITION contains "23°C" -> mechanical.charpy_notched_impact_strength_23c
    // - PROPERTY contains "Charpy Notched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_notched_impact_strength_minus_30c
    // - PROPERTY contains "Charpy Unnotched" AND CONDITION contains "23°C" -> mechanical.charpy_impact_strength_23c
    // - PROPERTY contains "Charpy Unnotched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_impact_strength_minus_30c
    // - PROPERTY contains "Notched Izod" AND CONDITION contains "23°C" -> mechanical.izod_impact_strength_23c
    // - PROPERTY contains "Notched Izod" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.izod_impact_strength_minus_30c

    // THERMAL
    // - PROPERTY contains "Melting Temperature" -> thermal.melting_temperature_10c_per_min
    // - PROPERTY contains "Deflection Temperature Under Load":
    //     - CONDITION contains "0.45" -> thermal.temp_of_deflection_under_load_0_45_mpa
    //     - CONDITION contains "1.8" -> thermal.temp_of_deflection_under_load_1_80_mpa
    // - PROPERTY="CLTE":
    //     - CONDITION contains "Flow" or "Parallel" -> thermal.coeff_of_linear_therm_expansion_cte_parallel
    //     - CONDITION contains "Transverse" or "Normal" -> thermal.coeff_of_linear_therm_expansion_cte_normal
    //   IMPORTANT: CLTE values commonly contain E-notation; keep them EXACT as strings if they do.

    // - PROPERTY contains "Flame Rating" -> thermal.flame_rating_ul_94 (keep VALUE like V-0/5VA as string)

    // ELECTRICAL
    // - PROPERTY contains "Dielectric Constant":
    //     - CONDITION contains "100 Hz" -> electrical.relative_permittivity_100hz
    //     - CONDITION contains "1 MHz" -> electrical.relative_permittivity_1mhz
    // - PROPERTY contains "Dissipation Factor":
    //     - CONDITION contains "100 Hz" -> electrical.dissipation_factor_100hz
    //     - CONDITION contains "1 MHz" -> electrical.dissipation_factor_1mhz
    // - PROPERTY contains "Volume Resistivity" -> electrical.volume_resistivity
    // - PROPERTY contains "Surface Resistivity" -> electrical.surface_resistivity
    // - PROPERTY contains "Dielectric Strength" -> electrical.electric_strength
    // - PROPERTY contains "Comparative Tracking Index" OR "CTI" AND UNIT=V -> electrical.comparative_tracking_index_cti
    // - If CTI is PLC (no V), put into electrical.comparative_tracking_index_cti_plc instead.

    // PROCESSING (Injection section)
    // - If SECTION=Injection PROPERTY="Drying Temperature" -> processing.drying_temperature_circulating_air_dryer
    // - If SECTION=Injection PROPERTY="Drying Time" and CONDITION contains "Desiccant Dryer":
    //     -> processing.drying_time_circulating_air_dryer_min/max:
    //        - If VALUE is a single number, set both min=max=value
    //        - If VALUE is a range, split into min/max (this is one of the ONLY places you split ranges)
    // - If SECTION=Injection FIELD="Suggested Max Moisture" and VALUE contains "<":
    //     -> processing.residual_moisture_content_max.value = "< 0.020" (string), unit="%" (if present)
    // - If SECTION=Injection PROPERTY contains "Processing (Melt) Temp" and VALUE is a range:
    //     -> processing.melt_temperature_min/max from range
    // - If SECTION=Injection PROPERTY contains "Mold Temperature" and VALUE is a range:
    //     -> processing.mold_temperature_min/max from range

    // CHOOSING BETWEEN MULTIPLE LINES
    // - If multiple rows map to the same schema field, choose the one with:
    //   1) a specific CONDITION (e.g., "23°C", "-30°C", "0.45 MPa") over blank
    //   2) a TEST_METHOD present over missing
    //   3) a numeric VALUE over "--"

    //   Do NOT overwrite a better row with a worse row.
    // ` : "";

    // ✅ Paste this entire block as your `ulRules` string (drop-in replacement)

    const ulRules = isUL ? `
UL MODE (VERY IMPORTANT)
- The text is pre-cleaned from a UL Prospector comparison table.
- Generic column values have been removed.
- Only use values that appear after "VALUE=" in the evidence lines.
- If a property has no VALUE= line, return null (do NOT guess, do NOT use other numbers).
- Ignore any disclaimer/noise lines.
- Treat each evidence line as authoritative: SECTION, PROPERTY/FIELD, CONDITION, VALUE, UNIT, TEST_METHOD.

CONDITION → test_condition (MANDATORY)
- Whenever you populate ANY schema object that has a "test_condition" field from a UL evidence line,
  you MUST copy the CONDITION text into test_condition EXACTLY (verbatim) if CONDITION is non-empty.
- Do NOT leave test_condition null when CONDITION is present.

Examples:
- Dielectric Constant with CONDITION=100 Hz -> electrical.relative_permittivity_100hz.test_condition="100 Hz"
- Dissipation Factor with CONDITION=1 MHz -> electrical.dissipation_factor_1mhz.test_condition="1 MHz"
- Charpy Notched Impact Strength with CONDITION=-30°C -> mechanical.charpy_notched_impact_strength_minus_30c.test_condition="-30°C"
- Molding Shrinkage with CONDITION=Across Flow -> rheological.molding_shrinkage_normal.test_condition="Across Flow"
- CLTE with CONDITION=Flow -> thermal.coeff_of_linear_therm_expansion_cte_parallel.test_condition="Flow"

CRITICAL: DO NOT "NORMALIZE" VALUES
- NEVER compute or re-format values.
- If VALUE contains scientific notation (E/e), keep it EXACTLY as in VALUE= (string).
- If VALUE contains a range like "0.90 to 1.2" keep it EXACTLY as in VALUE= (string).
- Do NOT replace "3.6E-5" with "0.000036".
- Do NOT replace "0.90 to 1.2" with "0.9".

UL MODE - HIGHEST PRIORITY OVERRIDES (MUST FOLLOW)
1) Availability must be copied EXACTLY:
   If you see:
     SECTION=General | FIELD=Availability | VALUE=<V>
   Then:
     general.regional_availability.value = <V> EXACTLY (same order, no drops, no reformat).

2) Generic Symbol mapping:
   - SECTION=General FIELD=Generic Symbol -> general.generic_type.value
   - internal_genics_name MUST stay null unless the text explicitly provides an internal Genics name.
     Never populate internal_genics_name from Generic Symbol, Resin ID, Part Marking Code, etc.

3) Melt/Mold Temperature min/max ranges (even if PROPERTY name is "Drying Time"):
   If you see:
     SECTION=Injection | ... | CONDITION=Processing (Melt) Temp | VALUE=<V> | UNIT=<U>
   Then:
     - Parse <V> for min/max and fill processing.melt_temperature_min/max
     - Units: set BOTH min/max unit to <U> when present.

   If you see:
     SECTION=Injection | ... | CONDITION=Mold Temperature | VALUE=<V> | UNIT=<U>
   Then:
     - Parse <V> for min/max and fill processing.mold_temperature_min/max
     - Units: set BOTH min/max unit to <U> when present.

GENERAL (explicit field mappings)
- SECTION=General FIELD=Name -> general.name.value
- SECTION=General FIELD=Description -> general.description.value
- SECTION=General FIELD=Availability -> general.regional_availability.value
- SECTION=General FIELD=Manufacturer / Supplier -> general.supplier.value
- SECTION=General FIELD=Processing Method -> general.processing.value
- SECTION=General FIELD=Forms -> general.delivery_form.value
- SECTION=General FIELD=Generic Symbol -> general.generic_type.value

CERTIFICATIONS (keep only real certifications, not test methods)
- general.certifications_and_compliance.value may include ONLY:
  - "UL94 V-0" (or UL94 with rating if present)
  - "UL Yellow Card" (if any FIELD mentions "UL Yellow Card")
- DO NOT add ISO/IEC/ASTM/EN/UL 746B/60695/etc into certifications (those are test methods).

FILLER + FILLER_PERCENT (CRITICAL FIX)
Goal: general.filler.value must be the MATERIAL (e.g., "Glass Fiber"), NOT "Weight".
Goal: general.filler_percent.value must be the number (e.g., 15) and unit "%".

Priority order (highest wins; do NOT overwrite a better one with a worse one):
1) If you see:
   - SECTION=General FIELD=Filler -> general.filler.value
   - SECTION=General FIELD=Filler Percent -> general.filler_percent.value/unit
   - SECTION=General PROPERTY=Filler Percent -> general.filler_percent.value/unit (same meaning)
2) Else, if you see SECTION=General FIELD=Filler / Reinforcement with VALUE that contains BOTH a filler material + a percent,
   e.g. "Glass Fiber, 15% Filler by Weight":
   - general.filler.value = "Glass Fiber"
   - general.filler_percent.value = 15
   - general.filler_percent.unit = "%"
   IMPORTANT: If FIELD=Filler / Reinforcement VALUE is ONLY "Weight" (or "Volume"), that is NOT a filler material.
   In that case: DO NOT set general.filler to "Weight". Leave filler null unless you find a real filler elsewhere.
3) Else, parse from any General FIELD that contains "UL Yellow Card" if it includes filler info like:
   "Glass Fiber, 15% Filler by Weight"
   Same extraction as rule #2.
4) Else, parse from Description ONLY if it explicitly states something like:
   "15% glass-fiber reinforced"
   Then:
   - filler = "Glass Fiber"
   - filler_percent = 15 "%"
   (Allowed only because it is explicitly present in the text.)

PHYSICAL
- PROPERTY="Density / Specific Gravity" -> physical.density (value/unit/test_method)
- PROPERTY contains "Water Absorption" -> physical.water_absorption (value/unit/test_condition/test_method)

RHEOLOGICAL
- PROPERTY contains "Melt Mass-Flow Rate" or "MFR" -> rheological.melt_volume_flow_rate_mvr ONLY IF the CONDITION mentions "MVR"
- PROPERTY contains "Melt Volume-Flow Rate" or "MVR" -> rheological.melt_volume_flow_rate_mvr
- PROPERTY contains "Molding Shrinkage":
    - CONDITION contains "Flow" -> rheological.molding_shrinkage_parallel
    - CONDITION contains "Across Flow" or "Transverse" -> rheological.molding_shrinkage_normal
  IMPORTANT: if VALUE contains "to" (range), keep it as STRING exactly (do not reduce to first number).

MECHANICAL
- PROPERTY="Tensile Modulus" -> mechanical.tensile_modulus
- PROPERTY="Tensile Strength" -> mechanical.stress_at_break
- PROPERTY="Tensile Elongation" -> mechanical.strain_at_break
- PROPERTY="Flexural Modulus" -> mechanical.flexural_modulus
- PROPERTY="Flexural Strength" -> mechanical.flexural_strength
- PROPERTY contains "Charpy Notched" AND CONDITION contains "23°C" -> mechanical.charpy_notched_impact_strength_23c
- PROPERTY contains "Charpy Notched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_notched_impact_strength_minus_30c
- PROPERTY contains "Charpy Unnotched" AND CONDITION contains "23°C" -> mechanical.charpy_impact_strength_23c
- PROPERTY contains "Charpy Unnotched" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.charpy_impact_strength_minus_30c
- PROPERTY contains "Notched Izod" AND CONDITION contains "23°C" -> mechanical.izod_impact_strength_23c
- PROPERTY contains "Notched Izod" AND (CONDITION contains "-30°C" OR "-30") -> mechanical.izod_impact_strength_minus_30c

THERMAL
- PROPERTY contains "Melting Temperature" -> thermal.melting_temperature_10c_per_min
- PROPERTY contains "Deflection Temperature Under Load":
    - CONDITION contains "0.45" -> thermal.temp_of_deflection_under_load_0_45_mpa
    - CONDITION contains "1.8" -> thermal.temp_of_deflection_under_load_1_80_mpa
- PROPERTY="CLTE":
    - CONDITION contains "Flow" or "Parallel" -> thermal.coeff_of_linear_therm_expansion_cte_parallel
    - CONDITION contains "Transverse" or "Normal" -> thermal.coeff_of_linear_therm_expansion_cte_normal
  IMPORTANT: CLTE values commonly contain E-notation; keep them EXACT as strings if they do.
- PROPERTY contains "Flame Rating" -> thermal.flame_rating_ul_94 (keep VALUE like V-0/5VA as string)

ELECTRICAL
- PROPERTY contains "Dielectric Constant":
    - CONDITION contains "100 Hz" -> electrical.relative_permittivity_100hz
    - CONDITION contains "1 MHz" -> electrical.relative_permittivity_1mhz
- PROPERTY contains "Dissipation Factor":
    - CONDITION contains "100 Hz" -> electrical.dissipation_factor_100hz
    - CONDITION contains "1 MHz" -> electrical.dissipation_factor_1mhz
- PROPERTY contains "Volume Resistivity" -> electrical.volume_resistivity
- PROPERTY contains "Surface Resistivity" -> electrical.surface_resistivity
- PROPERTY contains "Dielectric Strength" -> electrical.electric_strength
- PROPERTY contains "Comparative Tracking Index" OR "CTI" AND UNIT=V -> electrical.comparative_tracking_index_cti
- If CTI is PLC (no V), put into electrical.comparative_tracking_index_cti_plc instead.

PROCESSING (Injection section)
- If SECTION=Injection PROPERTY="Drying Temperature" -> processing.drying_temperature_circulating_air_dryer
- If SECTION=Injection PROPERTY="Drying Time" and CONDITION contains "Desiccant Dryer":
    -> processing.drying_time_circulating_air_dryer_min/max:
       - If VALUE is a single number, set both min=max=value
       - If VALUE is a range, split into min/max (this is one of the ONLY places you split ranges)
- If SECTION=Injection FIELD="Suggested Max Moisture" and VALUE contains "<":
    -> processing.residual_moisture_content_max.value = "< 0.020" (string), unit="%" (if present)
- If SECTION=Injection ... CONDITION=Processing (Melt) Temp and VALUE is a range:
    -> processing.melt_temperature_min/max from range
- If SECTION=Injection ... CONDITION=Mold Temperature and VALUE is a range:
    -> processing.mold_temperature_min/max from range

- If you see this exact evidence pattern (Injection section):
  SECTION=Injection | PROPERTY=Drying Time | CONDITION=Processing (Melt) Temp | VALUE=<V> | UNIT=<U>
  then you MUST populate:
    processing.melt_temperature_min.value
    processing.melt_temperature_max.value
  by parsing <V>:
    - If <V> is "A to B" (or "A - B"), set min=A and max=B as NUMBERS.
    - If <V> is a single number A, set min=A and max=A as NUMBERS.
  and set unit for BOTH min/max to <U> (e.g., "°C").
- Do NOT leave melt_temperature_min/max null if that evidence line exists.

CHOOSING BETWEEN MULTIPLE LINES
- If multiple rows map to the same schema field, choose the one with:
  1) a specific CONDITION (e.g., "23°C", "-30°C", "0.45 MPa") over blank
  2) a TEST_METHOD present over missing
  3) a numeric VALUE over "--"
- Do NOT overwrite a better row with a worse row.
` : "";

    const LOCALLY_HOSTED_LLM_BASE_URL = process.env.LOCALLY_HOSTED_LLM_BASE_URL2;

    const templateJson = JSON.stringify(outputSchema, null, 2);
    const formatSchema = schemaFromTemplate(outputSchema);

    const basePrompt = `
You are a strict information-extraction engine.

GOAL
Extract material properties from the provided extracted text into ONE JSON object that matches the provided JSON template exactly.
Every key must be present. If a value is not explicitly present in the text, set it to null (do NOT guess).

HARD RULES
- Output MUST be valid JSON only. No markdown, no explanations, no extra text.
- Do NOT add any keys. Do NOT remove any keys.
- Use ONLY information explicitly present in the text. Do NOT infer.
- Use the UL MODE mapping rules to map PROPERTY/FIELD lines into the correct schema keys.
- If a property does not match any mapping rule, leave schema fields null (do NOT guess).
- NEVER FILL internal_genics_name:
- Never populate internal_genics_name from Generic Symbol, Resin ID, Part Marking Code, or any other field.
${ulRules}

VALUE OBJECT RULES
For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
- Split combined values like "6600 MPa" into value=6600 and unit="MPa" when possible.
- Put standards like "ISO 178" into test_method when present.
- Put conditions like "23°C" into test_condition when present.
- for only flexural_modulus, flexural_strength and flexural_strain_at_flexural_strength, try format : "23°C, 2 mm/min"
- Ensure value/unit/test_condition/test_method make sense for the property.
- Attempt extraction for EVERY schema property.
- If not found by scan, do targeted lookup before leaving null for that property.
- certifications_and_compliance: keep only real certification names; drop filler like "passed", "+", etc.
- hydrolysis_resistant_hr must be "Yes" or "No" if hydrolysis resistance is stated.
- regional_availability must be a real region (Asia/Europe/etc), not filler like "commercial".
- Extract numeric min/max for these fields:
        residual_moisture_content_min
        residual_moisture_content_max
        melt_temperature_min
        melt_temperature_max
        mold_temperature_min
        mold_temperature_max
        permitted_residence_time_prt_min
        permitted_residence_time_prt_max
        drying_time_circulating_air_dryer_min
        drying_time_circulating_air_dryer_max

        Rules:
        Range like 20 to 70 / 20-70 / between 20 and 70 → min=20, max=70
        Single value 70 → min=70, max=70
        >= 20 → min=20, max=null
        <= 70 → min=null, max=70
        If missing/unclear → null

IMPORTANT :
VALUE TYPE RULES (MANDATORY)
For every field shaped like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
1) If the extracted value text is a PURE NUMBER, output it as a JSON number (NO quotes).
   PURE NUMBER means it matches of:
   - integer/decimal: ^-?\d+(\.\d+)?$

2) If the extracted value contains ANY non-numeric operators/markers, keep it as a STRING:
   markers include: "-", " to ", "~", "±", "<", ">", "≤", "≥", "x10", "×10", "E", "e", "^", "/", "(", ")"


IMPORTANT OUTPUT CONSTRAINT
- dont explicitly convert non-numeric values into numbers . fill the value as it is !
- Output ONE JSON object ONLY (no extra text).
- Make sure it passes JSON.parse().



JSON TEMPLATE (must match exactly):
${templateJson}


  `.trim();

    const MAX_TRIES = 3;
    let lastContent = null;
    let lastErr = null;

    const messages = [
        { role: "system", content: basePrompt },
        {
            role: "user",
            content: `Extract the required fields from the text and return ONLY the JSON.\n\nEXTRACTED TEXT:\n${extractedText}`,
        },
    ];

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        try {
            const response = await fetch(`${LOCALLY_HOSTED_LLM_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    "model": "gpt-oss:20b-cloud",
                    "format": formatSchema,
                    "messages": [
                        {
                            "role": "system",
                            "content": basePrompt
                        },
                        {
                            "role": "user",
                            "content": `Extract the required fields from the text and return ONLY the JSON.\n\nEXTRACTED TEXT:\n${extractedText}`
                        }
                    ],
                    "stream": false
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`LLM call failed (attempt ${attempt}) ${response.status}: ${errText}`);
            }

            const res = await response.json();
            const content = res?.message?.content;

            // console.log(`------------raw content from llm model-----------`);
            // console.log(content);

            if (!content) {
                throw new Error(`No message.content in LLM response: ${JSON.stringify(res)}`);
            }

            lastContent = content;

            // ✅ THIS NOW auto-repairs many syntax issues locally before giving up
            const parsed = safeJsonParse(content);

            if (RAW_LLM_SAVE) {
                try {
                    const { materialName: inferredMaterial } = getMaterialAndFileFromPdfUrl(pdfUrl);
                    const material =
                        materialName ||
                        (inferredMaterial && inferredMaterial !== "unknown_material"
                            ? inferredMaterial
                            : undefined) ||
                        "unknown_material";

                    await saveRawLlmJson(
                        RAW_LLM_SAVE_OUTPUT_DIR,
                        material,
                        source || "unknown_source",
                        parsed
                    );
                } catch (e) {
                    console.warn("Failed to save raw LLM JSON:", e);
                }
            }

            return parsed;

        } catch (err) {
            lastErr = err;

            if (attempt === MAX_TRIES) {
                throw new Error(
                    `Failed to get valid JSON after ${MAX_TRIES} attempts for ${pdfUrl}\n` +
                    `Last error: ${String(err.message)}\n` +
                    `Last output preview:\n${previewText(lastContent)}`
                );
            }

            const backoffMs = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
            await sleep(backoffMs);

            const raw = typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent);

            // Different repair instruction depending on likely cause
            const trunc = looksTruncatedJson(raw);

            messages.push({ role: "assistant", content: raw });

            messages.push({
                role: "user",
                content: trunc
                    ? `
Your previous output looks TRUNCATED / incomplete (missing closing braces).

REGENERATE FROM SCRATCH:
- Output ONLY ONE valid JSON object.
- It MUST match the JSON TEMPLATE exactly (same keys, same nesting, no extra keys).
- If unknown, use null.
- Ensure it passes JSON.parse().

Return ONLY the JSON object.
          `.trim()
                    : `
Your previous answer had JSON formatting errors (e.g., missing comma/quote).

REPAIR:
- Output ONLY ONE valid JSON object (no markdown, no commentary).
- It MUST match the JSON TEMPLATE exactly (same keys, same nesting, no extra keys).
- Keep the same extracted values where possible; only fix JSON syntax/structure.
- If unknown, use null.
- Ensure it passes JSON.parse().

Return ONLY the corrected JSON object.
          `.trim(),
            });
        }
    }

    throw lastErr ?? new Error("Unknown JSON extraction error");
}


export async function processPdfFromUrl(pdfUrl, source, materialName) {

    // 1 get ocr text from deepseek-ocr-2  (WE WOULD JUST PASS URL FROM HERE , PYTHON BACKEND WILL FETCH PDF FROM URL ITSELF)
    // const extractedText = await performOCR(pdfUrl);

    const extractedText =
        String(source).toLowerCase() === "ul"
            ? await performULStreaming(pdfUrl, source)
            : await performOCR(pdfUrl, source);

    // console.log(`-----extracted text --------- : `, extractedText);

    console.log(`\n LLM is Making Your Json ...`)

    // 2 send text to ollama hosted local llm 
    const raw = await makeJSONfromExtractedTextUsingLLM(
        extractedText,
        pdfUrl,
        source,
        materialName
    );

    

    // 3 schema validation
    const formedJson = normalizeToTemplate(outputSchema, raw);

    formedJson.source = source;

    return formedJson;

}



