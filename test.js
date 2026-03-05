// import { finalSchemaTransformation } from "./utils/finalSchema.js";
// import { processJsonFromUrl } from "./utils/processJsonFromUrl.js";
// import { processPdfFromUrl } from "./utils/processPdfFromUrl.js";
// import { sanitizeGenericAndClassifyPolymer, sanitizeUnifiedJson } from "./utils/sanitizeJson.js";
// import { canonicalizeUnitsByFieldPath } from "./utils/unitNormalization.js";

// const jsonData = await processPdfFromUrl("http://localhost:3000/data/AKROLEN PP-GFM 25-15/AKROLEN PP GFM 25 -15 - Marketing.pdf", "marketing");


// console.log(jsonData);

// // let jsonData = {
// //     source: 'marketing',
// //     general: {
// //         name: { value: 'AKROLEN® PP GFM 25/15 black (1415)' },
// //         internal_genics_name: { value: null },
// //         suppliers_trade_name: { value: 'AKROLEN®' },
// //         supplier: { value: null },
// //         alternative_names: { value: 'PP GFM 25/15 black (1415)' },
// //         chemical_family: { value: 'Polypropylene' },
// //         polymer_type: { value: 'PP' },
// //         generic_type: { value: null },
// //         filler: { value: 'Glass fibre' },
// //         filler_percent: { value: 25, unit: '%' },
// //         other_additives: { value: 'Mineral filler' },
// //         processing: { value: null },
// //         delivery_form: { value: null },
// //         regional_availability: { value: null },
// //         description: {
// //             value: '25% glass fibre reinforced, 15% mineral-filled polypropylene with good surface and dimensional stability.'
// //         },
// //         application_space: { value: null },
// //         est_price: { value: null, unit: null },
// //         avrg_carbon_footprint: { value: null, unit: null },
// //         certifications_and_compliance: {
// //             value: 'ISO 178, ISO 527-2, ISO 179-1, ISO 2039-1, ISO 11357-3, ISO 11359-1/2, ISO 75, ISO 1133, ISO 1183, ISO 294-4, IEC 62631-3-1, IEC 60112, UL 94'
// //         }
// //     },
// //     mechanical: {
// //         tensile_modulus: {
// //             value: 6500,
// //             unit: 'MPa',
// //             test_condition: '1 mm/min',
// //             test_method: 'ISO 527-2'
// //         },
// //         stress_at_break: {
// //             value: 75,
// //             unit: 'MPa',
// //             test_condition: '50 mm/min',
// //             test_method: 'ISO 527-2'
// //         },
// //         strain_at_break: {
// //             value: 3.5,
// //             unit: '%',
// //             test_condition: '50 mm/min',
// //             test_method: 'ISO 527-2'
// //         },
// //         flexural_modulus: {
// //             value: 6600,
// //             unit: 'MPa',
// //             test_condition: '2 mm/min',
// //             test_method: 'ISO 178'
// //         },
// //         flexural_strength: {
// //             value: 105,
// //             unit: 'MPa',
// //             test_condition: '2 mm/min',
// //             test_method: 'ISO 178'
// //         },
// //         flexural_strain_at_flexural_strength: {
// //             value: 3.5,
// //             unit: '%',
// //             test_condition: '2 mm/min',
// //             test_method: 'ISO 178'
// //         },
// //         charpy_impact_strength_23c: {
// //             value: 45,
// //             unit: 'kJ/m²',
// //             test_condition: '23°C',
// //             test_method: 'ISO 179-1/1eU'
// //         },
// //         charpy_impact_strength_minus_30c: {
// //             value: 45,
// //             unit: 'kJ/m²',
// //             test_condition: '-30°C',
// //             test_method: null
// //         },
// //         charpy_notched_impact_strength_23c: {
// //             value: 10,
// //             unit: 'kJ/m²',
// //             test_condition: '23°C',
// //             test_method: null
// //         },
// //         charpy_notched_impact_strength_minus_30c: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         izod_impact_strength_23c: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         izod_impact_strength_minus_30c: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         }
// //     },
// //     physical: {
// //         density: { value: 1.21, unit: 'g/cm³', test_method: 'ISO 1183' },
// //         humidity_absorption: { value: null, unit: null, test_method: null },
// //         water_absorption: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         }
// //     },
// //     rheological: {
// //         melt_volume_flow_rate_mvr: {
// //             value: 13.5,
// //             unit: 'cm³/10 min',
// //             test_condition: '230°C, 2.16 kg',
// //             test_method: 'ISO 1133'
// //         },
// //         density_melt: { value: null, unit: null },
// //         specific_heat_capacity_melt: { value: null, unit: null },
// //         thermal_conductivity_melt: { value: null, unit: null },
// //         molding_shrinkage_normal: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         molding_shrinkage_parallel: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         }
// //     },
// //     processing: {
// //         drying_temperature_circulating_air_dryer: { value: null, unit: null },
// //         drying_time_circulating_air_dryer_min: { value: null, unit: null },
// //         drying_time_circulating_air_dryer_max: { value: null, unit: null },
// //         residual_moisture_content_min: { value: null, unit: null, test_method: null },
// //         residual_moisture_content_max: { value: null, unit: null, test_method: null },
// //         melt_temperature_min: { value: null, unit: null },
// //         melt_temperature_max: { value: null, unit: null },
// //         mold_temperature_min: { value: null, unit: null },
// //         mold_temperature_max: { value: null, unit: null },
// //         ejection_temperature: { value: null, unit: null },
// //         permitted_residence_time_prt_min: { value: null, unit: null },
// //         permitted_residence_time_prt_max: { value: null, unit: null }
// //     },
// //     electrical: {
// //         relative_permittivity_100hz: { value: null, test_condition: null, test_method: null },
// //         relative_permittivity_1mhz: { value: null, test_condition: null, test_method: null },
// //         dissipation_factor_100hz: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         dissipation_factor_1mhz: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         volume_resistivity: {
// //             value: '>2*10^11',
// //             unit: 'Ω·cm',
// //             test_condition: 'd.a.m.',
// //             test_method: 'IEC 62631-3-1'
// //         },
// //         surface_resistivity: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         electric_strength: {
// //             value: null,
// //             unit: null,
// //             test_method: null,
// //             test_condition: null
// //         },
// //         comparative_tracking_index_cti: { value: 600, unit: 'V', test_method: 'IEC 60112' },
// //         comparative_tracking_index_cti_plc: { value: null, unit: null, test_method: null }
// //     },
// //     thermal: {
// //         melting_temperature_10c_per_min: {
// //             value: 167,
// //             unit: '°C',
// //             test_condition: 'DSC, 10K/min',
// //             test_method: 'ISO 11357-3'
// //         },
// //         temp_of_deflection_under_load_1_80_mpa: { value: 150, unit: '°C', test_method: 'ISO 75' },
// //         temp_of_deflection_under_load_0_45_mpa: { value: 163, unit: '°C', test_method: 'ISO 75' },
// //         coeff_of_linear_therm_expansion_cte_parallel: {
// //             value: 0.2,
// //             unit: '10⁻⁴/K',
// //             test_condition: '23°C to 80°C | parallel',
// //             test_method: 'ISO 11359-1/2'
// //         },
// //         coeff_of_linear_therm_expansion_cte_normal: {
// //             value: 1.25,
// //             unit: '10⁻⁴/K',
// //             test_condition: '23°C to 80°C | transverse',
// //             test_method: 'ISO 11359-1/2'
// //         },
// //         vicat_softening_temperature: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         inherent_flame_resistance: { value: null, unit: null },
// //         flame_retardant_fr_rating: { value: null },
// //         flame_rating_ul_94: {
// //             value: 'HB',
// //             unit: 'Class',
// //             test_condition: null,
// //             test_method: 'UL 94'
// //         },
// //         burning_behavior_yellow_card_available: { value: null },
// //         burning_rate_thickness_1_mm: { value: null, unit: null, test_method: null },
// //         oxygen_index: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         },
// //         glow_wire_flammability_index_gwfi: {
// //             value: null,
// //             unit: null,
// //             test_condition: null,
// //             test_method: null
// //         }
// //     },
// //     chemical: { hydrolysis_resistant_hr: { value: null } }
// // }

// let sanitizedSingle = sanitizeUnifiedJson(jsonData);
// sanitizedSingle = canonicalizeUnitsByFieldPath(sanitizedSingle, { strict: false });
// sanitizedSingle = sanitizeGenericAndClassifyPolymer(sanitizedSingle);
// // setFolderName(sanitizedSingle, folderName);
// if (jsonData && typeof jsonData === "object" && jsonData.source) {
//     sanitizedSingle = { ...sanitizedSingle, source: jsonData.source };
// }
// // console.log(`--------Sanitised output-----------`);
// // console.log(sanitizedSingle);


// const res = await finalSchemaTransformation(jsonData);

// console.log(`---------`);
// console.log(res);


// // const SPECIALCHEM_KEYWORD = "specialchem";
// // const res = await processJsonFromUrl("http://localhost:3000/data/AKROLEN PP-GFM 25-15/AKROLEN PP-GFM 25-15 - Specialchem.json","specialchem");
// // console.log(res);

import os from "os";

console.log(os.cpus().length);

