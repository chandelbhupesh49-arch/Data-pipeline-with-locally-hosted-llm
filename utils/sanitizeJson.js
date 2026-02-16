/**
 * JSON Sanitization Utility
 * 
 * This module provides functions to clean and fix parsing errors in unified JSON data
 * before storing it in the database. It handles various common parsing issues that can
 * occur when extracting data from PDFs and JSON files.
 * 
 * FIXES:
 * - Issue 1: Text fields are NOT numeric-coerced (only numeric fields are converted to numbers)
 * - Issue 2: Range values are collapsed to a single number (max endpoint)
 * - Issue 3: Unit normalization + canonicalization (schema-safe)
 *
 * STRICT outputSchema requirements:
 * - Do NOT add any extra keys anywhere.
 * - `value` must remain scalar (number/string/null). No objects in `value`.
 *   - ranges become numbers (max endpoint): "0.4 - 0.6" -> 0.6
 *   - operators stay string: "> 2E11"
 */

import { normalizeUnitForConversion, normalizeValueObjectUnits, parseNumericExpression, canonicalizeUnitsByFieldPath, getCanonicalUnit } from "./unitNormalization.js";
import { outputSchema as OUTPUT_SCHEMA_TEMPLATE } from "./transformJson.js";
import { decodeHexNullArtifacts } from './decodeHexNullArtifacts.js';

/**
 * Fields that are known to be percent-based and should retain (or default) unit="%"
 * when the schema supports a unit field and the value is non-null.
 *
 * Why: some sources encode "%" in the value string ("3,5 %") or omit unit entirely.
 * We must retain a correct unit for these measurable fields.
 */
const PERCENT_UNIT_PATHS = new Set([
    "general.filler_percent",
    "mechanical.strain_at_break",
    "rheological.molding_shrinkage_normal",
    "rheological.molding_shrinkage_parallel",
    // Note: residual_moisture_content_min has no unit field in schema; we cannot add one.
    "processing.residual_moisture_content_max",
]);

/**
 * Set of field paths that are known to be TEXT fields (should never be numeric-coerced)
 * These fields should remain as strings even if they contain numbers or percentages.
 */
const TEXT_FIELD_PATHS = new Set([
    // General text fields
    'general.description',
    'general.application_space',
    'general.delivery_form',
    'general.regional_availability',
    'general.certifications_and_compliance',
    'general.other_additives',
    'general.processing',
    'general.supplier',
    'general.chemical_family',
    'general.polymer_type',
    'general.generic_type',
    'general.filler',
    'general.name',
    'general.internal_genics_name',
    'general.suppliers_trade_name',
    'general.alternative_names',
    // Any field that doesn't have a value object structure is considered text
]);

/**
 * Some schema fields are "free-text but measurement-ish": they are stored as `{ value: string }`
 * without a unit field, but often contain a comparator + number + unit + descriptor.
 *
 * We apply a very targeted sanitizer only to these paths to avoid affecting unrelated text fields.
 */
const MEASUREMENTISH_TEXT_VALUE_PATHS = new Set([
    'thermal.burning_rate_thickness_1_mm',
]);


const E_NOTATION_VALUE_PATH_SUFFIXES = [
    "electrical.volume_resistivity",
    "electrical.surface_resistivity",
    // fallback if you sanitize only the electrical subtree:
    "volume_resistivity",
    "surface_resistivity",
];




function toCanonicalENotationStringSafe(n, sig = 15) {
    if (typeof n !== "number" || !Number.isFinite(n)) return n;

    // sig=15 keeps good precision for floats
    const s = n.toExponential(sig - 1); // e.g. "1.000000000000000e+17"
    let [mantissa, exp] = s.split("e");

    // trim trailing zeros in mantissa
    mantissa = mantissa.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

    // normalize exponent: "e+17" -> "E17"
    exp = exp.replace("+", "");

    return `${mantissa}E${exp}`;
}

function shouldFormatENotation(path) {
    // const p = String(path || "").replace(/\[\d+\]/g, ""); // drop [0]
    // return E_NOTATION_VALUE_PATH_SUFFIXES.some(s => p === s || p.endsWith(`.${s}`) || p.endsWith(s));
    const p = String(path || "").replace(/\[\d+\]/g, ""); // drop [0]
    const leaf = p.split(".").pop();
    return leaf === "surface_resistivity" || leaf === "volume_resistivity";
}

function toCanonicalENotationResistivity(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return n;

    // 0 decimals → "1e+17" (avoids mantissa noise)
    const s = n.toExponential(0);
    let [m, e] = s.split("e");        // m="1", e="+17"
    e = e.replace("+", "");           // "+17" -> "17"
    e = e.replace(/^(-?)0+(\d+)/, "$1$2"); // "017" -> "17"
    return `${m}E${e}`;
}


function formatSelectedFieldsToENotation(node, path = "") {
    if (node === null || node === undefined) return node;

    if (Array.isArray(node)) {
        return node.map((v, i) => formatSelectedFieldsToENotation(v, `${path}[${i}]`));
    }

    if (typeof node === "object") {
        // If this is a value-object at a field path we care about:
        if (
            "value" in node &&
            typeof node.value === "number" &&
            shouldFormatENotation(path)
        ) {
            // Option A (recommended): only convert when unsafe integer / very large
            // if (Math.abs(node.value) > Number.MAX_SAFE_INTEGER) {
            //   node.value = toCanonicalENotationStringSafe(node.value);
            // }

            // Option B: always convert for these fields
            // node.value = toCanonicalENotationStringSafe(node.value);
            node.value = toCanonicalENotationResistivity(node.value);

        }

        for (const k of Object.keys(node)) {
            const nextPath = path ? `${path}.${k}` : k;
            node[k] = formatSelectedFieldsToENotation(node[k], nextPath);
        }
        return node;
    }

    return node;
}



/**
 * Checks if a field path represents a numeric field (should be numeric-coerced)
 * Numeric fields are those with value objects that typically have units (e.g., modulus, strength, temperature)
 * 
 * @param {string} path - The dot-separated path to the field
 * @returns {boolean} - True if this is a numeric field
 * 
 */

//! added
// --- test_condition enforcement ---

const TEST_METHOD_RX = /\b(ISO|ASTM|IEC|DIN|EN|UL)\s*[A-Z]?\s*\d[\d\-\/]*/i;

// tokens we consider "real" test conditions
const TC_TOKEN_RXS = {
    temp: /-?\d+(?:\.\d+)?\s*(?:°\s*C|deg\s*C)\b/gi,
    speed: /\d+(?:\.\d+)?\s*mm\s*\/\s*min\b/gi,
    load: /\d+(?:\.\d+)?\s*kg\b/gi,
    pressure: /\d+(?:\.\d+)?\s*(?:MPa|GPa|kPa|bar|psi)\b/gi,
    frequency: /\d+(?:\.\d+)?\s*(?:Hz|kHz|MHz|GHz)\b/gi,
    heatingRateMin: /\d+(?:\.\d+)?\s*(?:°\s*C|deg\s*C)\s*\/\s*min\b/gi,
    heatingRateH: /\d+(?:\.\d+)?\s*(?:°\s*C|deg\s*C)\s*\/\s*h\b/gi,
    tempRange: /\b-?\d+(?:\.\d+)?\s*(?:to|-|–)\s*-?\d+(?:\.\d+)?\s*(?:°\s*C|deg\s*C)\b/gi,
    dims: /\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\b/gi,
    moldTemp: /\bMT\s*-?\d+(?:\.\d+)?\s*(?:°\s*C|deg\s*C)\b/gi,
    keywords: /\b(?:dry|wet|ambient|RT|room\s*temp(?:erature)?)\b/gi,
    methodLetter: /\bMethod\s*[A-Z]\b/gi,

    //! adding this 
    thickness: /\b\d+(?:\.\d+)?\s*mm\b/gi,

    //! new adding this
    time: /\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|day|days)\b/gi,

};

function canonicalizeDeliveryForm(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") return null;

    const v = raw.trim().toLowerCase();
    if (v === "pellets") return "Pellets";
    if (v === "granules") return "Granules";
    return null;
}

// field-specific “what is allowed” (extend as needed)
const TEST_CONDITION_RULES = {
    "mechanical.tensile_modulus": ["temp"],
    "mechanical.stress_at_break": ["temp"],
    "mechanical.strain_at_break": ["temp"],

    "mechanical.flexural_modulus": ["temp", "speed"],
    "mechanical.flexural_strength": ["temp", "speed"],
    "mechanical.flexural_strain_at_flexural_strength": ["temp", "speed"],

    "mechanical.charpy_impact_strength_23c": ["temp"],
    "mechanical.charpy_impact_strength_minus_30c": ["temp"],
    "mechanical.charpy_notched_impact_strength_23c": ["temp"],
    "mechanical.charpy_notched_impact_strength_minus_30c": ["temp"],
    "mechanical.izod_impact_strength_23c": ["temp"],
    "mechanical.izod_impact_strength_minus_30c": ["temp"],

    "rheological.melt_volume_flow_rate_mvr": ["temp", "load"],
    "rheological.molding_shrinkage_normal": ["dims", "temp", "moldTemp", "pressure"],
    "rheological.molding_shrinkage_parallel": ["dims", "temp", "moldTemp", "pressure"],

    "electrical.volume_resistivity": ["temp"],
    "electrical.surface_resistivity": ["temp"],
    "electrical.electric_strength": ["temp"],
    "thermal.flame_rating_ul_94": ["thickness"],
    "thermal.melting_temperature_10c_per_min": ["heatingRateMin", "heatingRateH"],

    "physical.water_absorption": ["temp", "time"],


    "thermal.coeff_of_linear_therm_expansion_cte_parallel": ["tempRange"],
    "thermal.coeff_of_linear_therm_expansion_cte_normal": ["tempRange"],

};

//! adding this 
function normalizeTimeToken(s) {
    if (!s || typeof s !== "string") return s;
    let t = s.replace(/\s+/g, " ").trim();
    // make "24 hr"/"24 hrs"/"24 hours" -> "24hr"
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/i, "$1hr");
    // "24 h" -> "24h" (optional)
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*h\b/i, "$1h");
    return t;
}



function normalizeUnitsInsideText(s) {
    if (!s || typeof s !== "string") return s;
    let t = s;

    // temperature - normalize °C and remove space before it
    t = t.replace(/(\d+)\s*°\s*C/gi, "$1°C");  // "23 °C" -> "23°C"
    t = t.replace(/°\s*C/gi, "°C");
    t = t.replace(/deg\s*C/gi, "°C");

    // stress/pressure case
    t = t.replace(/\bmpa\b/gi, "MPa");
    t = t.replace(/\bgpa\b/gi, "GPa");
    t = t.replace(/\bkpa\b/gi, "kPa");
    t = t.replace(/\bpa\b/g, "Pa");

    // spacing in common tokens
    t = t.replace(/mm\s*\/\s*min/gi, "mm/min");
    t = t.replace(/°C\s*\/\s*min/gi, "°C/min");
    t = t.replace(/°C\s*\/\s*h/gi, "°C/h");

    // frequency case (leave as written, but normalize spacing)
    t = t.replace(/\s+/g, " ").trim();
    return t;
}

function sanitizeTestCondition(tcRaw, fieldPath, currentTestMethod) {
    if (!tcRaw || typeof tcRaw !== "string") {
        return { test_condition: tcRaw, test_method: currentTestMethod };
    }

    let tc = normalizeUnitsInsideText(tcRaw);

    // 1) If test_condition contains a method, move it to test_method
    if (TEST_METHOD_RX.test(tc)) {
        const methodPart = tc.match(TEST_METHOD_RX)?.[0] || null;
        if (methodPart) {
            // remove it from tc
            tc = normalizeUnitsInsideText(tc.replace(methodPart, " "));

            // only set test_method if empty (don’t overwrite)
            if ((!currentTestMethod || String(currentTestMethod).trim() === "") && methodPart) {
                currentTestMethod = methodPart.trim();
            }
        }
    }

    // 2) Extract allowed tokens
    const allowedKeys = TEST_CONDITION_RULES[fieldPath] || Object.keys(TC_TOKEN_RXS); // default: keep known tokens
    const found = [];

    for (const k of allowedKeys) {
        const rx = TC_TOKEN_RXS[k];
        if (!rx) continue;
        const matches = tc.match(rx);
        if (matches) found.push(...matches);
    }

    // Deduplicate + normalize
    //! adding this extra
    const TIME_RX = /\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|day|days)\b/i;

    // let uniq = Array.from(new Set(found.map(normalizeUnitsInsideText)));
    let uniq = Array.from(new Set(found.map(normalizeUnitsInsideText))).map(x => (TIME_RX.test(x) ? normalizeTimeToken(x) : x));
    // .map(x => (TC_TOKEN_RXS.time?.test(x) ? normalizeTimeToken(x) : x));



    //! adding this if something goes wrong you ca comment out this block If we already have a heating-rate token like "10°C/min", drop plain temp tokens like "10°C"
    const isPlainTemp = (x) => /^[+-]?\d+(?:\.\d+)?\s*°C$/i.test(x);
    const isHeatingRate = (x) => /°C\/(?:min|h)\b/i.test(x);

    if (uniq.some(isHeatingRate)) {
        uniq = uniq.filter(t => {
            if (!isPlainTemp(t)) return true;
            // remove if any heating-rate token contains this temp
            return !uniq.some(r => isHeatingRate(r) && r.includes(t));
        });
    }


    if (fieldPath === "physical.water_absorption") {
        const temp = uniq.find(v => /°C\b/i.test(v)) || null;
        const time = uniq.find(v => /\b\d+(?:\.\d+)?\s*(?:hr|h|min|day)s?\b/i.test(v)) || null;

        const parts = [temp, time].filter(Boolean);
        const cleaned = parts.length ? parts.join(", ") : null;

        return { test_condition: cleaned, test_method: currentTestMethod };
    }

    // Special handling for flexural fields: ensure temp comes before speed, format exactly as "23°C , 2mm/min"
    //! changed this
    // if (fieldPath === "mechanical.flexural_modulus" || 
    //     fieldPath === "mechanical.flexural_strength" || 
    //     fieldPath === "mechanical.flexural_strain_at_flexural_strength") {
    //     // Normalize tokens: remove spaces
    //     uniq = uniq.map(token => {
    //         // Normalize "23 °C" -> "23°C" (remove space before °C)
    //         token = token.replace(/(\d+(?:\.\d+)?)\s+°C/gi, "$1°C");
    //         // Normalize "2 mm/min" -> "2mm/min" (remove space before mm/min)
    //         token = token.replace(/(\d+(?:\.\d+)?)\s+mm\/min/gi, "$1mm/min");
    //         return token;
    //     });

    //     const temp = uniq.find(v => /°C\b/i.test(v)) || null;
    //     const speed = uniq.find(v => /mm\/min\b/i.test(v)) || null;

    //     const parts = [temp, speed].filter(Boolean);
    //     if (parts.length > 0) {
    //         // Format exactly as "23°C , 2mm/min" (comma + space separator)
    //         const cleaned = parts.join(" , ");
    //         return { test_condition: cleaned, test_method: currentTestMethod };
    //     }
    // }

    if (
        fieldPath === "mechanical.flexural_modulus" ||
        fieldPath === "mechanical.flexural_strength" ||
        fieldPath === "mechanical.flexural_strain_at_flexural_strength"
    ) {
        // Re-detect from the normalized raw string so both tokens are captured
        const tcNorm = normalizeUnitsInsideText(tcRaw);

        const tempMatch = tcNorm.match(/-?\d+(?:\.\d+)?\s*°C\b/i);
        const speedMatch = tcNorm.match(/\d+(?:\.\d+)?\s*mm\s*\/\s*min\b/i);

        const temp = tempMatch
            ? tempMatch[0]
                .replace(/(\d+(?:\.\d+)?)\s+°C/gi, "$1°C")
                .replace(/\s+/g, " ")
                .trim()
            : null;

        const speed = speedMatch
            ? speedMatch[0]
                .replace(/(\d+(?:\.\d+)?)\s+mm\s*\/\s*min/gi, "$1mm/min")
                .replace(/\s+/g, " ")
                .trim()
            : null;

        if (temp || speed) {
            const cleaned = [temp, speed].filter(Boolean).join(" , ");
            return { test_condition: cleaned, test_method: currentTestMethod };
        }
        // If neither found, fall through to generic handling below
    }

    //! till here

    // Normalize temperature tokens in remaining fields: remove space before °C
    uniq = uniq.map(token => {
        // Normalize "23 °C" -> "23°C" (remove space before °C)
        return token.replace(/(\d+(?:\.\d+)?)\s+°C/gi, "$1°C");
    });

    let cleaned = uniq.join(", ");
    cleaned = cleaned ? cleaned.trim() : null;

    // 3) Deterministic defaults from fieldPath (optional but matches spreadsheet nicely)
    if (!cleaned && typeof fieldPath === "string") {
        if (/_23c$/.test(fieldPath)) cleaned = "23°C";
        else if (/_minus_30c$/.test(fieldPath)) cleaned = "-30°C";
    }

    return { test_condition: cleaned, test_method: currentTestMethod };
}
//! till here



function isNumericField(path) {
    // If it's explicitly a text field, it's not numeric
    if (TEXT_FIELD_PATHS.has(path)) {
        return false;
    }

    // Numeric fields are typically in these categories:
    // - mechanical.* (modulus, strength, impact, etc.)
    // - physical.* (density, absorption, etc.)
    // - rheological.* (MFR, MVR, shrinkage, etc.)
    // - processing.* (temperatures, times, etc.)
    // - electrical.* (resistivity, strength, etc.)
    // - thermal.* (temperatures, expansion, etc.)
    // - general.filler_percent, general.est_price, general.avrg_carbon_footprint (have units)

    const numericFieldPatterns = [
        /^mechanical\./,
        /^physical\./,
        /^rheological\./,
        /^processing\./,
        /^electrical\./,
        /^thermal\./,
        /^general\.filler_percent$/,
        /^general\.est_price$/,
        /^general\.avrg_carbon_footprint$/,
    ];

    return numericFieldPatterns.some(pattern => pattern.test(path));
}

/**
 * Detects if a string value represents a range or inequality
 * Examples: "5.0E+2 to 2.5E+13", "0.4 - 0.6", "> 1", "< 0.1", "≥ 5", "≤ 10"
 * 
 * @param {string} value - The string value to check
 * @returns {boolean} - True if this appears to be a range or inequality
 */
function isRangeOrInequality(value) {
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();

    // Check for range indicators: "to", "-" (with spaces), "–" (en dash), "—" (em dash)
    const rangePatterns = [
        /\s+to\s+/i,           // "5 to 10"
        /\s+-\s+/,              // "5 - 10"
        /\s+–\s+/,              // "5 – 10" (en dash)
        /\s+—\s+/,              // "5 — 10" (em dash)
        /\s+\.\.\.\s+/,         // "5 ... 10"
    ];

    // Check for inequality indicators: >, <, ≥, ≤, >=, <=
    const inequalityPatterns = [
        /^[><≥≤]/,              // "> 1", "< 0.1", "≥ 5", "≤ 10"
        /^>=/,                  // ">= 5"
        /^<=/,                  // "<= 10"
    ];

    // Check for scientific notation ranges: "5.0E+2 to 2.5E+13"
    const scientificRangePattern = /[\d.]+[Ee][+-]?\d+\s+(to|-|–|—)\s+[\d.]+[Ee][+-]?\d+/;

    return rangePatterns.some(pattern => pattern.test(trimmed)) ||
        inequalityPatterns.some(pattern => pattern.test(trimmed)) ||
        scientificRangePattern.test(trimmed);
}

/**
 * Removes leading and trailing special characters from a string value
 * Fixes issues like: "+13.5", "13.5+", "#value", "$value", etc.
 * 
 * @param {string} str - The string to clean
 * @returns {string} - Cleaned string with special characters removed from start/end
 */
function removeLeadingTrailingSpecialChars(str) {
    if (typeof str !== 'string') return str;

    // Remove leading special characters: +, #, $, %, &, *, @, etc.
    // Keep negative sign for negative numbers
    let cleaned = str.trim();
    cleaned = cleaned.replace(/^[+#$%&*@~`^]+/, '');

    // Remove trailing special characters: +, #, $, %, &, *, @, etc.
    cleaned = cleaned.replace(/[+#$%&*@~`^]+$/, '');

    return cleaned.trim();
}

/**
 * Normalizes numeric separators (commas and dots) to ensure decimal commas never appear in output.
 * Handles various formats:
 * - "13,5" -> "13.5" (EU decimal)
 * - "1,234.56" -> "1234.56" (US thousands + decimal)
 * - "1.234,56" -> "1234.56" (EU thousands + decimal)
 * 
 * Deterministic rule: if both "," and "." exist, whichever appears last is the decimal separator.
 * - If "." is last: remove all commas (US format)
 * - If "," is last: remove all dots, replace comma with dot (EU format)
 * 
 * If only commas exist:
 * - If single comma and pattern looks like decimal (^-?\d+,\d+$): replace comma with dot
 * - If multiple commas: treat as thousands separators and remove commas
 * - Otherwise only replace comma between digits: (\d),(\d) -> $1.$2
 * 
 * @param {string} str - The string that may contain comma/dot as decimal/thousands separators
 * @returns {string} - String with normalized numeric separators (dots for decimals, no thousands separators)
 */
function normalizeNumericSeparators(str) {
    if (typeof str !== 'string') return str;

    const trimmed = str.trim();
    if (!trimmed) return str;

    // Check if both comma and dot exist
    const hasComma = trimmed.includes(',');
    const hasDot = trimmed.includes('.');

    if (hasComma && hasDot) {
        // Both exist: determine which is decimal separator (whichever appears last)
        const lastComma = trimmed.lastIndexOf(',');
        const lastDot = trimmed.lastIndexOf('.');

        if (lastDot > lastComma) {
            // "." is last -> US format: "1,234.56" -> remove all commas
            return trimmed.replace(/,/g, '');
        } else {
            // "," is last -> EU format: "1.234,56" -> remove all dots, replace comma with dot
            return trimmed.replace(/\./g, '').replace(',', '.');
        }
    }

    // Only commas exist
    if (hasComma && !hasDot) {
        const commaCount = (trimmed.match(/,/g) || []).length;

        // Single comma: check if it looks like a decimal (^-?\d+,\d+$)
        if (commaCount === 1) {
            const decimalPattern = /^-?\d+,\d+$/;
            if (decimalPattern.test(trimmed)) {
                return trimmed.replace(',', '.');
            }
        }

        // Multiple commas: treat as thousands separators, remove all
        if (commaCount > 1) {
            return trimmed.replace(/,/g, '');
        }

        // Single comma but not matching decimal pattern: only replace comma between digits
        return trimmed.replace(/(\d),(\d)/g, '$1.$2');
    }

    // Only dots or neither: return as-is (dots are already correct for decimals)
    return trimmed;
}

/**
 * Normalizes numeric commas in text strings, preserving punctuation commas.
 * Only replaces commas that are used as decimal separators inside a number token.
 *
 * IMPORTANT: This is intentionally conservative to avoid corrupting punctuation commas in
 * normal sentences/lists like "ISO 527, 2" or "Colors: 1, 2, 3".
 *
 * Rule: replace only when comma is directly between digits with no whitespace: "2,16" -> "2.16"
 * 
 * Example: "Type 1,6 mm" -> "Type 1.6 mm" (preserves "Type" and "mm")
 * 
 * @param {string} str - The text string that may contain numeric commas
 * @returns {string} - String with numeric commas normalized to dots
 */
function normalizeNumericCommasInText(str) {
    if (typeof str !== 'string') return str;

    // Only replace comma directly between digits: (\d),(\d) -> $1.$2
    // This avoids changing list/punctuation commas like "ISO 527, 2".
    return str.replace(/(\d),(\d)/g, '$1.$2');
}

/**
 * Removes trailing "+" artifacts from text fields (common OCR/extraction noise).
 * Only removes "+" (or fullwidth "＋") if it appears at the very end (ignoring whitespace).
 *
 * @param {string} str
 * @returns {string}
 */
function removeTrailingPlusArtifact(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\s*[+＋]\s*$/g, '').trim();
}

function isMeasurementishTextValueField(fieldPath) {
    if (!fieldPath) return false;
    if (MEASUREMENTISH_TEXT_VALUE_PATHS.has(fieldPath)) return true;
    // Allow future similar fields while remaining very narrow in scope.
    return /^thermal\.burning_rate_thickness_/i.test(fieldPath);
}

/**
 * Sanitizes "measurement-ish" free-text strings like:
 *   "> 1 mm Thickness +" -> "> 1 mm thickness"
 *
 * Goals:
 * - Preserve semantic numeric part (comparators like >, number, unit like mm)
 * - Remove common OCR artifacts (trailing +, stray symbols, duplicated punctuation)
 * - Normalize whitespace
 * - Standardize casing for descriptive words (lowercase)
 *
 * IMPORTANT: Only used for a narrow set of fields (see isMeasurementishTextValueField).
 */
function sanitizeMeasurementishFreeText(str) {
    if (typeof str !== 'string') return str;

    let s = str;
    s = normalizeWhitespace(s);
    s = removeLeadingTrailingSpecialChars(s);
    s = removeTrailingPlusArtifact(s);
    s = normalizeNumericCommasInText(s);

    // Remove common stray OCR symbols (keep comparator symbols, units, slash, hyphen, parentheses).
    // Replace them with space to avoid concatenating tokens.
    s = s.replace(/[•·•‧∙⋅]|[†‡§¤]|[“”„‟]|[’‘‚‛]|[™©®]/g, ' ');
    s = s.replace(/\uFFFD/g, ' '); // replacement character �

    // Collapse duplicated punctuation (but do not touch comparator sequences like ">=" or "<=").
    s = s.replace(/([,;:.!?])\1+/g, '$1');

    // Normalize comparator spacing at the beginning: ">1" -> "> 1"
    s = s.replace(/^(>=|<=|>|<|≥|≤)\s*/u, '$1 ');

    // Normalize number-unit spacing for mm (and common thickness units).
    s = s.replace(/(\d)\s*(mm|cm|µm|μm|um|m)\b/gi, '$1 $2');

    // Cleanup spacing around punctuation and parentheses.
    s = s.replace(/\s+([,;:.!?])/g, '$1');
    s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    s = normalizeWhitespace(s);

    // Standardize casing for descriptive words.
    s = s.toLowerCase();

    return s;
}

/**
 * Removes extra whitespace and normalizes spacing
 * Fixes issues like: "  value  ", "value\n\t", multiple spaces, etc.
 * 
 * @param {string} str - The string to normalize
 * @returns {string} - String with normalized whitespace
 */
function normalizeWhitespace(str) {
    if (typeof str !== 'string') return str;

    // Replace multiple whitespace characters with single space
    return str.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes unit strings to canonical form
 * Converts common variants to standardized units for consistency across merged JSON
 * 
 * Normalizations:
 * - Volume density: "g/cm3", "g/cm³", "g/cm^3" -> "g/cm³"
 * - Mass density: "kg/m3", "kg/m³", "kg/m^3" -> "kg/m³"
 * - Flow rates: "g/10min", "g/10 min" -> "g/10 min"
 * - Volume flow: "cm3/10min", "cm³/10min", "cm³/10 min" -> "cm³/10 min"
 * - Resistivity: "ohm-cm", "ohms·cm", "Ω x cm", "Ω·cm" -> "Ω·cm"
 * - Resistivity: "Ohm*m", "ohm*m", "Ω m", "Ω·m" -> "Ω·m"
 * - Temperature: "° C", "degC" -> "°C"
 * 
 * Conservative: if unit is unknown or doesn't match patterns, return unchanged
 * 
 * @param {string} unit - The unit string to normalize
 * @returns {string} - Normalized unit string (or original if unknown)
 */
function normalizeUnit(unit) {
    if (typeof unit !== 'string' || !unit) {
        return unit;
    }

    // First normalize whitespace and trim
    let normalized = normalizeWhitespace(unit);

    // Normalize superscript notation first (^3 -> ³, ^2 -> ²)
    normalized = normalized.replace(/\^3/g, '³');
    normalized = normalized.replace(/\^2/g, '²');

    //! here
    // ---- Pressure/stress (case-normalize) ----
    normalized = normalized.replace(/\bmpa\b/gi, "MPa");
    normalized = normalized.replace(/\bgpa\b/gi, "GPa");
    normalized = normalized.replace(/\bkpa\b/gi, "kPa");
    normalized = normalized.replace(/\bpa\b/g, "Pa"); // only exact "Pa"

    // ---- Common spreadsheet formats ----
    normalized = normalized.replace(/cm[³3]\s*\/\s*10\s*min/gi, "cm³/10min"); // Excel uses no space
    normalized = normalized.replace(/kg\s*\/\s*m[³3]/gi, "kg/m³");            // force kg/m³
    normalized = normalized.replace(/^ohm$/i, "Ohm");
    normalized = normalized.replace(/^Ω$/g, "Ohm");                           // if you want Excel style
    normalized = normalized.replace(/Ω\s*[·*]?\s*m\b/gi, "Ohm*m");            // Excel uses Ohm*m
    normalized = normalized.replace(/ohms?\s*[·*]\s*m\b/gi, "Ohm*m");

    // ... existing code ...

    normalized = normalized.replace(/ohms?\s*-\s*m\b/gi, "Ohm*m");
    normalized = normalized.replace(/Ω\s*-\s*m\b/gi, "Ohm*m");

    // ... existing code ...

    //! till here


    // Volume density: g/cm3, g/cm³, g/cm^3 -> g/cm³
    // Match "g/cm" followed by "3" or "³", then ensure it's "g/cm³"
    normalized = normalized.replace(/g\s*\/\s*cm[³3]/gi, 'g/cm³');

    // Mass density: kg/m3, kg/m³, kg/m^3 -> kg/m³
    // Match "kg/m" followed by "3" or "³", then ensure it's "kg/m³"
    normalized = normalized.replace(/kg\s*\/\s*m[³3]/gi, 'kg/m³');

    // Flow rates: g/10min, g/10 min -> g/10 min (ensure space before "min")
    normalized = normalized.replace(/g\s*\/\s*10\s*min/gi, 'g/10 min');

    // Volume flow: cm3/10min, cm³/10min, cm³/10 min -> cm³/10 min
    // First convert cm3 to cm³, then normalize spacing
    normalized = normalized.replace(/cm3\s*\/\s*10\s*min/gi, 'cm³/10 min');
    normalized = normalized.replace(/cm³\s*\/\s*10\s*min/gi, 'cm³/10 min');

    // Resistivity variants to Ω·cm:
    // ohm-cm, ohms·cm, Ω x cm, Ω·cm, Ω cm -> Ω·cm
    normalized = normalized.replace(/ohms?\s*[-·x]\s*cm/gi, 'Ω·cm');
    normalized = normalized.replace(/Ω\s*[x×·]?\s*cm/gi, 'Ω·cm');

    // Resistivity variants to Ω·m:
    // Ohm*m, ohm*m, Ω m, Ω·m -> Ω·m
    normalized = normalized.replace(/ohms?\s*[*·]\s*m(?=\s|$)/gi, 'Ω·m');
    normalized = normalized.replace(/Ω\s*[*·]?\s*m(?=\s|$)/gi, 'Ω·m');

    // Temperature: ° C, degC, deg C -> °C
    normalized = normalized.replace(/°\s*C/gi, '°C');
    normalized = normalized.replace(/deg\s*C/gi, '°C');

    // Normalize multiplication symbols: use · (middle dot) consistently
    // Replace various multiplication symbols with ·
    normalized = normalized.replace(/[x×]\s*/g, '·');

    // Collapse multiple spaces to single space (after all replacements)
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

/**
 * Extracts unit from a value string that contains both number and unit
 * Examples: "3,5 %" -> { value: "3.5", unit: "%" }, "5.2 MPa" -> { value: "5.2", unit: "MPa" }
 * 
 * This ensures units are never dropped when parsing values.
 * 
 * @param {string} valueStr - The string that may contain both number and unit
 * @returns {Object|null} - { value: string, unit: string } or null if no unit found
 */
function extractUnitFromValue(valueStr) {
    if (typeof valueStr !== 'string') return null;

    const trimmed = valueStr.trim();

    // Common unit patterns (percentage, units with letters, etc.)
    // Pattern: number (with optional comma/dot) followed by unit
    // Units can be: %, MPa, GPa, kPa, Pa, °C, °F, g/cm³, kg/m³, Ω·cm, etc.

    // Special handling for CTE units with embedded scientific notation:
    // For E notation (E-4, E−4), keep the exponent in the UNIT, don't apply it to the value
    // - "0.09E−4/∘F" -> value="0.09", unit="E-4/°F"
    // - "1.2E-4/K" -> value="1.2", unit="E-4/K"
    // For x10 notation, also keep in unit
    // - "90 x10^-6/°C" -> value="90", unit="x10^-6/°C"
    // Pattern: number, then scientific notation (E-4, x10^-6, ×10^-6, 10⁻⁴), then /K or /°C or /°F
    const superscriptMap = {
        '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
        '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
        '⁻': '-', '⁺': '+', '−': '-'  // Also handle minus sign variants
    };
    
    // Normalize superscripts and special characters in the string for matching
    let normalizedForMatch = trimmed;
    for (const [sup, normal] of Object.entries(superscriptMap)) {
        normalizedForMatch = normalizedForMatch.replace(new RegExp(sup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), normal);
    }
    
    // Match E notation pattern: "0.09E-4/°F" or "0.09E−4/∘F" (keep exponent in unit)
    // Also handle cases like "0.09E−4/∘F" where ∘F might be together
    const eNotationMatch = normalizedForMatch.match(/^([\d.,\s]+)\s*([Ee]\s*[-−]\s*\d+)\s*\/\s*([K°CF∘]|∘[CF]|°[CF])/i) ||
                          normalizedForMatch.match(/^([\d.,\s]+)\s*([Ee]\s*[-−]\s*\d+)\s*\/\s*([∘°])\s*([CF])/i);
    if (eNotationMatch) {
        const numericPart = eNotationMatch[1].trim().replace(/,/g, '.').replace(/\s+/g, '');
        const expPart = eNotationMatch[2].trim().replace(/\s+/g, '').toUpperCase();
        let tempUnit = (eNotationMatch[3] || '').trim();
        const tempUnit2 = (eNotationMatch[4] || '').trim();
        
        // Handle cases where degree symbol and letter are separate
        if (tempUnit === '∘' || tempUnit === '°') {
            if (tempUnit2 === 'C' || tempUnit2 === 'c') {
                tempUnit = '°C';
            } else if (tempUnit2 === 'F' || tempUnit2 === 'f') {
                tempUnit = '°F';
            } else {
                tempUnit = '°';
            }
        } else if (tempUnit === '∘C' || tempUnit === '∘F' || tempUnit === '°C' || tempUnit === '°F') {
            // Already combined
            tempUnit = tempUnit.replace('∘', '°');
        } else if (tempUnit === 'K' || tempUnit === 'k') {
            tempUnit = 'K';
        } else {
            // Fallback: try to detect from context
            const restOfString = normalizedForMatch.substring(eNotationMatch[0].length);
            if (restOfString.includes('C') || restOfString.includes('c')) {
                tempUnit = '°C';
            } else if (restOfString.includes('F') || restOfString.includes('f')) {
                tempUnit = '°F';
            } else {
                tempUnit = tempUnit || 'K';
            }
        }
        
        // Keep value as-is, keep exponent in unit
        return {
            value: numericPart,
            unit: expPart + "/" + tempUnit
        };
    }
    
    // Match x10 or ×10 notation: "90 x10^-6/°C" (keep in unit)
    const x10Match = normalizedForMatch.match(/^([\d.,\s]+)\s*([×x]\s*10\s*\^?\s*[-]?\s*\d+)\s*\/\s*([K°CF∘])/i);
    if (x10Match) {
        const numericPart = x10Match[1].trim().replace(/,/g, '.').replace(/\s+/g, '');
        const expPart = x10Match[2].trim().replace(/\s+/g, '').toLowerCase();
        const tempUnit = x10Match[3].trim();
        const normalizedTempUnit = tempUnit === '∘' || tempUnit === '°' ? '°' : tempUnit;
        const finalTempUnit = normalizedTempUnit === '°' ? (normalizedForMatch.includes('C') || normalizedForMatch.includes('c') ? '°C' : 
                                                           normalizedForMatch.includes('F') || normalizedForMatch.includes('f') ? '°F' : normalizedTempUnit) : normalizedTempUnit;
        
        return {
            value: numericPart,
            unit: expPart + "/" + finalTempUnit
        };
    }
    
    // Match plain 10 notation with superscripts: "0.2 10⁻⁴/K" (keep in unit, but this is less common)
    const plain10Match = normalizedForMatch.match(/^([\d.,\s]+)\s*(10\s*\^?\s*[-]?\s*\d+)\s*\/\s*([K°CF∘])/i);
    if (plain10Match) {
        const numericPart = plain10Match[1].trim().replace(/,/g, '.').replace(/\s+/g, '');
        const expPart = plain10Match[2].trim().replace(/\s+/g, '').replace(/10\s*\^?\s*/, 'E');
        const tempUnit = plain10Match[3].trim();
        const normalizedTempUnit = tempUnit === '∘' || tempUnit === '°' ? '°' : tempUnit;
        const finalTempUnit = normalizedTempUnit === '°' ? (normalizedForMatch.includes('C') || normalizedForMatch.includes('c') ? '°C' : 
                                                           normalizedForMatch.includes('F') || normalizedForMatch.includes('f') ? '°F' : normalizedTempUnit) : normalizedTempUnit;
        
        return {
            value: numericPart,
            unit: expPart + "/" + finalTempUnit
        };
    }
    
    // Match percentage at the end of the string:
    // - Scalars: "3,5 %", "3.5%", "3 %"
    // - Ranges:  "0,4 - 0,6 %"
    // - Inequalities: "> 3,5 %"
    const percentMatch = trimmed.match(/^(.*\d.*)\s*%$/);
    if (percentMatch) {
        return {
            value: percentMatch[1].trim(),
            unit: '%'
        };
    }

    // Match common units after number: "5.2 MPa", "3,5 GPa", "1200 kg/m³", "5.0E+2 MPa"
    // Pattern: number (with comma, dot, or scientific notation) followed by space and unit
    // More specific patterns first

    // Generic trailing unit token:
    // Examples:
    // - "1200 kg/m³" -> unit="kg/m³"
    // - "5.2 MPa" -> unit="MPa"
    // - "1e10 Ω·m" -> unit="Ω·m"
    // Also supports range/inequality prefixes in the value part.
    const trailingUnitMatch = trimmed.match(/^(.*\d.*)\s+([A-Za-z°Ωµμ·³²\/\-\*\^x×]+)$/);
    if (trailingUnitMatch) {
        const valuePart = trailingUnitMatch[1].trim();
        const unitPart = trailingUnitMatch[2].trim();
        if (unitPart && /[A-Za-z°Ω%]/.test(unitPart)) {
            return { value: valuePart, unit: unitPart };
        }
    }

    // Units with / (like g/cm³, kg/m³) – kept for extra strictness
    const fractionUnitMatch = trimmed.match(/^([\d,.\sEe+\-<>≥≤×x\*\^]+)\s+([a-zA-Z°³²Ω]+(?:\s*[\/·]\s*[a-zA-Z°³²Ω]+))$/);
    if (fractionUnitMatch) {
        const valuePart = fractionUnitMatch[1].trim();
        const unitPart = fractionUnitMatch[2].trim();
        if (unitPart && !/^\d+$/.test(unitPart)) {
            return {
                value: valuePart,
                unit: unitPart
            };
        }
    }

    // Standard units: MPa, GPa, kPa, Pa, N, J, W, °C, °F, Ω·cm, etc.
    // Pattern: number followed by space and unit (letters, symbols, etc.)
    const standardUnitMatch = trimmed.match(/^([\d,.\sEe+\-<>≥≤×x\*\^]+)\s+([A-Za-z°·³²Ω\-]+(?:\s*[·x×]\s*[A-Za-z°³²Ω]+)?)$/);
    if (standardUnitMatch) {
        const valuePart = standardUnitMatch[1].trim();
        const unitPart = standardUnitMatch[2].trim();

        // Verify the unit part looks like a unit (not just more numbers or scientific notation)
        if (unitPart && !/^\d+([Ee][+-]?\d+)?$/.test(unitPart) && /[A-Za-z°Ω]/.test(unitPart)) {
            return {
                value: valuePart,
                unit: unitPart
            };
        }
    }

    return null;
}

/**
 * Infers temperature unit from a value string when unit is missing
 * Checks for temperature-related keywords: °, deg, celsius, centigrade, fahrenheit, kelvin
 * 
 * @param {string} valueStr - The raw value string
 * @returns {string|null} - Inferred unit string or null if no temperature indicators found
 */
function inferTemperatureUnitFromValue(valueStr) {
    if (typeof valueStr !== 'string') return null;
    
    const lower = valueStr.toLowerCase();
    
    // Check for Fahrenheit indicators
    if (lower.includes('fahrenheit') || lower.includes('°f') || lower.includes('degf') || 
        (lower.includes('deg') && lower.includes('f') && !lower.includes('celsius') && !lower.includes('centigrade'))) {
        return '°F';
    }
    
    // Check for Kelvin indicators
    if (lower.includes('kelvin') || (lower.includes('k') && !lower.includes('°c') && !lower.includes('°f'))) {
        return 'K';
    }
    
    // Check for Celsius/Centigrade indicators
    if (lower.includes('celsius') || lower.includes('centigrade') || lower.includes('°c') || 
        lower.includes('degc') || (lower.includes('deg') && lower.includes('c'))) {
        return '°C';
    }
    
    // Check for degree symbol (°) - default to Celsius if no other indicator
    if (lower.includes('°')) {
        return '°C';
    }
    
    return null;
}

/**
 * Infers CTE (coefficient of linear thermal expansion) unit from a value string when unit is missing
 * Checks for CTE-related keywords: /K, /°C, ppm, µm/m, x10
 * 
 * @param {string} valueStr - The raw value string
 * @returns {string|null} - Inferred unit string or null if no CTE indicators found
 */
function inferCTEUnitFromValue(valueStr) {
    if (typeof valueStr !== 'string') return null;
    
    const lower = valueStr.toLowerCase();
    
    // Check for /K or K^-1
    if (lower.includes('/k') || lower.includes('k^-1') || lower.includes('k⁻¹')) {
        // Check if it's ppm/K or µm/m·K
        if (lower.includes('ppm/k')) {
            return 'ppm/K';
        }
        if (lower.includes('µm/m') && lower.includes('k')) {
            return 'µm/m·K';
        }
        // Check for x10^-6/K
        if (lower.includes('x10') && lower.includes('/k')) {
            return 'x10^-6/K';
        }
        return '/K';
    }
    
    // Check for /°C or °C^-1
    if (lower.includes('/°c') || lower.includes('°c^-1') || lower.includes('°c⁻¹')) {
        // Check if it's ppm/°C or µm/m·°C
        if (lower.includes('ppm/°c') || lower.includes('ppm/ c')) {
            return 'ppm/°C';
        }
        if (lower.includes('µm/m') && (lower.includes('°c') || lower.includes(' c'))) {
            return 'µm/m·°C';
        }
        // Check for x10^-6/°C
        if (lower.includes('x10') && (lower.includes('/°c') || lower.includes('/ c'))) {
            return 'x10^-6/°C';
        }
        return '/°C';
    }
    
    // Check for /°F
    if (lower.includes('/°f') || lower.includes('°f^-1')) {
        if (lower.includes('ppm/°f')) {
            return 'ppm/°F';
        }
        return '/°F';
    }
    
    // Check for ppm (without explicit /K or /°C)
    if (lower.includes('ppm')) {
        // Default to ppm/°C if no other indicator
        return 'ppm/°C';
    }
    
    // Check for µm/m
    if (lower.includes('µm/m') || lower.includes('um/m')) {
        // Default to µm/m·°C if no other indicator
        return 'µm/m·°C';
    }
    
    // Check for x10 or ×10
    if (lower.includes('x10') || lower.includes('×10')) {
        // Default to x10^-6/°C if no other indicator
        return 'x10^-6/°C';
    }
    
    return null;
}

/**
 * parseValue(): deterministic parsing of measurable value strings.
 * - Keeps text fields as strings (handled by caller)
 * - Supports European decimals ("3,5" -> 3.5)
 * - Supports scientific notation ("2E9" -> 2e9)
 * - Supports inequalities ("> 2x10^11" -> {operator: ">", value: 2e11})
 * - Supports ranges by collapsing to max endpoint ("0,4 - 0,6" -> 0.6)
 *
 * IMPORTANT: This function does NOT set/modify units. It only parses the value.
 */
function toCanonicalENotationString(n) {
    // "2e+11" -> "2E11"
    const s = n.toExponential();
    const parts = s.split("e");
    if (parts.length !== 2) return s;
    const mantissa = parts[0];
    const exp = parts[1].replace("+", "");
    return `${mantissa}E${exp}`;
}

function normalizeExpressionStringToENotation(expr) {
    // Convert "2x10^11", "2 * 10¹¹", "2e9" -> "2E11"/"2E9"
    // Only force E-notation when the source expression is *already* scientific-ish.
    // We must NOT turn plain decimals like "0.4" into "4E-1".
    const looksScientific = /[Ee]|10\^|10[⁰¹²³⁴⁵⁶⁷⁸⁹]|x10|\*10|×10|·10/i.test(expr);
    if (!looksScientific) return null;

    const parsed = parseNumericExpression(expr);
    if (parsed === null) return null;
    return toCanonicalENotationString(parsed);
}

function parseValue(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;
    if (typeof rawValue === "number") return rawValue;
    if (typeof rawValue !== "string") return rawValue;

    let s = normalizeWhitespace(rawValue);
    s = stripBracketSuffixArtifacts(s);
    if (!s) return null;

    // Inequality: keep as STRING, but normalize numeric portion if parseable.
    const ineqMatch = s.match(/^(>=|<=|>|<|≥|≤)\s*(.+)$/);
    if (ineqMatch) {
        const operator = ineqMatch[1];
        const rhs = ineqMatch[2].trim();
        const rhsNorm = normalizeNumericSeparators(rhs);
        const normalizedSci = normalizeExpressionStringToENotation(rhsNorm);
        if (normalizedSci) return `${operator} ${normalizedSci}`;
        // Fallback: use normalized numeric separators
        return `${operator} ${rhsNorm}`.trim();
    }

    // Range: return NUMBER (max endpoint) when both endpoints are parseable.
    // Otherwise, fall back to a normalized string.
    const rangeSeparators = [
        { re: /\s+to\s+/i, split: /\s+to\s+/i },
        { re: /\s+-\s+/, split: /\s+-\s+/ },
        { re: /\s+–\s+/, split: /\s+–\s+/ },
        { re: /\s+—\s+/, split: /\s+—\s+/ },
    ];
    for (const { re, split } of rangeSeparators) {
        if (re.test(s)) {
            const parts = s.split(split);
            if (parts.length === 2) {
                const leftRaw = normalizeNumericSeparators(parts[0].trim());
                const rightRaw = normalizeNumericSeparators(parts[1].trim());
                const leftSci = normalizeExpressionStringToENotation(leftRaw);
                const rightSci = normalizeExpressionStringToENotation(rightRaw);
                const leftOut = (leftSci ?? leftRaw).trim();
                const rightOut = (rightSci ?? rightRaw).trim();

                const leftNum = parseNumericExpression(leftOut);
                const rightNum = parseNumericExpression(rightOut);
                if (leftNum !== null && rightNum !== null) {
                    return Math.max(leftNum, rightNum);
                }

                // If we can't parse deterministically, still normalize numeric separators.
                return `${leftOut} - ${rightOut}`;
            }
            // If we can't parse deterministically, still normalize numeric separators.
            return normalizeNumericSeparators(s);
        }
    }

    // Scalar scientific notation: keep as STRING in canonical "E" form.
    const normalized = normalizeNumericSeparators(s);
    const normalizedSci = normalizeExpressionStringToENotation(normalized);
    if (normalizedSci && /E/i.test(s)) return normalizedSci;

    // Scalar pure number: return NUMBER (comma-decimals supported).
    const maybeNum = parseNumericExpression(normalized);
    if (maybeNum !== null) return maybeNum;

    // Mixed text: keep as string (but normalize numeric separators to avoid locale noise).
    return normalized;
}

/**
 * sanitizeUnit(): normalizes unit strings and enforces unit retention rules for known fields.
 *
 * - Never adds a unit key when schema doesn't have one (caller ensures).
 * - If a field is known percent-based and has a non-null value, ensure unit="%".
 */
function sanitizeUnit(fieldPath, currentUnit, parsedValue) {
    if (currentUnit === null || currentUnit === undefined || currentUnit === "") {
        if (PERCENT_UNIT_PATHS.has(fieldPath) && parsedValue !== null) return "%";
        return null;
    }
    return normalizeUnit(String(currentUnit));
}


function stripBracketSuffixArtifacts(s) {
    if (typeof s !== "string") return s;
    // remove trailing bracket tag like [OT], [T0], [0T], [abc], etc.
    return s.replace(/\s*\[[A-Za-z0-9]{1,5}\]\s*$/g, "").trim();
}


/**
 * Converts string numbers to actual numbers where appropriate
 * ONLY converts if it's a true scalar number (not a range, inequality, or text with numbers)
 * Fixes issues like: "13.5" (string) -> 13.5 (number), but keeps "N/A", "null", ranges, etc. as strings
 * 
 * @param {any} value - The value to potentially convert to number
 * @param {string} fieldPath - The path to the field (for context-aware conversion)
 * @returns {number|string} - Converted number if valid scalar, otherwise original value
 */
function convertStringToNumber(value, fieldPath) {
    if (typeof value !== 'string') return value;

    // CRITICAL: Never numeric-coerce text fields, even if they contain numbers
    // Example: "9% ..." should stay as "9% ...", not become 9
    if (fieldPath && !isNumericField(fieldPath)) {
        return value; // Keep as string for text fields
    }

    // CRITICAL: Never numeric-coerce ranges or inequalities - preserve full meaning
    // Example: "5.0E+2 to 2.5E+13" should stay as string, not become 5.0E+2
    if (isRangeOrInequality(value)) {
        return value; // Keep range/inequality as string
    }

    // Skip if it's a known non-numeric string
    const nonNumericPatterns = ['N/A', 'n/a', 'NA', 'na', 'null', 'NULL', 'undefined', 'UNDEFINED', '-', '—'];
    if (nonNumericPatterns.includes(value.trim())) {
        return value;
    }

    // Try to parse as number
    const trimmed = value.trim();

    // Check if it's a pure numeric string (no extra text, just a number)
    // Pattern: optional sign, digits, optional decimal point, optional digits, optional scientific notation
    const pureNumberPattern = /^-?\d+(\.\d+)?([Ee][+-]?\d+)?$/;

    if (!pureNumberPattern.test(trimmed)) {
        // If it's not a pure number (has text mixed in), keep as string
        // Example: "9% ...", "Type 1.6 mm", "HB class" should stay as strings
        return value;
    }

    const num = parseFloat(trimmed);

    // If it's a valid number and the string representation matches, convert it
    if (!isNaN(num) && isFinite(num)) {
        // Double-check: if converting back to string matches original, it's a pure number
        const numStr = num.toString();
        const trimmedLower = trimmed.toLowerCase();
        if (numStr === trimmed || numStr === trimmedLower ||
            (trimmed.includes('e') && Math.abs(parseFloat(trimmed) - num) < 1e-10)) {
            return num;
        }
    }

    // Also handle cases where the string might have been cleaned (e.g., "13.5" after comma fix)
    const cleaned = removeLeadingTrailingSpecialChars(trimmed);
    if (cleaned !== trimmed && pureNumberPattern.test(cleaned)) {
        const cleanedParsed = parseFloat(cleaned);
        if (!isNaN(cleanedParsed) && isFinite(cleanedParsed)) {
            return cleanedParsed;
        }
    }

    return value;
}

/**
 * Sanitizes a value object (e.g., { value: "...", unit: "...", test_condition: "...", test_method: "..." })
 * Applies all parsing fixes to the value field and cleans other fields
 * Also performs unit normalization and conversion to canonical units
 * 
 * @param {Object} valueObj - The value object to sanitize
 * @param {string} fieldPath - The path to this field (for context-aware sanitization)
 * @returns {Object} - Sanitized value object with canonical units
 */
function sanitizeValueObject(valueObj, fieldPath, options) {
    const isStrict = options?.strict !== false;   //! added
    if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) {
        return valueObj;
    }

    let sanitized = { ...valueObj };

    const schemaHasUnit = ("unit" in sanitized);
    const measurementishFreeText = isMeasurementishTextValueField(fieldPath) && !schemaHasUnit;

    // parseValue + unit retention (never drop unit)
    if ('value' in sanitized) {
        let value = sanitized.value;
        let extractedUnit = null;

        if (typeof value === 'string') {

            //! adding
            value = decodeHexNullArtifacts(value);
            value = stripBracketSuffixArtifacts(value);
            // Only attempt unit extraction when schema actually has a unit field.
            // This avoids schema mutation for {value: "..."}-only fields.
            if (schemaHasUnit) {
                const unitExtraction = extractUnitFromValue(value);
                if (unitExtraction) {
                    value = unitExtraction.value;
                    if (sanitized.unit === null || sanitized.unit === undefined || sanitized.unit === "") {
                        extractedUnit = unitExtraction.unit;
                    }
                }
                
                // If unit is still missing and this is a temperature field, try to infer from value string
                if (!extractedUnit && (sanitized.unit === null || sanitized.unit === undefined || sanitized.unit === "")) {
                    const canonicalUnit = getCanonicalUnit(fieldPath);
                    if (canonicalUnit === "°C") {
                        // This is a temperature field, try to infer unit from raw value
                        const inferredUnit = inferTemperatureUnitFromValue(value);
                        if (inferredUnit) {
                            extractedUnit = inferredUnit;
                        }
                    } else if (canonicalUnit === "1/K") {
                        // This is a CTE field, try to infer unit from raw value
                        const inferredUnit = inferCTEUnitFromValue(value);
                        if (inferredUnit) {
                            extractedUnit = inferredUnit;
                        }
                    }
                }
            }

            // Text vs numeric decision:
            // - For non-numeric fields, keep as cleaned string (do NOT numeric-coerce).
            if (measurementishFreeText) {
                // Special case: free-text measurement-ish fields stored as {value: string} (no unit key).
                // We keep as STRING but clean OCR noise + normalize casing/spacing.
                value = sanitizeMeasurementishFreeText(value);
            } else if (fieldPath && !isNumericField(fieldPath)) {
                let cleaned = normalizeWhitespace(removeLeadingTrailingSpecialChars(value));
                // Normalize numeric commas in text (preserves punctuation commas)
                cleaned = normalizeNumericCommasInText(cleaned);

                //! added this later
                if (fieldPath === "general.delivery_form") {
                    cleaned = canonicalizeDeliveryForm(cleaned);
                }

                value = cleaned;
            }

            else {
                // Numeric/measurable: parse deterministically (commas, ranges, inequalities, scientific)
                value = parseValue(value);
            }
        }

        sanitized.value = value;

        // Retain extracted unit if schema has unit and unit was empty
        if (schemaHasUnit && extractedUnit && (sanitized.unit === null || sanitized.unit === undefined || sanitized.unit === "")) {
            sanitized.unit = extractedUnit;
        }
    }

    // Enforce null-rule WITHOUT mutating schema:
    // If value is null/empty -> unit must be null (only if schema has unit).
    if (sanitized.value === null || sanitized.value === '' ||
        (typeof sanitized.value === 'string' && sanitized.value.trim() === '')) {
        sanitized.value = null;
        if (schemaHasUnit) sanitized.unit = null;
    }

    // Sanitize other fields (unit, test_condition, test_method) without adding new keys
    // These are always text fields, never numeric
    ['unit', 'test_condition', 'test_method'].forEach(field => {
        if (field in sanitized && typeof sanitized[field] === 'string') {
            //! changing this
            // let fieldValue = normalizeWhitespace(
            //     removeLeadingTrailingSpecialChars(sanitized[field])
            // );

            sanitized[field] = decodeHexNullArtifacts(sanitized[field]);

            let fieldValue = normalizeWhitespace(
                field === 'unit'
                    ? sanitized[field]                 // don't strip % from unit
                    : removeLeadingTrailingSpecialChars(sanitized[field])
            );

            // Ensure decimal commas never appear in these text fields (but do not touch punctuation commas).
            fieldValue = normalizeNumericCommasInText(fieldValue);

            // Remove trailing "+" artifacts (only for test fields).
            if (field === 'test_condition' || field === 'test_method') {
                fieldValue = removeTrailingPlusArtifact(fieldValue);
            }

            // Apply unit normalization to 'unit' field
            // Also normalize 'test_condition' if it contains units (e.g., "190 °C / 2.16 kg")
            if (field === 'unit') {
                fieldValue = normalizeUnit(fieldValue);
            }

            //! updated this
            // else if (field === 'test_condition') {
            //     // Check if test_condition contains unit-like patterns (temperature, pressure, etc.)
            //     // If it does, normalize units within it
            //     // Pattern: look for common unit indicators like °C, °F, kg, MPa, etc.
            //     if (/°[CF]|kg|MPa|GPa|kPa|bar|psi|°\s*C|degC/i.test(fieldValue)) {
            //         // Split by common separators and normalize each part
            //         const parts = fieldValue.split(/\s*\/\s*|\s+at\s+|\s+@\s+/i);
            //         const normalizedParts = parts.map(part => {
            //             // If part looks like it has a unit, normalize it
            //             if (/°\s*[CF]|degC|kg|MPa|GPa|kPa|bar|psi/i.test(part)) {
            //                 return normalizeUnit(part);
            //             }
            //             return part;
            //         });
            //         fieldValue = normalizedParts.join(' / ');
            //     }
            // }
            else if (field === "test_condition") {
                const out = sanitizeTestCondition(fieldValue, fieldPath, sanitized.test_method);
                fieldValue = out.test_condition;

                // move method if we extracted one (schema-safe: only touch existing key)
                if ("test_method" in sanitized && out.test_method) {
                    sanitized.test_method = out.test_method;
                }
            }

            // Convert empty strings to null
            if (fieldValue === '') {
                fieldValue = null;
            }

            sanitized[field] = fieldValue;
        }
    });

    // Unit retention + normalization:
    // - Do not introduce unit where schema doesn't have it
    // - Ensure percent fields keep unit="%" when value exists
    if (schemaHasUnit) {
        sanitized.unit = sanitizeUnit(fieldPath, sanitized.unit, sanitized.value);
    }

    // Field-specific guardrails (schema-safe):
    // Prevent MFR (mass flow) units from leaking into MVR field.

    //! removing this for changes
    // if (fieldPath === "rheological.melt_volume_flow_rate_mvr" && schemaHasUnit) {
    //     const isStrict = options?.strict !== false;
    //     const u = typeof sanitized.unit === "string" ? sanitized.unit : null;
    //     const normalized = u ? normalizeUnitForConversion(u) : null;
    //     if (normalized) {
    //         const isMassFlow =
    //             normalized === "g/10 min" ||
    //             normalized === "dg/min" ||
    //             normalized === "g/min";
    //         if (isMassFlow && isStrict) {
    //             // No schema changes allowed; strict behavior is to drop incompatible value/unit.
    //             sanitized.value = null;
    //             sanitized.unit = null;
    //         }
    //     }
    // }

    if (schemaHasUnit) {
        sanitized.unit = sanitizeUnit(fieldPath, sanitized.unit, sanitized.value);
    }

    //! added this
    const isStrictForThisField =
        fieldPath === "rheological.melt_volume_flow_rate_mvr" ? false : isStrict;


    // Canonical unit conversion (schema-safe; never creates extra keys; keeps `value` scalar).
    //! changed this
    // sanitized = normalizeValueObjectUnits(sanitized, fieldPath,isStrict);
    sanitized = normalizeValueObjectUnits(sanitized, fieldPath, isStrictForThisField);

    return sanitized;
}

/**
 * Sanitizes a simple string value (not in a value object)
 * Applies string cleaning fixes.
 * - Text fields stay strings
 * - Numeric fields may become numbers (e.g., ranges collapse to max endpoint)
 * Text fields are NEVER numeric-coerced, even if they contain numbers
 * 
 * @param {any} value - The value to sanitize
 * @param {string} fieldPath - The path to this field (for context-aware sanitization)
 * @returns {any} - Sanitized value
 */
function sanitizeStringValue(value, fieldPath) {

    if (typeof value === 'string') {
        value = decodeHexNullArtifacts(value);
    }

    if (typeof value !== 'string') return value;

    // CRITICAL: Text fields should never be numeric-coerced
    // Example: "9% ...", "Type 1.6 mm", "HB class" should stay as strings
    if (fieldPath && !isNumericField(fieldPath)) {
        // For text fields: only normalize whitespace, remove leading/trailing special chars,
        // and normalize numeric commas (preserves punctuation commas)
        let cleaned = removeLeadingTrailingSpecialChars(value);
        cleaned = normalizeWhitespace(cleaned);
        cleaned = normalizeNumericCommasInText(cleaned);

        //! added check
        if (fieldPath === "general.delivery_form") {
            const v = canonicalizeDeliveryForm(cleaned);
            return v; // "Pellets"/"Granules"/null
        }

        // Convert empty strings to null
        if (cleaned === '') {
            return null;
        }

        return cleaned;
    }

    // For numeric fields (rare case of string value not in value object):
    // Check for ranges first
    if (isRangeOrInequality(value)) {
        // NEW: Use the same deterministic parsing as value-objects.
        // - Ranges collapse to max endpoint (number) when parseable.
        // - Inequalities remain strings ("> 2E11", "< 0.1", etc.).
        return parseValue(value);
    }

    // Apply all string fixes
    let cleaned = removeLeadingTrailingSpecialChars(value);
    cleaned = normalizeNumericSeparators(cleaned);
    cleaned = normalizeWhitespace(cleaned);

    // Convert empty strings to null
    if (cleaned === '') {
        return null;
    }

    return cleaned;
}

/**
 * Recursively sanitizes a JSON object, fixing parsing errors at all levels
 * Handles nested objects, arrays, and value objects
 * Tracks field paths to enable context-aware sanitization (numeric vs text fields)
 * 
 * @param {any} obj - The object/value to sanitize
 * @param {string} currentPath - The current path in the object (e.g., "general.description")
 * @returns {any} - Sanitized object/value
 */
function sanitizeRecursive(obj, currentPath = '', options = {}) {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeRecursive(item, `${currentPath}[${index}]`, options));
    }

    // Handle objects
    if (typeof obj === 'object') {
        // Check if this is a value object (has 'value' key)
        if ('value' in obj) {
            return sanitizeValueObject(obj, currentPath, options);
        }

        // Regular object - recurse into all properties
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                // Skip 'source' field at top level (it's metadata, not data to sanitize)
                if (key === 'source' && Object.keys(obj).length > 1) {
                    sanitized[key] = obj[key];
                    continue;
                }

                // Build the path for this field
                const fieldPath = currentPath ? `${currentPath}.${key}` : key;
                sanitized[key] = sanitizeRecursive(obj[key], fieldPath, options);
            }
        }
        return sanitized;
    }

    // Handle strings
    if (typeof obj === 'string') {
        return sanitizeStringValue(obj, currentPath);
    }

    // Handle numbers, booleans, etc. - return as is
    return obj;
}

/**
 * Main function to sanitize unified JSON data
 * Fixes all parsing errors including:
 * - Decimal comma to dot conversion (13,5 -> 13.5) - ONLY for numeric fields
 * - Leading/trailing special characters (+, #, $, etc.)
 * - Whitespace normalization
 * - String to number conversion where appropriate - ONLY for numeric fields and pure scalars
 * - Empty string to null conversion
 * - Range collapsing to max endpoint (numeric fields); inequalities preserved as strings
 * 
 * @param {Object} unifiedJson - The unified JSON object from mergeRecordsByFieldPriority
 * @returns {Object} - Sanitized JSON object ready for database storage
 */
export function sanitizeUnifiedJson(unifiedJson, options = {}) {
    if (!unifiedJson || typeof unifiedJson !== 'object') {
        return unifiedJson;
    }

    // Create a deep copy to avoid mutating the original

    const jsonCopy = JSON.parse(JSON.stringify(unifiedJson));
    // const jsonCopy = structuredClone(unifiedJson);


    // Recursively sanitize the entire object
    const sanitized = sanitizeRecursive(jsonCopy, "", options);

    // Enforce output schema strictly: exact keys, no extras, fill missing with nulls.
    // Also ensures no object values leak into scalar leaves.
    const template = JSON.parse(JSON.stringify(OUTPUT_SCHEMA_TEMPLATE));
    // The pipeline output omits top-level `source`; remove it from template validation.
    delete template.source;

    function validateSchema(node, tmpl) {
        // Template leaf: only allow scalar values; if object appears, stringify.
        if (tmpl === null) {
            if (node === null || node === undefined) return null;
            if (typeof node === "number" || typeof node === "string" || typeof node === "boolean") return node;
            // No objects allowed at leaf per schema requirements; serialize to string.
            return JSON.stringify(node);
        }

        if (Array.isArray(tmpl)) {
            // No arrays currently in schema; keep as-is but JSON-safe.
            return Array.isArray(node) ? node : tmpl;
        }

        if (tmpl && typeof tmpl === "object") {
            const out = {};
            const src = (node && typeof node === "object") ? node : {};
            for (const key of Object.keys(tmpl)) {
                out[key] = validateSchema(src[key], tmpl[key]);
            }
            return out;
        }

        // Primitive template types (shouldn't happen) – fallback safely.
        return node ?? tmpl;
    }

    const schemaValidated = validateSchema(sanitized, template);

    // Extra safety net (required): canonicalize again after full sanitize + schema enforcement.
    // const canon = canonicalizeUnitsByFieldPath(schemaValidated , {});
    const isStrict = options.strict !== false; // Default to true for backward compatibility
    const canon = canonicalizeUnitsByFieldPath(schemaValidated, { strict: isStrict });

    /**
     * Ensure output is fully JSON-serializable.
     *
     * Why: even though we only create plain objects, Node's default console output can show
     * nested structures as "[Object]" depending on inspection depth. A JSON round-trip
     * guarantees we return a plain JSON value (no prototypes, no undefined, no circular refs),
     * and it is safe to persist (e.g. Prisma JSONB) and to log via JSON.stringify().
     * 
     *
     */
    formatSelectedFieldsToENotation(canon);
    return JSON.parse(JSON.stringify(canon));
}



/**
 * Known materials that can be promoted from polymerType to genericType
 * These are valid polymer/material tokens that should be recognized
 */
const KNOWN_MATERIALS = new Set([
    // PE family
    'PE', 'LDPE', 'LLDPE', 'HDPE', 'UHMWPE', 'VLDPE',
    // PP
    'PP',
    // PA/Nylon family
    'PA', 'NYLON', 'PA6', 'PA66', 'PA610', 'PA12',
    // POM/Acetal
    'POM', 'ACETAL',
    // PBT
    'PBT',
    // PET
    'PET',
    // PPS
    'PPS',
    // PEEK family
    'PEEK', 'PEK', 'PEKK',
    // LCP
    'LCP',
    // PTFE
    'PTFE',
    // PVDF
    'PVDF',
    // PCT
    'PCT',
    // PTT
    'PTT',
    // TPE-E family
    'TPE-E', 'TPEE', 'TPC-ET', 'COPE',
    // TPV
    'TPV',
    // TPU
    'TPU',
    // PLA
    'PLA',
    // PS family
    'PS', 'GPPS', 'HIPS',
    // ABS
    'ABS',
    // SAN
    'SAN',
    // ASA
    'ASA',
    // PC
    'PC',
    // PMMA
    'PMMA',
    // PVC
    'PVC',
    // PPO/PPE
    'PPO', 'PPE', 'NORYL',
    // PSU family
    'PSU', 'PESU', 'PPSU',
    // PEI
    'PEI',
    // PAR
    'PAR',
    // COP/COC
    'COP', 'COC',
    // PC/ABS
    'PC/ABS'
]);

/**
 * Semi-crystalline polymers (morphology classification)
 */
const SEMI_CRYSTALLINE_MATERIALS = new Set([
    // PE family
    'PE', 'LDPE', 'LLDPE', 'HDPE', 'UHMWPE', 'VLDPE',
    // PP
    'PP',
    // PA/Nylon family
    'PA', 'NYLON', 'PA6', 'PA66', 'PA610', 'PA12',
    // POM/Acetal
    'POM', 'ACETAL',
    // PBT
    'PBT',
    // PET
    'PET',
    // PPS
    'PPS',
    // PEEK family
    'PEEK', 'PEK', 'PEKK',
    // LCP
    'LCP',
    // PTFE
    'PTFE',
    // PVDF
    'PVDF',
    // PCT
    'PCT',
    // PTT
    'PTT',
    // TPE-E family
    'TPE-E', 'TPEE', 'TPC-ET', 'COPE',
    // TPV
    'TPV',
    // TPU
    'TPU',
    // PLA
    'PLA'
]);

/**
 * Amorphous polymers (morphology classification)
 */
const AMORPHOUS_MATERIALS = new Set([
    // PS family
    'PS', 'GPPS', 'HIPS',
    // ABS
    'ABS',
    // SAN
    'SAN',
    // ASA
    'ASA',
    // PC
    'PC',
    // PMMA
    'PMMA',
    // PVC
    'PVC',
    // PPO/PPE
    'PPO', 'PPE', 'NORYL',
    // PSU family
    'PSU', 'PESU', 'PPSU',
    // PEI
    'PEI',
    // PAR
    'PAR',
    // COP/COC
    'COP', 'COC',
    // PC/ABS
    'PC/ABS'
]);

/**
 * Garbage values that should be treated as null
 */
const GARBAGE_VALUES = new Set([
    'POLYMER',
    'PLASTIC',
    'MATERIAL',
    'RESIN',
    'UNKNOWN',
    'N/A',
    'NA',
    'NULL',
    'UNDEFINED',
    ''
]);



function normalizePolymerFullNameForLookup(value) {
    if (!value || typeof value !== "string") return null;
    let s = value.trim().toUpperCase();

    // strip common trailing descriptors (ONLY at the end)
    s = s.replace(/\b(?:RESINS?|RESIN|MATERIAL|PLASTIC|COMPOUND|GRADE)\b\s*$/i, "");
    s = s.replace(/\s+/g, " ").trim();
    return s || null;
}

function mapPolymerFullNameToAbbrev(value) {
    const norm = normalizePolymerFullNameForLookup(value);
    if (!norm) return null;

    // exact
    const exact = POLYMER_NAME_TO_ABBREV[norm];
    if (exact) return exact;

    // contains (prefer longer keys)
    for (const k of POLYMER_FULLNAME_KEYS) {
        if (norm.includes(k)) return POLYMER_NAME_TO_ABBREV[k];
    }

    return null;
}



// function containsValidMaterialPrefix(value) {
//     if (!value) return false;
//     const normalized = normalizeMaterialString(value);
//     if (!normalized) return false;

//     // Check if it's a direct match
//     if (KNOWN_MATERIALS.has(normalized)) {
//         return true;
//     }

//     // Check if it starts with a known material (preserves grades like "PE-HD", "PA6-GF35")
//     const cleaned = normalized.replace(/[\s\-_\/\+]/g, '');
//     const sortedMaterials = Array.from(KNOWN_MATERIALS).sort((a, b) => b.length - a.length);

//     for (const material of sortedMaterials) {
//         const materialCleaned = material.replace(/[\s\-_\/\+]/g, '');
//         // Check if value starts with material (preserves suffixes like -HD, -LD, -GF35)
//         if (cleaned.startsWith(materialCleaned) || normalized.startsWith(material)) {
//             return true;
//         }
//     }

//     return false;
// }

/**
 * Gets the base material from a value (for classification only, not for replacement)
 * Preserves the original value structure but extracts base material for morphology classification
 * @param {string|null|undefined} value - The value to extract base material from
 * @returns {string|null} - Base material token or null
 */
function getBaseMaterialForClassification(value) {
    if (!value) return null;
    return fuzzyMatchMaterial(value);
}

function containsStandaloneToken(normalized, token) {
    // token like "PLA", "PP", "PA6"
    // must be separated by non-alnum boundaries
    const rx = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`);
    return rx.test(normalized);
}



/**
 * Normalizes a string value: trims whitespace and converts to uppercase for comparison
 * @param {string|null|undefined} value - The value to normalize
 * @returns {string|null} - Normalized string or null
 */
function normalizeMaterialString(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

/**
 * Checks if a value is garbage (should be treated as null)
 * @param {string|null|undefined} value - The value to check
 * @returns {boolean} - True if garbage
 */
function isGarbageValue(value) {
    if (value === null || value === undefined) return true;
    const normalized = normalizeMaterialString(value);
    if (!normalized) return true;
    return GARBAGE_VALUES.has(normalized);
}

/**
 * Checks if a material token is in the known materials set (case-insensitive)
 * @param {string|null|undefined} token - The token to check
 * @returns {boolean} - True if known material
 */
function isKnownMaterial(token) {
    if (!token) return false;
    const normalized = normalizeMaterialString(token);
    if (!normalized) return false;
    return KNOWN_MATERIALS.has(normalized);
}

/**
 * Finds a material match using fuzzy/alias matching
 * Handles variations like "PA6" matching "PA6", "PA 6", "PA-6", "PP+copolymer", etc.
 * @param {string|null|undefined} value - The value to match
 * @returns {string|null} - Matched material token or null
 */
function fuzzyMatchMaterial(value) {
    if (!value) return null;
    const normalized = normalizeMaterialString(value);
    if (!normalized) return null;

    // Direct match
    if (KNOWN_MATERIALS.has(normalized)) {
        return normalized;
    }

    // Handle PP+copolymer variations
    if (normalized.includes('PP') && (normalized.includes('COPOLYMER') || normalized.includes('CO'))) {
        return 'PP';
    }

    // Fuzzy matching: remove spaces, hyphens, underscores, slashes, plus signs
    const cleaned = normalized.replace(/[\s\-_\/\+]/g, '');

    // Check direct match after cleaning
    if (KNOWN_MATERIALS.has(cleaned)) {
        return cleaned;
    }

    // Sort materials by length descending to prefer longer/more specific matches first
    const sortedMaterials = Array.from(KNOWN_MATERIALS).sort((a, b) => b.length - a.length);

    // Check for exact prefix matches first (most specific)
    // This handles cases like "PA6" matching "PA6-GF35" or "PA6GF35"
    for (const material of sortedMaterials) {
        const materialCleaned = material.replace(/[\s\-_\/\+]/g, '');
        // Exact prefix match (e.g., "PA6" in "PA6GF35" or "PA6-GF35")
        if (cleaned.startsWith(materialCleaned)) {
            return material;
        }
    }

    // Check for contained matches (e.g., "PA6" in "PA6-GF35")
    // Only check if material is at least 2 characters to avoid false positives
    for (const material of sortedMaterials) {
        const materialCleaned = material.replace(/[\s\-_\/\+]/g, '');
        if (materialCleaned.length >= 2 && cleaned.includes(materialCleaned)) {
            return material;
        }
    }

    return null;
}

/**
 * Classifies morphology based on genericType
 * @param {string|null|undefined} genericType - The generic type value
 * @returns {string|null} - "semi-crystalline", "amorphous", or null
 */
function classifyMorphology(genericType) {
    if (!genericType) return null;

    const matched = fuzzyMatchMaterial(genericType);
    if (!matched) return null;

    if (SEMI_CRYSTALLINE_MATERIALS.has(matched)) {
        return 'semi-crystalline';
    }
    if (AMORPHOUS_MATERIALS.has(matched)) {
        return 'amorphous';
    }

    return null;
}

/**
 * Sanitizes genericType and polymerType fields, then classifies polymer morphology
 * 
 * Step 1 - Generic type sanitization:
 * - Normalize strings: trim
 * - Treat garbage as null
 * - If genericType is valid → keep it
 * - If genericType is null AND polymerType exists AND polymerType is a known_material token → set genericType = polymerType
 * - If both missing → keep both null
 * - If genericType is garbage → drop it → re-apply case 3/2
 * - If polymerType is garbage AND genericType missing → drop it → case 3
 * 
 * Step 2 - Morphology classification:
 * - Set polymerType to "semi-crystalline" or "amorphous" based on sanitized genericType
 * - Use fuzzy/alias matching if exact match isn't found
 * - If no match, polymerType = null
 * 
 * @param {Object} record - The record object with general.generic_type and general.polymer_type
 * @returns {Object} - The record with sanitized and classified fields
 */
// export function sanitizeGenericAndClassifyPolymer(record) {
//     if (!record || typeof record !== 'object') return record;
//     if (!record.general || typeof record.general !== 'object') return record;

//     // Ensure the structure exists
//     if (!record.general.generic_type) {
//         record.general.generic_type = { value: null };
//     }
//     if (!record.general.polymer_type) {
//         record.general.polymer_type = { value: null };
//     }

//     // Extract current values
//     let genericType = record.general.generic_type.value;
//     let polymerType = record.general.polymer_type.value;

//     // Step 1: Sanitize genericType and polymerType

//     // Normalize and check for garbage
//     let normalizedGeneric = normalizeMaterialString(genericType);
//     const normalizedPolymer = normalizeMaterialString(polymerType);

//     let isGenericGarbage = isGarbageValue(genericType);
//     const isPolymerGarbage = isGarbageValue(polymerType);

//     let isGenericValid = !isGenericGarbage && normalizedGeneric;
//     const isPolymerValid = !isPolymerGarbage && normalizedPolymer;

//     // Case 1: If genericType is valid → keep it (keep existing polymerType if present; don't overwrite yet)
//     if (isGenericValid) {
//         // Keep genericType as-is (already valid)
//         // Don't overwrite polymerType yet - will be set in Step 2
//     }
//     // Case 2: If genericType is null AND polymerType exists AND polymerType is a known_material token → set genericType = polymerType
//     else if (!isGenericValid && isPolymerValid) {
//         const matchedPolymer = fuzzyMatchMaterial(polymerType);
//         if (matchedPolymer) {
//             genericType = matchedPolymer;
//             normalizedGeneric = matchedPolymer;
//             isGenericGarbage = false;
//             isGenericValid = true;
//         } else {
//             // polymerType is not a known material, treat as garbage
//             polymerType = null;
//         }
//     }
//     // Case 3: If both missing → keep both null
//     else if (!isGenericValid && !isPolymerValid) {
//         genericType = null;
//         polymerType = null;
//     }
//     // Case 4: If genericType is garbage → drop it → re-apply case 3/2
//     else if (isGenericGarbage) {
//         genericType = null;
//         normalizedGeneric = null;
//         isGenericGarbage = true;
//         isGenericValid = false;
//         // Re-apply case 2 or 3
//         if (isPolymerValid) {
//             const matchedPolymer = fuzzyMatchMaterial(polymerType);
//             if (matchedPolymer) {
//                 genericType = matchedPolymer;
//                 normalizedGeneric = matchedPolymer;
//                 isGenericGarbage = false;
//                 isGenericValid = true;
//             } else {
//                 polymerType = null;
//             }
//         } else {
//             polymerType = null;
//         }
//     }
//     // Case 5: If polymerType is garbage AND genericType missing → drop it → case 3
//     else if (isPolymerGarbage && !isGenericValid) {
//         polymerType = null;
//         genericType = null;
//     }

//     // Step 2: Morphology classification based on sanitized genericType
//     let morphology = null;
//     if (genericType) {
//         morphology = classifyMorphology(genericType);
//     }

//     // Update the record
//     record.general.generic_type.value = genericType;
//     record.general.polymer_type.value = morphology; // Set to morphology classification

//     return record;
// }

// /**
//  * Extracts valid material from mixed values (removes garbage parts)
//  * Handles cases like "PE, Unspecified" -> "PE", "PA6, Unknown" -> "PA6"
//  * Preserves grades like "PE-HD, Unspecified" -> "PE-HD"
//  * @param {string|null|undefined} value - The value to clean
//  * @returns {string|null} - Cleaned value with only valid material part, or null
//  */
// function extractValidMaterialFromMixedValue(value) {
//     if (!value) return null;
//     if (typeof value !== 'string') return null;

//     const trimmed = value.trim();
//     if (!trimmed) return null;

//     // Check if it's garbage
//     if (isGarbageValue(trimmed)) return null;

//     // Check if it contains a valid material prefix (preserves grades)
//     if (containsValidMaterialPrefix(trimmed)) {
//         // If the whole value is valid, return it (preserves grades like "PE-HD")
//         return trimmed;
//     }

//     // Split by comma and check each part
//     const parts = trimmed.split(',').map(p => p.trim()).filter(p => p);

//     // Find the part that contains a valid material
//     for (const part of parts) {
//         if (containsValidMaterialPrefix(part)) {
//             // Return the valid part (preserves grades)
//             return part;
//         }
//     }

//     // If no valid material found, try fuzzy matching on the whole value
//     const matched = fuzzyMatchMaterial(trimmed);
//     if (matched) {
//         // If fuzzy match found, check if original value contains the matched material
//         // Preserve original if it contains the matched material with additional info (grades)
//         const normalized = normalizeMaterialString(trimmed);
//         const matchedNormalized = normalizeMaterialString(matched);

//         // If original starts with matched material, preserve original (for grades)
//         if (normalized && matchedNormalized && normalized.startsWith(matchedNormalized)) {
//             // Extract the part that starts with the matched material
//             for (const part of parts) {
//                 const partNormalized = normalizeMaterialString(part);
//                 if (partNormalized && partNormalized.startsWith(matchedNormalized)) {
//                     return part; // Preserve grade info
//                 }
//             }
//             // If no part found, return the matched material
//             return matched;
//         }
//         return matched;
//     }

//     return null;
// }


const POLYMER_NAME_TO_ABBREV = {
    'POLYETHYLENE': 'PE',
    'POLYPROPYLENE': 'PP',
    'POLYAMIDE': 'PA',
    'NYLON': 'PA',
    'POLYACETAL': 'POM',
    'ACETAL': 'POM',
    'POLYBUTYLENE TEREPHTHALATE': 'PBT',
    'POLYETHYLENE TEREPHTHALATE': 'PET',
    'POLYPHENYLENE SULFIDE': 'PPS',
    'POLYETHER ETHER KETONE': 'PEEK',
    'POLYSTYRENE': 'PS',
    'ACRYLONITRILE BUTADIENE STYRENE': 'ABS',
    'POLYCARBONATE': 'PC',
    'POLYMETHYL METHACRYLATE': 'PMMA',
    'POLYVINYL CHLORIDE': 'PVC',
    'POLYPHENYLENE OXIDE': 'PPO',
    'POLYSULFONE': 'PSU',
    'POLYETHERIMIDE': 'PEI',
    'POLYARYLATE': 'PAR',
    'CYCLIC OLEFIN COPOLYMER': 'COP',
    'CYCLIC OLEFIN POLYMER': 'COC',
    'VERY LOW DENSITY POLYETHYLENE': 'VLDPE'
};


const POLYMER_FULLNAME_KEYS = Object.keys(POLYMER_NAME_TO_ABBREV)
    .sort((a, b) => b.length - a.length); // longest first

/**
 * Extracts material code from parentheses, e.g., "Polyethylene (PE)" -> "PE"
 * @param {string} value - The value to extract from
 * @returns {string|null} - Extracted material code or null
 */
function extractMaterialFromParentheses(value) {
    if (!value || typeof value !== 'string') return null;

    // Match patterns like "(PE)", "(PA6)", "(PP)", etc.
    const parenMatch = value.match(/\(([A-Z0-9\/\-\+]+)\)/i);
    if (parenMatch && parenMatch[1]) {
        const code = parenMatch[1].trim().toUpperCase();
        if (KNOWN_MATERIALS.has(code) || containsValidMaterialPrefix(code)) {
            return code;
        }
        // Try fuzzy match on the code
        const matched = fuzzyMatchMaterial(code);
        if (matched) return matched;
    }

    return null;
}


function looksLikeMaterialToken(s) {
    const t = String(s).trim().toUpperCase();
    // Allows: PE, PLA, PA6, PC/ABS, PE-HD, PA6-GF35
    // Rejects: "THERMOPLASTIC SEMICONDUCTIVE COMPOUND"
    return /^[A-Z]{2,6}\d{0,3}([\/\-+][A-Z0-9]{1,10})?$/.test(t);
}

/**
 * Checks if a value contains a valid material prefix (preserves grades)
 * Now also checks for materials in parentheses and full names
 * @param {string|null|undefined} value - The value to check
 * @returns {boolean} - True if contains valid material
 */
function containsValidMaterialPrefix(value) {
    if (!value) return false;
    const normalized = normalizeMaterialString(value);
    if (!normalized) return false;

    // Check if it's a direct match
    if (KNOWN_MATERIALS.has(normalized)) {
        return true;
    }

    // Check for material code in parentheses (e.g., "Polyethylene (PE)" -> "PE")
    const parenCode = extractMaterialFromParentheses(value);
    if (parenCode) {
        return true;
    }

    // adding.....
    // ✅ 3) FULL NAME → ABBREV mapping (ADD HERE)
    const mapped = mapPolymerFullNameToAbbrev(value);
    if (mapped && KNOWN_MATERIALS.has(mapped)) return true;

    // Check if full name maps to an abbreviation
    const abbrev = POLYMER_NAME_TO_ABBREV[normalized];
    if (abbrev && KNOWN_MATERIALS.has(abbrev)) {
        return true;
    }

    // Check if it starts with a known material (preserves grades like "PE-HD", "PA6-GF35")
    const cleaned = normalized.replace(/[\s\-_\/\+]/g, '');
    const sortedMaterials = Array.from(KNOWN_MATERIALS).sort((a, b) => b.length - a.length);

    for (const material of sortedMaterials) {
        const materialCleaned = material.replace(/[\s\-_\/\+]/g, '');
        // Check if value starts with material (preserves suffixes like -HD, -LD, -GF35)
        if (cleaned.startsWith(materialCleaned) || normalized.startsWith(material)) {
            return true;
        }
    }

    // Check if value contains a known material anywhere (not just at start)
    // This handles cases like "Polyethylene (PE)" where PE is in the middle

    //! changed
    // for (const material of sortedMaterials) {
    //     const materialCleaned = material.replace(/[\s\-_\/\+]/g, '');
    //     if (cleaned.includes(materialCleaned) && materialCleaned.length >= 2) {
    //         return true;
    //     }
    //     // Also check normalized string for material
    //     if (normalized.includes(material) && material.length >= 2) {
    //         return true;
    //     }
    // }

    // Standalone token match only (prevents THERMO(PLA)STIC -> PLA)
    for (const material of sortedMaterials) {
        if (material.length < 2) continue;
        if (containsStandaloneToken(normalized, material)) {
            return true;
        }
    }


    // Check if any part of the normalized value matches a full name
    for (const [fullName, abbrev] of Object.entries(POLYMER_NAME_TO_ABBREV)) {
        if (normalized.includes(fullName) && KNOWN_MATERIALS.has(abbrev)) {
            return true;
        }
    }

    return false;
}

/**
 * Extracts the material code from a value, preferring codes in parentheses
 * Handles "Polyethylene (PE)" -> "PE", "PE-HD" -> "PE-HD", etc.
 * @param {string|null|undefined} value - The value to extract from
 * @returns {string|null} - Extracted material code or null
 */
function extractMaterialCode(value) {
    if (!value) return null;
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    // First, try to extract from parentheses (most reliable)
    const parenCode = extractMaterialFromParentheses(trimmed);
    if (parenCode) {
        return parenCode;
    }

    //! adddingg.............
    // 2) FULL NAME → ABBREV (NEW)
    const mapped = mapPolymerFullNameToAbbrev(trimmed);
    if (mapped && KNOWN_MATERIALS.has(mapped)) return mapped;

    // Check if full name maps to abbreviation
    const normalized = normalizeMaterialString(trimmed);
    const abbrev = POLYMER_NAME_TO_ABBREV[normalized];

    if (abbrev && KNOWN_MATERIALS.has(abbrev)) {
        return abbrev;
    }

    // If value contains valid material prefix, return it (preserves grades)
    if (containsValidMaterialPrefix(trimmed)) {
        // Try to extract just the material part, preserving grades
        const matched = fuzzyMatchMaterial(trimmed);
        if (matched) {
            // If the original starts with the matched material, preserve original (for grades)
            const normalizedTrimmed = normalizeMaterialString(trimmed);
            const matchedNormalized = normalizeMaterialString(matched);
            if (normalizedTrimmed && matchedNormalized && normalizedTrimmed.startsWith(matchedNormalized)) {
                // Extract the part that starts with the material (preserves grades like "PE-HD")
                const parts = trimmed.split(/[\s,]/).filter(p => p);
                for (const part of parts) {
                    const partNormalized = normalizeMaterialString(part);
                    if (partNormalized && partNormalized.startsWith(matchedNormalized)) {
                        return part;
                    }
                }
            }
            return matched;
        }
        return trimmed; // Return original if it contains valid material
    }

    return null;
}


/**
 * Extracts valid material from mixed/comma-separated values (removes garbage parts)
 * Examples:
 *  - "PE, unspecified" -> "PE"
 *  - "PA6, Unknown" -> "PA6"
 *  - "PE-HD, unspecified" -> "PE-HD"  (preserves grades)
 *  - "Polyethylene (PE), unspecified" -> "PE" (via extractMaterialCode)
 *
 * Returns:
 *  - a cleaned material string (prefer code/grade), or null if nothing valid found
 */
function extractValidMaterialFromMixedValue(value) {
    if (!value || typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isGarbageValue(trimmed)) return null;

    // Split on comma (primary issue), keep non-empty parts
    const parts = trimmed.split(",").map(p => p.trim()).filter(Boolean);

    // 1) Prefer parts that clearly contain a valid material (and extract code if possible)
    for (const part of parts) {
        if (isGarbageValue(part)) continue;

        if (containsValidMaterialPrefix(part)) {
            // Prefer extracting a proper material code (handles parentheses/full name mapping in Code B)
            const extracted = extractMaterialCode(part);
            return extracted || part; // part preserves grades like "PE-HD"
        }
    }

    // 2) If no part matched via containsValidMaterialPrefix, try extracting code anyway
    //    (covers cases where mapping/paren extraction works but prefix check is conservative)
    for (const part of parts) {
        if (isGarbageValue(part)) continue;
        const extracted = extractMaterialCode(part);
        if (extracted) return extracted;
    }

    // 3) Last resort: fuzzy match the whole string and try to preserve grade if present
    const matched = fuzzyMatchMaterial(trimmed);
    if (matched) {
        const normalizedTrimmed = normalizeMaterialString(trimmed);
        const matchedNormalized = normalizeMaterialString(matched);

        // If input starts with the matched material, preserve the best matching part
        if (normalizedTrimmed && matchedNormalized && normalizedTrimmed.startsWith(matchedNormalized)) {
            for (const part of parts) {
                const partNormalized = normalizeMaterialString(part);
                if (partNormalized && partNormalized.startsWith(matchedNormalized)) {
                    return part; // preserve grade info if present
                }
            }
        }
        return matched;
    }

    return null;
}


// ... existing code in sanitizeGenericAndClassifyPolymer function ...

export function sanitizeGenericAndClassifyPolymer(record) {
    if (!record || typeof record !== 'object') return record;
    if (!record.general || typeof record.general !== 'object') return record;

    // Ensure the structure exists
    if (!record.general.generic_type) {
        record.general.generic_type = { value: null };
    }
    if (!record.general.polymer_type) {
        record.general.polymer_type = { value: null };
    }

    // Extract current values
    let genericType = record.general.generic_type.value;
    let polymerType = record.general.polymer_type.value;



    // NEW: Pre-clean genericType for comma-mixed inputs like "PE, unspecified"
    if (genericType) {
        const cleaned = extractValidMaterialFromMixedValue(genericType);
        if (cleaned) {
            genericType = cleaned;
        }
    }

    // Step 1: Sanitize genericType and polymerType

    // Normalize and check for garbage
    let normalizedGeneric = normalizeMaterialString(genericType);
    const normalizedPolymer = normalizeMaterialString(polymerType);

    let isGenericGarbage = isGarbageValue(genericType);
    const isPolymerGarbage = isGarbageValue(polymerType);

    // Check if genericType contains valid material prefix (preserves grades)
    const genericHasValidPrefix = containsValidMaterialPrefix(genericType);
    const polymerHasValidPrefix = containsValidMaterialPrefix(polymerType);

    let isGenericValid = !isGenericGarbage && normalizedGeneric && genericHasValidPrefix;
    const isPolymerValid = !isPolymerGarbage && normalizedPolymer && polymerHasValidPrefix;

    // Case 1: If genericType is valid → keep it (preserve original value including grades)
    if (isGenericValid) {
        // Extract material code if it's in parentheses or full name (e.g., "Polyethylene (PE)" -> "PE")
        const extracted = extractMaterialCode(genericType);
        if (extracted) {
            genericType = extracted; // Use extracted code
        }
        // Otherwise keep as-is (preserves grades like "PE-HD", "PA6-GF35")
    }
    // Case 2: If genericType is null AND polymerType exists AND polymerType contains valid material → set genericType = extracted material code
    else if (!isGenericValid && isPolymerValid && looksLikeMaterialToken(polymerType)) {
        // Extract material code from polymerType (e.g., "Polyethylene (PE)" -> "PE")
        const extracted = extractMaterialCode(polymerType);
        if (extracted) {
            genericType = extracted; // Use extracted code
            normalizedGeneric = normalizeMaterialString(extracted);
            isGenericGarbage = false;
            isGenericValid = true;
        } else {
            // Fallback: use original polymerType value if extraction fails
            genericType = polymerType;
            normalizedGeneric = normalizedPolymer;
            isGenericGarbage = false;
            isGenericValid = true;
        }
    }
    // Case 3: If both missing → keep both null
    else if (!isGenericValid && !isPolymerValid) {
        genericType = null;
        polymerType = null;
    }
    // Case 4: If genericType is garbage → drop it → re-apply case 3/2
    else if (isGenericGarbage) {
        genericType = null;
        normalizedGeneric = null;
        isGenericGarbage = true;
        isGenericValid = false;
        // Re-apply case 2 or 3
        if (isPolymerValid) {
            // Extract material code from polymerType
            const extracted = extractMaterialCode(polymerType);
            if (extracted) {
                genericType = extracted;
                normalizedGeneric = normalizeMaterialString(extracted);
                isGenericGarbage = false;
                isGenericValid = true;
            } else {
                genericType = polymerType;
                normalizedGeneric = normalizedPolymer;
                isGenericGarbage = false;
                isGenericValid = true;
            }
        } else {
            polymerType = null;
        }
    }
    // Case 5: If polymerType is garbage AND genericType missing → drop it → case 3
    else if (isPolymerGarbage && !isGenericValid) {
        polymerType = null;
        genericType = null;
    }

    // Step 2: Morphology classification based on sanitized genericType
    // Use base material extraction for classification, but preserve original genericType value
    let morphology = null;
    if (genericType) {
        // Extract base material for classification only (e.g., "PE-HD" -> "PE" for classification)
        const baseMaterial = getBaseMaterialForClassification(genericType);
        if (baseMaterial) {
            if (SEMI_CRYSTALLINE_MATERIALS.has(baseMaterial)) {
                morphology = 'semi-crystalline';
            } else if (AMORPHOUS_MATERIALS.has(baseMaterial)) {
                morphology = 'amorphous';
            }
        }
    }

    // Update the record - preserve original genericType value (including grades)
    record.general.generic_type.value = genericType; // Extracted code (e.g., "PE" from "Polyethylene (PE)")
    record.general.polymer_type.value = morphology; // Set to morphology classification

    return record;
}



// export function sanitizeGenericAndClassifyPolymer(record) {
//     if (!record || typeof record !== 'object') return record;
//     if (!record.general || typeof record.general !== 'object') return record;

//     // Ensure the structure exists
//     if (!record.general.generic_type) {
//         record.general.generic_type = { value: null };
//     }
//     if (!record.general.polymer_type) {
//         record.general.polymer_type = { value: null };
//     }

//     // Extract current values
//     let genericType = record.general.generic_type.value;
//     let polymerType = record.general.polymer_type.value;

//     // Step 1: Sanitize genericType and polymerType

//     // Normalize and check for garbage
//     let normalizedGeneric = normalizeMaterialString(genericType);
//     const normalizedPolymer = normalizeMaterialString(polymerType);

//     let isGenericGarbage = isGarbageValue(genericType);
//     const isPolymerGarbage = isGarbageValue(polymerType);

//     // Check if genericType contains valid material prefix (preserves grades)
//     const genericHasValidPrefix = containsValidMaterialPrefix(genericType);
//     const polymerHasValidPrefix = containsValidMaterialPrefix(polymerType);

//     let isGenericValid = !isGenericGarbage && normalizedGeneric && genericHasValidPrefix;
//     const isPolymerValid = !isPolymerGarbage && normalizedPolymer && polymerHasValidPrefix;

//     // Case 1: If genericType is valid → keep it (preserve original value including grades)
//     if (isGenericValid) {
//         // Keep genericType as-is (preserves grades like "PE-HD", "PA6-GF35")
//         // Don't overwrite polymerType yet - will be set in Step 2
//     }
//     // Case 2: If genericType is null AND polymerType exists AND polymerType contains valid material → set genericType = polymerType (preserve original)
//     else if (!isGenericValid && isPolymerValid) {
//         // Preserve original polymerType value (including grades) when promoting to genericType
//         genericType = polymerType; // Keep original value, don't use fuzzy match result
//         normalizedGeneric = normalizedPolymer;
//         isGenericGarbage = false;
//         isGenericValid = true;
//     }
//     // Case 3: If both missing → keep both null
//     else if (!isGenericValid && !isPolymerValid) {
//         genericType = null;
//         polymerType = null;
//     }
//     // Case 4: If genericType is garbage → drop it → re-apply case 3/2
//     else if (isGenericGarbage) {
//         genericType = null;
//         normalizedGeneric = null;
//         isGenericGarbage = true;
//         isGenericValid = false;
//         // Re-apply case 2 or 3
//         if (isPolymerValid) {
//             // Preserve original polymerType value (including grades) when promoting to genericType
//             genericType = polymerType; // Keep original value, don't use fuzzy match result
//             normalizedGeneric = normalizedPolymer;
//             isGenericGarbage = false;
//             isGenericValid = true;
//         } else {
//             polymerType = null;
//         }
//     }
//     // Case 5: If polymerType is garbage AND genericType missing → drop it → case 3
//     else if (isPolymerGarbage && !isGenericValid) {
//         polymerType = null;
//         genericType = null;
//     }

//     // Step 2: Morphology classification based on sanitized genericType
//     // Use base material extraction for classification, but preserve original genericType value
//     let morphology = null;
//     if (genericType) {
//         // Extract base material for classification only (e.g., "PE-HD" -> "PE" for classification)
//         const baseMaterial = getBaseMaterialForClassification(genericType);
//         if (baseMaterial) {
//             if (SEMI_CRYSTALLINE_MATERIALS.has(baseMaterial)) {
//                 morphology = 'semi-crystalline';
//             } else if (AMORPHOUS_MATERIALS.has(baseMaterial)) {
//                 morphology = 'amorphous';
//             }
//         }
//     }

//     // Update the record - preserve original genericType value (including grades)
//     record.general.generic_type.value = genericType; // Original value preserved (e.g., "PE-HD")
//     record.general.polymer_type.value = morphology; // Set to morphology classification

//     return record;
// }

