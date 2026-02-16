import { pdf_url_to_json } from "./text_to_json.js";


// function schemaFromTemplate(template) {
//   if (template === null) {
//     // Allow null or extracted primitive in leafs
//     return { type: ["null", "string", "number", "boolean"] };
//   }

//   if (Array.isArray(template)) {
//     return { type: "array", items: template[0] ? schemaFromTemplate(template[0]) : {} };
//   }

//   if (typeof template === "object") {
//     const properties = {};
//     const required = Object.keys(template);

//     for (const k of required) properties[k] = schemaFromTemplate(template[k]);

//     return {
//       type: "object",
//       properties,
//       required,
//       additionalProperties: false
//     };
//   }

//   return { type: typeof template };
// }


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

async function performOCR(pdfUrl) {
  try {
    const base = process.env.DEEPSEEK_OCR_2_SERVER_BASE_URL;

    const response = await fetch(`${base}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: pdfUrl }),
    });

    // If server returned an error, read the body for debugging
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OCR server error ${response.status}: ${errText}`);
    }

    // Parse JSON 
    const res = await response.json();

    const extracted_text = res?.data;

    if (!extracted_text) {
      throw new Error(`No extracted text in response: ${JSON.stringify(res)}`);
    }

    return extracted_text;
  } catch (error) {
    console.error(`Error processing PDF from URL ${pdfUrl} in DEEPSEEK-OCR-2 BLOCK:`, error);
    throw error;
  }
}

async function makeJSONfromExtractedTextUsingLLM(extractedText, pdfUrl) {
  //  const strictSchema = schemaFromTemplate(outputSchema);
  const LOCALLY_HOSTED_LLM_BASE_URL = process.env.LOCALLY_HOSTED_LLM_BASE_URL;
  try {

//     const prompt = `
// You are a strict information-extraction engine.

// GOAL
// Convert CHUNK_TEXT (extracted from pdf) into ONE JSON object that matches TEMPLATE exactly (same keys, same nesting).
// Every key present in TEMPLATE MUST appear in the output.
// If a value,unit,test_method or test_condition is not explicitly present in CHUNK_TEXT, set it to null (do NOT guess).

// OUTPUT REQUIREMENTS
// - Output MUST be valid JSON only. No markdown, no explanations, no extra text.
// - Output MUST match TEMPLATE’s structure exactly:
//   - Use EXACT key names from TEMPLATE.
//   - Use the SAME nesting.
//   - Do NOT add any new keys.
//   - Do NOT remove any keys.
// - Do NOT repeat sections. Output the JSON object exactly once.

// EXTRACTION RULES (NO GUESSING)
// - Use ONLY information explicitly present in CHUNK_TEXT. Do NOT infer, assume, or “imply”.
// - Do NOT use placeholder strings like "NA", "N/A", "-", "not specified", section headings (e.g., "Applications", "Sustainability", "Processing") as values.
// - If CHUNK_TEXT contains such placeholders instead of a real value, output null.
// - IMPORTANT: Ignore website/navigation/menu/footer text. Do NOT treat these as material data.
// - Examples include (but not limited to): "Applications", "Compounds", "Sustainability", "Career", "News", "About us", "Documents", "Processing", "Diagrams", language selectors like "EN", and site/footer/company listings.
// - If such words appear near a field, do NOT copy them into any value. Keep the related field null unless an actual property value is explicitly stated.
// - IMPORTANT : make sure the value , unit , test_condition and test_method being filled , make sense according to property name
// -attempt extraction for EVERY schema property
// -If not found by scan, do targeted lookup with label + key tokens + synonyms before leaving null.
// -for only flexural_modulus , flexural_strength and flexural_strain_at_flexural_strength , try to get test_condition in format "23°C, 2 mm/min"
// -IMPORTANT : for fields like certifications_and_compliance , add only valid certfications and compliances name found but drop any thing like 
// "passed" , "+" etc that feels like a filler
// -IMPORTANT : evaluate hydrolysis_resistance and set value as "Yes" or "No" in hydrolysis_resistant_hr 
// -IMPORTANT : regional_availability must have a valid region . for example : "Asia","europe" etc if present in pdf otherwise keep it null. do not use values like "commercial" , "product status" or any other filler values for regional_availability even if you find it in chunked text

 
// VALUE OBJECT RULES
// For fields shaped like:
// { "value": ..., "unit": ..., "test_condition": ..., "test_method": ... }

// - value: numeric part if possible (number or numeric string)
// - unit: only if explicitly present 
// - test_method: standards if explicitly present
// - test_condition: conditions if explicitly present
// - If a subfield is not explicitly stated, set that subfield to null (do not omit it).

// FORMATTING CONSTRAINTS
// - Do NOT put brackets/braces/parentheses inside any "value" field.
//   Example: NOT "18 kV/mm (3 mm)".
//   Instead: value=18, unit="kV/mm", test_condition="3 mm" (only if explicitly present).
// - Keep text values as plain strings exactly as they appear in provided extracted text.


// INPUTS

// TEMPLATE:
// <<<TEMPLATE_JSON
// ${JSON.stringify(outputSchema, null, 2)}
// TEMPLATE_JSON

// OUTPUT
// Return ONLY the final JSON object matching TEMPLATE.
//  `.trim()

const strictSchema = schemaFromTemplate(outputSchema);
const templateJson = JSON.stringify(strictSchema, null, 2);

const prompt = `
You are a strict information-extraction engine.

GOAL
Extract material properties from the provided extracted text attached into ONE JSON object that matches the provided JSON schema exactly.
Every key must be present. If a value is not explicitly present in the PDF, set it to null (do NOT guess).

HARD RULES
- Output MUST be valid JSON only. No markdown, no explanations, no extra text.
- Do NOT add any keys. Do NOT remove any keys.
- Use ONLY information explicitly present in the PDF. Do NOT infer.

VALUE OBJECT RULES
For objects like {"value":..., "unit":..., "test_condition":..., "test_method":...}:
- Split combined values like "6600 MPa" into value=6600 and unit="MPa" when possible.
- Put standards like "ISO 178" into test_method when present.
- Put conditions like "23°C" into test_condition when present.
- for only flexural_modulus , flexural_strength and flexural_strain_at_flexural_strength , try to get test_condition in format "23°C, 2 mm/min"
- IMPORTANT : make sure the value , unit , test_condition and test_method being filled , make sense according to property name
-attempt extraction for EVERY schema property
-If not found by scan, do targeted lookup with label + key tokens + synonyms before leaving null for that property
-IMPORTANT : for fields like certifications_and_compliance , add only valid certfications and compliances name found but drop any thing like passed , + etc that feels like a filler
-IMPORTANT : evaluate hydrolysis_resistance and set value as "Yes" or "No" in hydrolysis_resistant_hr
-IMPORTANT :regional_availability must have a valid region . for example : "Asia","europe" etc if present in pdf otherwise keep it null. do not use values like "commercial" , "product status" or any other filler values 

json templete : 
${templateJson}

`

    const response = await fetch(`${LOCALLY_HOSTED_LLM_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": "deepseek-r1:7b",
        "format": strictSchema,
        "messages": [
          {
            "role": "system",
            "content": prompt
          },
          {
            "role": "user",
            "content": `Extract the required fields from the attached extracted text and return ONLY the JSON. extracted text : ${extractedText}`
          }
        ],
        "stream": false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`error while making json from extracted data in local llm call ${response.status}: ${errText}`);
    }

    const res = await response.json();

    const content = res?.message?.content;

    return content;

  } catch (error) {
    console.error(`Error processing PDF from URL ${pdfUrl} in DEEPSEEK-OCR-2 BLOCK:`, error);
    throw error;
  }
}


export async function processPdfFromUrl(pdfUrl, source) {

  // 1 get ocr text from deepseek-ocr-2 
  const extractedText = await performOCR(pdfUrl);

  // 2 send text to ollama hosted local llm 
  const formedJson = await makeJSONfromExtractedTextUsingLLM(extractedText, pdfUrl);

  return formedJson;

}



