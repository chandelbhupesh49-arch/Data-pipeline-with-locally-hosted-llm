import OpenAI from "openai";
import "dotenv/config";
// import { outputSchema } from "./transformJson.js";
import { saveRawLlmJson } from "./saveSanitizedJson.js";
import logger from "./logger/logger.js";

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



function isNilish(v) {
  return v === null || v === undefined || v === '';
}

function mergeValueObject(preferred, fallback) {
  if (!preferred || typeof preferred !== 'object') return fallback;
  if (!fallback || typeof fallback !== 'object') return preferred;

  const out = { ...preferred };
  for (const key of Object.keys(fallback)) {
    if (isNilish(out[key])) {
      out[key] = fallback[key];
    }
  }
  return out;
}

function repairKnownSchemaAliases(candidate) {
  const cloned = (candidate && typeof candidate === 'object')
    ? JSON.parse(JSON.stringify(candidate))
    : {};

  if (cloned.electrical && typeof cloned.electrical === 'object') {
    const electrical = cloned.electrical;

    // LLM sometimes writes comparative_tracking_index instead of comparative_tracking_index_cti
    if (electrical.comparative_tracking_index) {
      if (!electrical.comparative_tracking_index_cti) {
        electrical.comparative_tracking_index_cti = electrical.comparative_tracking_index;
      } else {
        electrical.comparative_tracking_index_cti = mergeValueObject(
          electrical.comparative_tracking_index_cti,
          electrical.comparative_tracking_index
        );
      }

      delete electrical.comparative_tracking_index;
    }
  }

  return cloned;
}

/**
 * Helper function to generate JSON schema from template
 * (Reused from transformJson.js logic)
 */
function schemaFromTemplate(template) {
  if (template === null) {
    return { type: ["null", "string", "number", "boolean"] };
  }
  if (Array.isArray(template)) {
    return { type: "array", items: template[0] ? schemaFromTemplate(template[0]) : {} };
  }
  if (typeof template === "object") {
    const properties = {};
    const required = Object.keys(template);
    for (const k of required) properties[k] = schemaFromTemplate(template[k]);
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false
    };
  }
  return { type: typeof template };
}

function safeJsonParse(maybeJson) {
  if (maybeJson && typeof maybeJson === "object") return maybeJson;

  if (typeof maybeJson !== "string") {
    throw new Error(`LLM output not string/object: ${typeof maybeJson}`);
  }

  let s = maybeJson.trim();

  // In case the model ever returns code fences
  s = s.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  return JSON.parse(s);
}

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


const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

const RAW_LLM_SAVE =
  (process.env.RAW_LLM_SAVE || "false").toLowerCase() === "true";
const RAW_LLM_SAVE_OUTPUT_DIR =
  process.env.RAW_LLM_SAVE_OUTPUT_DIR || "./raw_llm_save";

/**
 * Processes a JSON file from a URL by:
 * 1. Downloading the JSON from the URL
 * 2. Making an API call to OpenAI for conversion to the standardized JSON format
 * 
 * This is similar to the existing transformJson function but works with URLs instead of file paths.
 * 
 * @param {string} jsonUrl - The URL of the JSON file (${base_url}/data/${folder_name}/${file_name})
 * @param {string} source - The source keyword (default: "specialchem")
 * @param {string} [materialName] - Optional material/folder name for raw-save naming
 * @returns {Promise<Object>} - The transformed JSON data matching the output schema
 */
export async function processJsonFromUrl(jsonUrl, source = "specialchem", materialName) {
  const LOCALLY_HOSTED_LLM_BASE_URL = process.env.LOCALLY_HOSTED_LLM_BASE_URL2;
  const templateJson = JSON.stringify(outputSchema, null, 2);
  try {
    // Download the JSON from the URL
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to download JSON from ${jsonUrl}: ${response.statusText}`);
    }

    const jsonText = await response.text();
    const inputObj = JSON.parse(jsonText);

    // Use the same transformation logic as transformJson
    const strictSchema = schemaFromTemplate(outputSchema);

    //         const response_openai = await client.chat.completions.create({
    //             model: "gpt-5.1",
    //             messages: [
    //                 {
    //                     role: "system",
    //                     content: `
    // You are a strict information-extraction + mapping engine.

    // GOAL
    // Map INPUT_JSON into ONE JSON object that matches the provided JSON schema exactly.
    // Every key must be present. If not explicitly available in INPUT_JSON, set it to null.

    // HARD RULES
    // - Use ONLY information explicitly present in INPUT_JSON. Do NOT guess or infer.
    // - Output MUST be valid JSON only. No markdown, no explanations.
    // - Do NOT add any keys. Do NOT remove any keys.

    // PREFERRED SOURCES INSIDE INPUT_JSON
    // - Use top-level keys like "Product Name", "Supplier", "Product Family", "Conversion Mode", "Description", "Availability", "General Properties".
    // - For properties in "Other Properties" (tables), prefer sections containing "Supplier data" when duplicates exist.
    //   If Supplier data is empty, use SI units. If SI is empty, use Imperial.

    // VALUE OBJECT RULES
    // For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
    // - Split combined "Value & unit" like "6600 MPa" into value=6600 and unit="MPa" when possible.
    // - Put "ISO 178", "IEC 60112" etc into test_method when present.
    // - Put "At 23°C", "At 2 mm/min", "Liquid A", "At 1.6mm" etc into test_condition when present.
    // - If not present, keep that subfield null.

    // MAPPING HINTS (do not invent if missing)
    // - "Product Name" -> general.internal_genics_name.value (and also general.suppliers_trade_name.value if appropriate)
    // - "Supplier" -> general.supplier.value
    // - "Product Family" -> general.polymer_type.value
    // - "Chemical family" -> general.chemical_family.value
    // - "Conversion Mode" -> general.processing.value
    // - "Availability" -> general.regional_availability.value (if it describes availability/status)
    // - "Description" -> general.description.value
    // - "General Properties"."Certifications & Compliance" -> general.certifications_and_compliance.value

    // Property name mappings in tables (by row.Properties):
    // - "Modulus of Elasticity" -> mechanical.tensile_modulus
    // - "Tensile Strength at Break" -> mechanical.stress_at_break
    // - "Tensile Strain at Break" -> mechanical.strain_at_break
    // - "Flexural Modulus" -> mechanical.flexural_modulus
    // - "Flexural Strength" -> mechanical.flexural_strength
    // - "Flexural Strain" -> mechanical.flexural_strain_at_flexural_strength.value
    // - "Impact Strength, Charpy" with "At 23°C" -> mechanical.charpy_impact_strength_23c
    // - "Impact Strength, Charpy" with "At -30°C" -> mechanical.charpy_impact_strength_minus_30c.value
    // - "Impact Strength, Notched Charpy" -> mechanical.charpy_notched_impact_strength_23c (or minus_30c if stated)
    // - "Impact Strength, Notched Izod" -> mechanical.izod_impact_strength_23c (or minus_30c if stated)
    // - "Density" -> physical.density
    // - "Deflection Temperature at 1.8 MPa (264 psi)" -> thermal.temp_of_deflection_under_load_1_80_mpa
    // - "Deflection Temperature at 0.46 MPa (66 psi)" -> thermal.temp_of_deflection_under_load_0_45_mpa.value
    // - "Melting Point" -> thermal.melting_temperature_10c_per_min
    // - "Flame Rating, UL 94" -> thermal.flame_rating_ul_94.value
    // - "Comparative Tracking Index (CTI)" -> electrical.comparative_tracking_index_cti
    // - "Dielectric Strength" -> electrical.electric_strength
    // - "Volume Resistivity" -> electrical.volume_resistivity

    // INPUT_JSON:
    // ${JSON.stringify(inputObj)}
    //         `.trim()
    //                     }
    //                 ],
    //             response_format: {
    //                 type: "json_schema",
    //                 json_schema: {
    //                     name: "material_spec",
    //                     strict: true,
    //                     schema: strictSchema
    //                 }
    //             },
    //             temperature: 0
    //         });

    //         const res = JSON.parse(response_openai.choices[0]?.message?.content ?? "{}");

    //     const prompt = `
    // You are a strict information-extraction + mapping engine.

    // GOAL
    // Map INPUT_JSON into ONE JSON object that matches the provided JSON schema exactly.
    // Every key must be present. If not explicitly available in INPUT_JSON, set it to null.

    // HARD RULES
    // - Use ONLY information explicitly present in INPUT_JSON. Do NOT guess or infer.
    // - Output MUST be valid JSON only. No markdown, no explanations.
    // - Do NOT add any keys. Do NOT remove any keys.

    // PREFERRED SOURCES INSIDE INPUT_JSON
    // - Use top-level keys like "Product Name", "Supplier", "Product Family", "Conversion Mode", "Description", "Availability", "General Properties".
    // - For properties in "Other Properties" (tables), prefer sections containing "Supplier data" when duplicates exist.
    //   If Supplier data is empty, use SI units. If SI is empty, use Imperial.

    // VALUE OBJECT RULES
    // For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
    // - Split combined "Value & unit" like "6600 MPa" into value=6600 and unit="MPa" when possible.
    // - Put "ISO 178", "IEC 60112" etc into test_method when present.
    // - Put "At 23°C", "At 2 mm/min", "Liquid A", "At 1.6mm" etc into test_condition when present.
    // - If not present, keep that subfield null.

    // SOME MAPPING HINTS BUT NOT LIMITED TO (do not invent if missing)
    // - "Product Name" -> general.internal_genics_name.value (and also general.suppliers_trade_name.value if appropriate)
    // - "Supplier" -> general.supplier.value
    // - "Product Family" -> general.polymer_type.value
    // - "Chemical family" -> general.chemical_family.value
    // - "Conversion Mode" -> general.processing.value
    // - "Availability" -> general.regional_availability.value (if it describes availability/status)
    // - "Description" -> general.description.value
    // - "General Properties"."Certifications & Compliance" -> general.certifications_and_compliance.value

    // Property name mappings in tables (by row.Properties):
    // - "Modulus of Elasticity" -> mechanical.tensile_modulus
    // - "Tensile Strength at Break" -> mechanical.stress_at_break
    // - "Tensile Strain at Break" -> mechanical.strain_at_break
    // - "Flexural Modulus" -> mechanical.flexural_modulus
    // - "Flexural Strength" -> mechanical.flexural_strength
    // - "Flexural Strain" -> mechanical.flexural_strain_at_flexural_strength.value
    // - "Impact Strength, Charpy" with "At 23°C" -> mechanical.charpy_impact_strength_23c
    // - "Impact Strength, Charpy" with "At -30°C" -> mechanical.charpy_impact_strength_minus_30c.value
    // - "Impact Strength, Notched Charpy" -> mechanical.charpy_notched_impact_strength_23c (or minus_30c if stated)
    // - "Impact Strength, Notched Izod" -> mechanical.izod_impact_strength_23c (or minus_30c if stated)
    // - "Density" -> physical.density
    // - "Deflection Temperature at 1.8 MPa (264 psi)" -> thermal.temp_of_deflection_under_load_1_80_mpa
    // - "Deflection Temperature at 0.46 MPa (66 psi)" -> thermal.temp_of_deflection_under_load_0_45_mpa.value
    // - "Melting Point" -> thermal.melting_temperature_10c_per_min
    // - "Flame Rating, UL 94" -> thermal.flame_rating_ul_94.value
    // - "Comparative Tracking Index (CTI)" -> electrical.comparative_tracking_index_cti
    // - "Dielectric Strength" -> electrical.electric_strength
    // - "Volume Resistivity" -> electrical.volume_resistivity

    // VERY VERY IMPORTANT : DONT LEAVE ANY APPROPRIATE VALUES THAT FITS IN OUR OUTPUT JSON OBJECT AND IS PRESENT IN INPUT JSON . CROSS VERFIY BEFORE DELIEVING AN OUTPUT !

    // INPUT_JSON:
    // ${JSON.stringify(inputObj)}

    // TEMPLATE_JSON:
    // ${templateJson}

    // Return ONLY one JSON object matching TEMPLATE_JSON exactly.
    //         `.trim();

    const prompt = `
You are a strict information-extraction + mapping engine.

GOAL
Map INPUT_JSON into ONE JSON object that matches TEMPLATE_JSON exactly (same keys, same nesting).
Every key must be present. If not explicitly available in INPUT_JSON, set it to null.

HARD RULES
- Use ONLY information explicitly present in INPUT_JSON. Do NOT guess or infer.
- Output MUST be valid JSON only. No markdown, no explanations.
- Do NOT add any keys. Do NOT remove any keys.
- Do NOT output partial subfields when a property is missing. If "value" is null due to missing data, then unit, test_condition, test_method MUST also be null for that property.
-If value is a plain number (example 6500, 1.21, 167), output it as a JSON number (no quotes). 
-If value is a range or expression (example "0.4 - 0.6", "> 2x1011"), keep it as a string.
-Only set regional_availability if it contains a real region like Asia/Europe/North America; otherwise null.

PREFERRED SOURCES INSIDE INPUT_JSON
- Use top-level keys like "Product Name", "Supplier", "Product Family", "Conversion Mode", "Description", "Availability", "General Properties".
- For properties in "Other Properties" tables:
  1) Prefer rows from sections containing "Supplier data".
  2) If there are duplicates across Supplier data / SI units / Imperial units:
     - Choose the row where "Value & unit" is NON-EMPTY.
     - If Supplier data has non-empty "Value & unit", DO NOT use SI/Imperial for that property.
     - Only fall back to SI units if Supplier data has EMPTY "Value & unit" for that same property.
     - Only fall back to Imperial if BOTH Supplier data and SI units are empty for that property.

BLANK VALUE HANDLING (CRITICAL)
- If a candidate row exists but its "Value & unit" is an empty string, treat it as NOT FOUND.
- When NOT FOUND: set {"value": null, "unit": null, "test_condition": null, "test_method": null} for that property.

VALUE OBJECT RULES
For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
- Split combined "Value & unit" like "6600 MPa" into value=6600 and unit="MPa" when possible.
- If "Value & unit" contains non-numeric tokens like "> 2x1011 ohm-cm", keep value as a STRING for the numeric part or expression (e.g. "> 2x1011") and unit as "ohm-cm".
- Put "ISO 178", "IEC 60112" etc into test_method when present.
- Put "At 23°C", "At 2 mm/min", "Liquid A", "At 1.6mm" etc into test_condition when present.
- If a subfield is not explicitly present, set that subfield to null.

SOME MAPPING HINTS BUT NOT LIMITED TO (do not invent if missing)
- "Product Name" -> general.suppliers_trade_name.value 
- "Supplier" -> general.supplier.value
- "Product Family" -> general.polymer_type.value
- "Chemical family" -> general.chemical_family.value
- "Conversion Mode" -> general.processing.value
- "Availability" -> general.regional_availability.value (copy verbatim)
- "Description" -> general.description.value
- "General Properties"."Certifications & Compliance" -> general.certifications_and_compliance.value

SHRINKAGE MAPPING (ONLY IF EXPLICIT)
- "Linear Mold Shrinkage, Flow" -> rheological.molding_shrinkage_parallel
- "Linear Mold Shrinkage, Transverse" -> rheological.molding_shrinkage_normal
- If shrinkage is given as a range like "0.1 - 0.3 %", set value as the FULL STRING "0.1 - 0.3" and unit as "%". Do NOT invent a single number.
- Use test_method if present (e.g. "ISO 294-4").

Property name mappings in tables (by row.Properties):
- "Modulus of Elasticity" -> mechanical.tensile_modulus
- "Tensile Strength at Break" -> mechanical.stress_at_break
- "Tensile Strain at Break" -> mechanical.strain_at_break
- "Flexural Modulus" -> mechanical.flexural_modulus
- "Flexural Strength" -> mechanical.flexural_strength
- "Flexural Strain" -> mechanical.flexural_strain_at_flexural_strength
- "Impact Strength, Charpy" with "At 23°C" -> mechanical.charpy_impact_strength_23c
- "Impact Strength, Charpy" with "At -30°C" -> mechanical.charpy_impact_strength_minus_30c
- "Impact Strength, Notched Charpy" -> mechanical.charpy_notched_impact_strength_23c (or minus_30c if stated)
- "Impact Strength, Notched Izod" -> mechanical.izod_impact_strength_23c (or minus_30c if stated)
- "Density" -> physical.density
- "Deflection Temperature at 1.8 MPa (264 psi)" -> thermal.temp_of_deflection_under_load_1_80_mpa
- "Deflection Temperature at 0.46 MPa (66 psi)" -> thermal.temp_of_deflection_under_load_0_45_mpa
- "Melting Point" -> thermal.melting_temperature_10c_per_min
- "Flame Rating, UL 94" -> thermal.flame_rating_ul_94
- "Comparative Tracking Index (CTI)" -> electrical.comparative_tracking_index_cti
- NEVER output electrical.comparative_tracking_index
- Use ONLY:
  - electrical.comparative_tracking_index_cti
  - electrical.comparative_tracking_index_cti_plc
- "Dielectric Strength" -> electrical.electric_strength
- "Volume Resistivity" -> electrical.volume_resistivity

IMPORTANT : 
- Look ONLY for explicit filler percentages written like "25% glass fiber" or "15 % mineral".
- Collect all pairs of (percent_number, filler_name) that are explicitly stated.
- Set general.filler.value to the filler_name that has the HIGHEST percent_number.
- Set general.filler_percent.value to that highest percent_number as a JSON NUMBER (no quotes).
- Set general.filler_percent.unit to "%" (only when filler_percent.value is not null).
- If multiple fillers share the same highest percent, choose the one that appears first in Description.
- If Description mentions fillers but no explicit percentages, keep general.filler.value but general.filler_percent.value as null (do NOT guess).

IMPORTANT :
VALUE TYPE RULES (MANDATORY)
For every field shaped like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
1) If the extracted value text is a PURE NUMBER, output it as a JSON number (NO quotes).
   PURE NUMBER means it matches one of:
   - integer/decimal: ^-?\d+(\.\d+)?$

2) If the extracted value contains ANY non-numeric operators/markers, keep it as a STRING:
   markers include: "-", " to ", "~", "±", "<", ">", "≤", "≥", "x10", "×10", "^", "/", "(", ")"

FINAL CHECK (MANDATORY)
Before returning:
- Ensure every key from TEMPLATE_JSON is present.
- Ensure no property has value=null while unit/test_method/test_condition is non-null.
- Ensure duplicates were resolved by selecting NON-EMPTY "Value & unit" with Supplier data priority.

INPUT_JSON:
${JSON.stringify(inputObj)}

TEMPLATE_JSON:
${templateJson}

Return ONLY one JSON object matching TEMPLATE_JSON exactly.
`.trim();


    const blob = await fetch(`${LOCALLY_HOSTED_LLM_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": "gpt-oss:20b-cloud",
        "format": strictSchema,
        "messages": [
          {
            "role": "system",
            "content": prompt
          },
          {
            "role": "user",
            "content": `Extract the required fields from the attached json and return ONLY the JSON.`
          }
        ],
        "stream": false
      })
    });

    if (!blob.ok) {
      const errText = await blob.text();
      throw new Error(`error while making json from json input ${blob.status}: ${errText}`);
    }

    const res = await blob.json();

    const content = res?.message?.content;

    if (!content) {
      throw new Error(`No message.content in LLM response: ${JSON.stringify(res)}`);
    }

    const raw = safeJsonParse(content);

    if (RAW_LLM_SAVE) {
      try {
        const material =
          materialName ||
          "unknown_material";

        await saveRawLlmJson(
          RAW_LLM_SAVE_OUTPUT_DIR,
          material,
          source || "unknown_source",
          raw
        );
      } catch (e) {
        // console.warn("Failed to save raw LLM JSON (JSON source):", e);
        logger.warn("Failed to save raw LLM JSON (JSON source):", e);
      }
    }

    // const formed = normalizeToTemplate(outputSchema, raw);

    const repairedRaw = repairKnownSchemaAliases(raw);
    const formed = normalizeToTemplate(outputSchema, repairedRaw);

    formed.source = source;
    return formed;


    // res.source = source;
    // return res;

  } catch (error) {
    // console.error(`Error processing JSON from URL ${jsonUrl}:`, error);
    logger.error(`Error processing JSON from URL ${jsonUrl}: ${error?.message ?? error}`);
    throw error;
  }
}

