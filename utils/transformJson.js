// utils/json_to_output_schema.js
import fs from "node:fs/promises";
import OpenAI from "openai";
import "dotenv/config";

/** Reuse from your existing code */
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

/** Your output template (paste your full outputSchema here) */
// export const outputSchema = {
//   source: null,
//   general: {
//     internal_name: { value: null },
//     suppliers_trade_name: { value: null },
//     supplier: { value: null },
//     alternative_names: { value: null },
//     chemical_family: { value: null },
//     polymer_type: { value: null },
//     generic_type: { value: null },
//     filler: { value: null },
//     filler_percent: { value: null, unit: null },
//     other_additives: { value: null },
//     processing: { value: null },
//     delivery_form: { value: null },
//     regional_availability: { value: null },
//     description: { value: null },
//     application_space: { value: null },
//     est_price: { value: null, unit: null },
//     avrg_carbon_footprint: { value: null, unit: null },
//     certifications_and_compliance: { value: null }
//   },

//   mechanical: {
//     tensile_modulus: { value: null, unit: null, test_condition: null, test_method: null },
//     stress_at_break: { value: null, unit: null, test_condition: null, test_method: null },
//     strain_at_break: { value: null, unit: null, test_condition: null, test_method: null },
//     flexural_modulus: { value: null, unit: null, test_condition: null, test_method: null },
//     flexural_strength: { value: null, unit: null, test_condition: null, test_method: null },
//     flexural_strain_at_flexural_strength: { value: null },
//     charpy_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
//     charpy_impact_strength_minus_30c: { value: null },
//     charpy_notched_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
//     charpy_notched_impact_strength_minus_30c: { value: null, unit: null, test_condition: null, test_method: null },
//     izod_impact_strength_23c: { value: null, unit: null, test_condition: null, test_method: null },
//     izod_impact_strength_minus_30c: { value: null }
//   },

//   physical: {
//     density: { value: null, unit: null, test_method: null },
//     humidity_absorption: { value: null },
//     water_absorption: { value: null, unit: null, test_condition: null, test_method: null }
//   },

//   rheological: {
//     melt_volume_flow_rate_mvr: { value: null, unit: null, test_condition: null, test_method: null },
//     density_melt: { value: null, unit: null, test_method: null },
//     specific_heat_capacity_melt: { value: null, unit: null, test_method: null },
//     thermal_conductivity_melt: { value: null, unit: null, test_method: null },
//     molding_shrinkage_normal: { value: null, unit: null, test_condition: null, test_method: null },
//     molding_shrinkage_parallel: { value: null, unit: null, test_condition: null, test_method: null }
//   },

//   processing: {
//     drying_temperature_circulating_air_dryer: { value: null, unit: null },
//     drying_time_circulating_air_dryer_min: { value: null, unit: null },
//     drying_time_circulating_air_dryer_max: { value: null, unit: null },
//     residual_moisture_content_min: { value: null },
//     residual_moisture_content_max: { value: null, unit: null, test_condition: null },
//     melt_temperature_min: { value: null, unit: null },
//     melt_temperature_max: { value: null, unit: null },
//     mold_temperature_min: { value: null, unit: null },
//     mold_temperature_max: { value: null, unit: null },
//     ejection_temperature: { value: null, unit: null },
//     permitted_residence_time_prt_min: { value: null },
//     permitted_residence_time_prt_max: { value: null }
//   },

//   electrical: {
//     relative_permittivity_100hz: { value: null },
//     relative_permittivity_1mhz: { value: null },
//     dissipation_factor_100hz: { value: null },
//     dissipation_factor_1mhz: { value: null },
//     volume_resistivity: { value: null, unit: null, test_method: null },
//     surface_resistivity: { value: null, unit: null, test_method: null },
//     electric_strength: { value: null, unit: null, test_method: null, test_condition: null },
//     comparative_tracking_index_cti: { value: null, unit: null, test_method: null },
//     comparative_tracking_index_cti_plc: { value: null, test_method: null }
//   },

//   thermal: {
//     melting_temperature_10c_per_min: { value: null, unit: null, test_method: null },
//     temp_of_deflection_under_load_1_80_mpa: { value: null, unit: null, test_condition: null, test_method: null },
//     temp_of_deflection_under_load_0_45_mpa: { value: null },
//     coeff_of_linear_therm_expansion_cte_parallel: { value: null, unit: null, test_condition: null, test_method: null },
//     coeff_of_linear_therm_expansion_cte_normal: { value: null, unit: null, test_condition: null, test_method: null },
//     vicat_softening_temperature: { value: null, unit: null, test_condition: null, test_method: null },
//     inherent_flame_resistance: { value: null },
//     flame_retardant_fr_rating: { value: null },
//     flame_rating_ul_94: { value: null, test_method: null },
//     burning_behavior_yellow_card_available: { value: null },
//     burning_rate_thickness_1_mm: { value: null },
//     oxygen_index: { value: null, unit: null, test_method: null },
//     glow_wire_flammability_index_gwfi: { value: null, unit: null, test_condition: null, test_method: null }
//   },

//   chemical: {
//     hydrolysis_resistant_hr: { value: null }
//   }
// };

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
    density_melt: { value: null, unit: null},
    specific_heat_capacity_melt: { value: null, unit: null},
    thermal_conductivity_melt: { value: null, unit: null},
    molding_shrinkage_normal: { value: null, unit: null, test_condition: null, test_method: null },
    molding_shrinkage_parallel: { value: null, unit: null, test_condition: null, test_method: null }
  },
 
  processing: {
    drying_temperature_circulating_air_dryer: { value: null, unit: null },
    drying_time_circulating_air_dryer_min: { value: null, unit: null },
    drying_time_circulating_air_dryer_max: { value: null, unit: null },
    residual_moisture_content_min: { value: null, unit: null, test_method: null },
    residual_moisture_content_max: { value: null, unit: null, test_method: null},
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
    inherent_flame_resistance: { value: null , unit : null },
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

/**
 * Reads an input JSON file (your template JSON like "Product Name", "Other Properties", etc)
 * and returns an object that matches outputSchema exactly.
 */
export async function transformJson(jsonFilePath, source = "specialchem") {
  const raw = await fs.readFile(jsonFilePath, "utf8");
  const inputObj = JSON.parse(raw);

  const strictSchema = schemaFromTemplate(outputSchema);

  const response = await client.chat.completions.create({
    // Keep your model; if you ever get "Unsupported model" for json_schema,
    // switch to a model that supports Structured Outputs.
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

+- "Description" -> general.description.value
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

  const out = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  out.source = source;

//   console.log(`--------file transformed successfully -----------------`, out );

  return out;
}
