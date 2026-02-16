const priorityByPath = {
  // applies to ALL children too (value/unit/test_condition/test_method...)
  // need to be reviewed manually
  "general.internal_genics_name": ["supplier", "marketing", "campusplastics", "mdc", "ul", "specialchem"],
  "general.suppliers_trade_name": ["supplier", "marketing", "campusplastics", "mdc", "ul"],
  "general.supplier": ["supplier", "marketing", "campusplastics", "mdc", "ul"],
  "general.alternative_names": ["supplier", "marketing", "campusplastics", "mdc", "ul", "specialchem"],
  "general.chemical_family": ["supplier", "marketing", "campusplastics", "mdc", "specialchem"],

  // need to be reviewed manually
  "general.polymer_type": ["supplier", "marketing", "campusplastics", "mdc", "ul", "specialchem"],
  "general.generic_type": ["supplier", "marketing", "campusplastics", "mdc"],
  "general.filler": ["supplier", "marketing", "campusplastics", "mdc"],
  "general.filler_percent": ["supplier", "marketing","campusplastics", "mdc", "ul"],
  "general.other_additives": ["supplier","marketing", "campusplastics", "mdc"],
  "general.processing": ["supplier", "marketing","campusplastics", "mdc", "specialchem"],
  "general.delivery_form": ["supplier", "marketing","campusplastics", "mdc"],
  "general.regional_availability": ["ul", "marketing","campusplastics"],
  "general.description": ["supplier","marketing", "campusplastics", "mdc", "ul", "specialchem"],
  "general.application_space": ["supplier", "marketing","campusplastics", "mdc", "ul", "specialchem"],

  // need to be reviewed manually
  "general.est_price": ["supplier","marketing", "campusplastics", "mdc", "ul", "specialchem"],

  // need to be reviewed manually
  "general.avrg_carbon_footprint": ["supplier","marketing", "campusplastics", "mdc", "ul", "specialchem"],


  "general.certifications_and_compliance": ["supplier","marketing", "campusplastics", "mdc", "ul", "specialchem"],

  "mechanical.tensile_modulus": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.stress_at_break": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.strain_at_break": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.flexural_modulus": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.flexural_strength": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.flexural_strain_at_flexural_strength": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.charpy_impact_strength_23c": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "mechanical.charpy_impact_strength_minus_30c": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.charpy_notched_impact_strength_23c": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "mechanical.charpy_notched_impact_strength_minus_30c": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "mechanical.izod_impact_strength_23c": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "mechanical.izod_impact_strength_minus_30c": ["supplier", "marketing","campusplastics", "specialchem", "ul"],

  "physical.density": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "physical.humidity_absorption": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "physical.water_absorption": ["supplier","marketing", "campusplastics", "specialchem", "ul"],

  "rheological.melt_volume_flow_rate_mvr": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "rheological.density_melt": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "rheological.specific_heat_capacity_melt": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "rheological.thermal_conductivity_melt": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "rheological.molding_shrinkage_normal": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "rheological.molding_shrinkage_parallel": ["supplier","marketing", "campusplastics", "specialchem", "ul"],

  "processing.drying_temperature_circulating_air_dryer": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.drying_time_circulating_air_dryer_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.drying_time_circulating_air_dryer_max": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.residual_moisture_content_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.residual_moisture_content_max": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.melt_temperature_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.melt_temperature_max": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.mold_temperature_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.mold_temperature_max": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.ejection_temperature": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.permitted_residence_time_prt_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "processing.permitted_residence_time_prt_max": ["supplier","marketing", "campusplastics", "specialchem", "ul"],

  "electrical.relative_permittivity_100hz": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.relative_permittivity_1mhz": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.dissipation_factor_100hz": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.dissipation_factor_1mhz": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.volume_resistivity": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.surface_resistivity": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "electrical.electric_strength": ["supplier", "marketing","campusplastics", "specialchem", "ul"],
  "electrical.comparative_tracking_index_cti": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "electrical.comparative_tracking_index_cti_plc": ["supplier","marketing", "campusplastics", "specialchem", "ul"],

  "thermal.melting_temperature_10c_per_min": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.temp_of_deflection_under_load_1_80_mpa": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.temp_of_deflection_under_load_0_45_mpa": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.coeff_of_linear_therm_expansion_cte_parallel": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.coeff_of_linear_therm_expansion_cte_normal": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.vicat_softening_temperature": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.inherent_flame_resistance": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.flame_retardant_fr_rating": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.flame_rating_ul_94": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.burning_behavior_yellow_card_available": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.burning_rate_thickness_1_mm": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.oxygen_index": ["supplier","marketing", "campusplastics", "specialchem", "ul"],
  "thermal.glow_wire_flammability_index_gwfi": ["supplier","marketing", "campusplastics", "specialchem", "ul"],

  "chemical.hydrolysis_resistant_hr": ["supplier","marketing", "campusplastics"]
};

const DEFAULT_PRIORITY = [
  "supplier",
  "marketing",
  "mdc",
  "ul",
  "campusplastics",
  "specialchem",
];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isMeaningful(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true; // numbers (including 0), booleans, objects, arrays considered meaningful
}

/**
 * Priority lookup with inheritance:
 * - If no exact match for "a.b.c", try "a.b", then "a", else defaultPriority.
 */
function getPriorityForPath(path, priorityByPath, defaultPriority) {
  let p = path;
  while (true) {
    if (priorityByPath && priorityByPath[p]) return priorityByPath[p];
    const idx = p.lastIndexOf(".");
    if (idx === -1) break;
    p = p.slice(0, idx);
  }
  return defaultPriority;
}

/**
 * Checks if a path (or any parent path) has an explicit entry in priorityByPath.
 * This determines whether strict priority mode should be used (no template fallback).
 * 
 * @param {string} path - The dot-separated path to check
 * @param {Object} priorityByPath - The priority configuration object
 * @returns {boolean} - True if path or any parent has an explicit priority entry
 */
function hasExplicitPriority(path, priorityByPath) {
  if (!priorityByPath) return false;
  let p = path;
  while (true) {
    if (priorityByPath[p]) return true;
    const idx = p.lastIndexOf(".");
    if (idx === -1) break;
    p = p.slice(0, idx);
  }
  return false;
}

function deepClone(x) {
  // Works for JSON-safe data
  return x === undefined ? x : JSON.parse(JSON.stringify(x));
}

/**
 * Read a value from an object using dot path, e.g. "mechanical.tensile_modulus.unit"
 */
function getValueAtPath(obj, path) {
  if (!obj) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Merge records by field-level priority.
 *
 * @param {Array<Object>} records - array of same-schema objects; each has top-level "source"
 * @param {Object} priorityByPath - e.g. { "thermal.flame_rating_ul_94": ["ul","supplier",...], "mechanical.tensile_modulus": [...] }
 *                                 Child paths inherit parent priority automatically.
 * @param {Array<string>} defaultPriority - optional override of DEFAULT_PRIORITY
 * @returns {Object} merged output without top-level "source"
 */


function mergeRecordsByFieldPriority(
  records,
  priorityByPath = {},
  defaultPriority = DEFAULT_PRIORITY
) {
  if (!Array.isArray(records) || records.length === 0) return {};

  // Group by source (first record for a source wins; change if you want last-wins)
  const bySource = {};
  for (const r of records) {
    const s = r && r.source;
    if (s && !bySource[s]) bySource[s] = r;
  }

  // Use first record as schema template (you said keys are identical)
  const template = records[0];

  function mergeNode(path, templateNode) {
    // Objects: recurse key by key
    if (isPlainObject(templateNode)) {
      const out = {};
      for (const key of Object.keys(templateNode)) {
        // remove top-level source in output
        if (path === "" && key === "source") continue;

        const childPath = path ? `${path}.${key}` : key;
        out[key] = mergeNode(childPath, templateNode[key]);
      }
      return out;
    }

    // Check if this path has an explicit priority entry (strict mode)
    // STRICT MODE: Path exists in priorityByPath - only prioritized sources can contribute, no template fallback
    // NON-STRICT MODE: Path not in priorityByPath - use existing behavior with template fallback
    const hasStrictPriority = hasExplicitPriority(path, priorityByPath);

    // Arrays: choose first non-empty array by priority
    if (Array.isArray(templateNode)) {
      const order = getPriorityForPath(path, priorityByPath, defaultPriority);
      for (const src of order) {
        const candidate = getValueAtPath(bySource[src], path);
        if (Array.isArray(candidate) && candidate.length > 0) return deepClone(candidate);
      }

      // STRICT MODE: If path has explicit priority, return null (no template fallback)
      // This prevents template array values from leaking into output when prioritized sources have no data
      // NON-STRICT MODE: If no explicit priority, fallback to template (existing behavior)
      if (hasStrictPriority) {
        return null; // Return null when strict priority exists but no meaningful value found
      }
      return deepClone(templateNode);
    }

    // Primitive leaf: choose first meaningful value by priority
    const order = getPriorityForPath(path, priorityByPath, defaultPriority);
    for (const src of order) {
      const candidate = getValueAtPath(bySource[src], path);
      if (isMeaningful(candidate)) return candidate;
    }

    // STRICT MODE: If path has explicit priority entry, return null (no template fallback)
    // This prevents "template leak" - only prioritized sources can contribute
    if (hasStrictPriority) {
      return null;
    }

    // NON-STRICT MODE: If no explicit priority entry, use existing behavior (fallback to template)
    // This maintains backward compatibility for paths not in priorityByPath
    return templateNode ?? null;
  }

  return mergeNode("", template);
}

// module.exports = {
//   mergeRecordsByFieldPriority,
//   DEFAULT_PRIORITY,
// };

export { mergeRecordsByFieldPriority, priorityByPath, DEFAULT_PRIORITY };





