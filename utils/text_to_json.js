import OpenAI, { toFile } from "openai";
import "dotenv/config";


function schemaFromTemplate(template) {
  if (template === null) {
    // Allow null or extracted primitive in leafs
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


const OPENAI_API_KEY = "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"

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function text_to_json(text, source) {

  // const prompt = `you are a strict information-extraction engine.
  // Given:
  // 1) TEMPLATE (a JSON structure that defines allowed keys and nesting)
  // 2) CHUNK_TEXT (raw text parsed from a PDF)

  // Return a JSON PATCH containing ONLY the fields from TEMPLATE that you can fill using information explicitly present in CHUNK_TEXT.

  // HARD RULES
  // - Use ONLY information explicitly present in CHUNK_TEXT. Do NOT guess or infer.
  // - Use EXACT key names and EXACT nesting as in TEMPLATE.
  // - Output MUST be same valid JSON only (no markdown, no explanations, no extra keys).
  // - If any subfield is not stated, keep it as null.
  // - add null where the value of key is not defined otherwise add the value of key
  // - do not skip the key

  // VALUE OBJECT RULES
  // Many fields in TEMPLATE have objects like:
  // { "value": ..., "unit": ..., "test_condition": ..., "test_method": ... }

  // For these:
  // - Put the numeric part in value when possible (number or numeric string).
  // - Put the unit (e.g., "MPa", "GPa", "g/cm³", "%", "°C") in unit when present.
  // - Put standards like "ISO 527", "ASTM D638" in test_method when present.
  // - Put conditions like "23°C", "dry", "50% RH", "1.80 MPa" in test_condition when present.
  // - If any subfield is not stated, keep it as null.
  // - If the text gives a combined value+unit like "2.1 g/cm³", split into value=2.1 and unit="g/cm³".
  // - If the value is a range and TEMPLATE has separate *_min / *_max fields, populate those when explicitly available (otherwise keep the range as a string in value, e.g., "3–5").


  // PATCH SHAPE RULES
  // - Keep strings exactly as in CHUNK_TEXT for names, grades, trade names, compliance statements, etc.

  // INPUTS:

  // TEMPLATE JSON:
  // ${outputSchema}

  // CHUNK_TEXT:
  // ${text}

  // OUTPUT
  // Return ONLY the JSON patch`.trim();

  // const response = await client.chat.completions.create({
  //     model: "gpt-5.1",
  //     messages: [
  //     // { role: "system", content: "Return only valid JSON. No markdown" },
  //     { role: "user", content: prompt }
  //     ],
  //     response_format: { type: "json_object" },
  //     temperature: 0
  //     });

  //     const jsonText = response.choices[0]?.message?.content ?? "{}";
  //     console.log(`----------------jsonText------------------- : `,jsonText);

  //     // return JSON.parse(jsonText);  
  const strictSchema = schemaFromTemplate(outputSchema);

  const response = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `
You are a strict information-extraction engine.

GOAL
Convert CHUNK_TEXT (parsed from a json) into ONE JSON object that matches TEMPLATE exactly (same keys, same nesting).
Every key present in TEMPLATE MUST appear in the output.
If a value is not explicitly present in CHUNK_TEXT, set it to null (do NOT guess).

OUTPUT REQUIREMENTS
- Output MUST be valid JSON only. No markdown, no explanations, no extra text.
- Output MUST match TEMPLATE’s structure exactly:
  - Use EXACT key names from TEMPLATE.
  - Use the SAME nesting.
  - Do NOT add any new keys.
  - Do NOT remove any keys.
- Do NOT repeat sections. Output the JSON object exactly once.

EXTRACTION RULES (NO GUESSING)
- Use ONLY information explicitly present in CHUNK_TEXT. Do NOT infer, assume, or “imply”.
- Do NOT use placeholder strings like "NA", "N/A", "-", "not specified", section headings (e.g., "Applications", "Sustainability", "Processing") as values.
- If CHUNK_TEXT contains such placeholders instead of a real value, output null.
- IMPORTANT: Ignore website/navigation/menu/footer text. Do NOT treat these as material data.
- Examples include (but not limited to): "Applications", "Compounds", "Sustainability", "Career", "News", "About us", "Documents", "Processing", "Diagrams", language selectors like "EN", and site/footer/company listings.
- If such words appear near a field, do NOT copy them into any value. Keep the related field null unless an actual property value is explicitly stated.
- IMPORTANT : make sure the value , unit , test_condition and test_method being filled , make sense according to property name
-attempt extraction for EVERY schema property
-If not found by scan, do targeted lookup with label + key tokens + synonyms before leaving null.
-for only flexural_modulus , flexural_strength and flexural_strain_at_flexural_strength , try to get test_condition in format "23°C, 2 mm/min"
-IMPORTANT : for fields like certifications_and_compliance , add only valid certfications and compliances name found but drop any thing like 
"passed" , "+" etc that feels like a filler
-IMPORTANT : evaluate hydrolysis_resistance and set value as "Yes" or "No" in hydrolysis_resistant_hr 
-IMPORTANT : regional_availability must have a valid region . for example : "Asia","europe" etc if present in pdf otherwise keep it null. do not use values like "commercial" , "product status" or any other filler values for regional_availability even if you find it in chunked text

 
VALUE OBJECT RULES
For fields shaped like:
{ "value": ..., "unit": ..., "test_condition": ..., "test_method": ... }

- value: numeric part if possible (number or numeric string)
- unit: only if explicitly present 
- test_method: standards if explicitly present
- test_condition: conditions if explicitly present
- If a subfield is not explicitly stated, set that subfield to null (do not omit it).

FORMATTING CONSTRAINTS
- Do NOT put brackets/braces/parentheses inside any "value" field.
  Example: NOT "18 kV/mm (3 mm)".
  Instead: value=18, unit="kV/mm", test_condition="3 mm" (only if explicitly present).
- Keep text values as plain strings exactly as they appear in CHUNK_TEXT.


INPUTS

TEMPLATE:
<<<TEMPLATE_JSON
${JSON.stringify(strictSchema, null, 2)}
TEMPLATE_JSON

CHUNK_TEXT:
<<<CHUNK_TEXT
${text}
CHUNK_TEXT

OUTPUT
Return ONLY the final JSON object matching TEMPLATE.
 `.trim()
      },
      // { role: "user", content: `CHUNK_TEXT:\n${text}` }
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

  //  console.log(`-----output response gpt :`,response);

  const res = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  res.source = source;
  return res;
}



// ... existing code (schemaFromTemplate, outputSchema, client, text_to_json, etc) ...

export async function pdf_url_to_json(pdfUrl, source) {
  const strictSchema = schemaFromTemplate(outputSchema);

  // 1) Download PDF bytes (OpenAI can't fetch the URL directly)
  const resp = await fetch(pdfUrl);
  if (!resp.ok) {
    throw new Error(`Failed to download PDF from ${pdfUrl}: ${resp.status} ${resp.statusText}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  // 2) Upload PDF to OpenAI, then reference it by file_id
  const uploaded = await client.files.create({
    file: await toFile(pdfBuffer, "document.pdf", { type: "application/pdf" }),
    purpose: "assistants",
  });

  // 3) Ask model to extract directly from the PDF into the SAME schema as before
  const response = await client.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `
You are a strict information-extraction engine.

GOAL
Extract material properties from the provided PDF into ONE JSON object that matches the provided JSON schema exactly.
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
        `.trim(),
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the required fields from the attached PDF and return ONLY the JSON." },
          { type: "file", file: { file_id: uploaded.id } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "material_spec",
        strict: true,
        schema: strictSchema,
      },
    },
    temperature: 0,
  });

  // console.log(`-----output response gpt :`,response);

  const res = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  res.source = source;
  return res;
}
