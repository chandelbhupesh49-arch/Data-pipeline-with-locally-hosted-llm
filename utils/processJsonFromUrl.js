import OpenAI from "openai";
import "dotenv/config";
import { outputSchema } from "./transformJson.js";

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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Processes a JSON file from a URL by:
 * 1. Downloading the JSON from the URL
 * 2. Making an API call to OpenAI for conversion to the standardized JSON format
 * 
 * This is similar to the existing transformJson function but works with URLs instead of file paths.
 * 
 * @param {string} jsonUrl - The URL of the JSON file (${base_url}/data/${folder_name}/${file_name})
 * @param {string} source - The source keyword (default: "specialchem")
 * @returns {Promise<Object>} - The transformed JSON data matching the output schema
 */
export async function processJsonFromUrl(jsonUrl, source = "specialchem") {
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

        const response_openai = await client.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: `
You are a strict information-extraction + mapping engine.

GOAL
Map INPUT_JSON into ONE JSON object that matches the provided JSON schema exactly.
Every key must be present. If not explicitly available in INPUT_JSON, set it to null.

HARD RULES
- Use ONLY information explicitly present in INPUT_JSON. Do NOT guess or infer.
- Output MUST be valid JSON only. No markdown, no explanations.
- Do NOT add any keys. Do NOT remove any keys.

PREFERRED SOURCES INSIDE INPUT_JSON
- Use top-level keys like "Product Name", "Supplier", "Product Family", "Conversion Mode", "Description", "Availability", "General Properties".
- For properties in "Other Properties" (tables), prefer sections containing "Supplier data" when duplicates exist.
  If Supplier data is empty, use SI units. If SI is empty, use Imperial.

VALUE OBJECT RULES
For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
- Split combined "Value & unit" like "6600 MPa" into value=6600 and unit="MPa" when possible.
- Put "ISO 178", "IEC 60112" etc into test_method when present.
- Put "At 23°C", "At 2 mm/min", "Liquid A", "At 1.6mm" etc into test_condition when present.
- If not present, keep that subfield null.

MAPPING HINTS (do not invent if missing)
- "Product Name" -> general.internal_genics_name.value (and also general.suppliers_trade_name.value if appropriate)
- "Supplier" -> general.supplier.value
- "Product Family" -> general.polymer_type.value
- "Chemical family" -> general.chemical_family.value
- "Conversion Mode" -> general.processing.value
- "Availability" -> general.regional_availability.value (if it describes availability/status)
- "Description" -> general.description.value
- "General Properties"."Certifications & Compliance" -> general.certifications_and_compliance.value

Property name mappings in tables (by row.Properties):
- "Modulus of Elasticity" -> mechanical.tensile_modulus
- "Tensile Strength at Break" -> mechanical.stress_at_break
- "Tensile Strain at Break" -> mechanical.strain_at_break
- "Flexural Modulus" -> mechanical.flexural_modulus
- "Flexural Strength" -> mechanical.flexural_strength
- "Flexural Strain" -> mechanical.flexural_strain_at_flexural_strength.value
- "Impact Strength, Charpy" with "At 23°C" -> mechanical.charpy_impact_strength_23c
- "Impact Strength, Charpy" with "At -30°C" -> mechanical.charpy_impact_strength_minus_30c.value
- "Impact Strength, Notched Charpy" -> mechanical.charpy_notched_impact_strength_23c (or minus_30c if stated)
- "Impact Strength, Notched Izod" -> mechanical.izod_impact_strength_23c (or minus_30c if stated)
- "Density" -> physical.density
- "Deflection Temperature at 1.8 MPa (264 psi)" -> thermal.temp_of_deflection_under_load_1_80_mpa
- "Deflection Temperature at 0.46 MPa (66 psi)" -> thermal.temp_of_deflection_under_load_0_45_mpa.value
- "Melting Point" -> thermal.melting_temperature_10c_per_min
- "Flame Rating, UL 94" -> thermal.flame_rating_ul_94.value
- "Comparative Tracking Index (CTI)" -> electrical.comparative_tracking_index_cti
- "Dielectric Strength" -> electrical.electric_strength
- "Volume Resistivity" -> electrical.volume_resistivity

INPUT_JSON:
${JSON.stringify(inputObj)}
        `.trim()
                    }
                ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "material_spec",
                    strict: true,
                    schema: strictSchema
                }
            },
            temperature: 0
        });

        const res = JSON.parse(response_openai.choices[0]?.message?.content ?? "{}");
        res.source = source;
        return res;

    } catch (error) {
        console.error(`Error processing JSON from URL ${jsonUrl}:`, error);
        throw error;
    }
}

