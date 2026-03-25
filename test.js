import { logDroppedMeasurementFields } from "./script.js";
import { sanitizeUnifiedJson } from "./utils/sanitizeJson.js";
import fs from "node:fs"
import path from "path"

const schema = {
    "source": "Celanese Materials Database",
    "general": {
        "name": {
            "value": "CELANEX® 3216"
        },
        "internal_genics_name": {
            "value": null
        },
        "suppliers_trade_name": {
            "value": null
        },
        "supplier": {
            "value": null
        },
        "alternative_names": {
            "value": null
        },
        "chemical_family": {
            "value": "polybutylene terephthalate"
        },
        "polymer_type": {
            "value": "PBT"
        },
        "generic_type": {
            "value": null
        },
        "filler": {
            "value": "fiberglass"
        },
        "filler_percent": {
            "value": 15,
            "unit": "%"
        },
        "other_additives": {
            "value": "Flame retardant"
        },
        "processing": {
            "value": "Injection Molding"
        },
        "delivery_form": {
            "value": null
        },
        "regional_availability": {
            "value": null
        },
        "description": {
            "value": "Celanex 3216 is a non-exuding (UL and CSA approved V-0 at 1/32 inch and 5V at 1/8 inch), 15% fiberglass reinforced polybutylene terephthalate which has an excellent balance of mechanical properties and processability. It is well suited for electrical connector applications where its UL approved 50% regrind use capability allows maximum use of purchased product."
        },
        "application_space": {
            "value": "Electrical connector applications"
        },
        "est_price": {
            "value": null,
            "unit": null
        },
        "avrg_carbon_footprint": {
            "value": null,
            "unit": null
        },
        "certifications_and_compliance": {
            "value": "UL, CSA"
        }
    },
    "mechanical": {
        "tensile_modulus": {
            "value": 972000,
            "unit": "psi",
            "test_condition": null,
            "test_method": "ISO 527-1/-2"
        },
        "stress_at_break": {
            "value": 14500,
            "unit": "psi",
            "test_condition": "5mm/min",
            "test_method": "ISO 527-1/-2"
        },
        "strain_at_break": {
            "value": 3,
            "unit": "%",
            "test_condition": null,
            "test_method": "ISO 527-1/-2"
        },
        "flexural_modulus": {
            "value": 870000,
            "unit": "psi",
            "test_condition": "tested at 23°C at the weight 788 lb",
            "test_method": "ISO 178"
        },
        "flexural_strength": {
            "value": 22500,
            "unit": "psi",
            "test_condition": null,
            "test_method": "ISO 178"
        },
        "flexural_strain_at_flexural_strength": {
            "value": null,
            "unit": null,
            "test_condition": null,
            "test_method": null
        },
        "charpy_impact_strength_23c": {
            "value": 13.3,
            "unit": "ftlb/in²",
            "test_condition": null,
            "test_method": "ISO 179/1eU"
        },
        "charpy_impact_strength_minus_30c": {
            "value": 13.3,
            "unit": "ftlb/in²",
            "test_condition": null,
            "test_method": "ISO 179/1eU"
        },
        "charpy_notched_impact_strength_23c": {
            "value": 2.85,
            "unit": "ftlb/in²",
            "test_condition": null,
            "test_method": "ISO 179/1eA"
        },
        "charpy_notched_impact_strength_minus_30c": {
            "value": 2.85,
            "unit": "ftlb/in²",
            "test_condition": null,
            "test_method": "ISO 179/1eA"
        },
        "izod_impact_strength_23c": {
            "value": 2.62,
            "unit": "ftlb/in²",
            "test_condition": null,
            "test_method": "ISO 180/1A"
        },
        "izod_impact_strength_minus_30c": {
            "value": null,
            "unit": null,
            "test_condition": null,
            "test_method": null
        }
    },
    "physical": {
        "density": {
            "value": 0.0556,
            "unit": "lb/in³",
            "test_method": "ISO 1183"
        },
        "humidity_absorption": {
            "value": 0.17,
            "unit": "%",
            "test_method": "Sim. to ISO 62"
        },
        "water_absorption": {
            "value": 0.4,
            "unit": "%",
            "test_condition": "2mm",
            "test_method": "Sim. to ISO 62"
        }
    },
    "rheological": {
        "melt_volume_flow_rate_mvr": {
            "value": 9,
            "unit": "cm³/10min",
            "test_condition": "482°F, 4.76 lb",
            "test_method": "ISO 1133"
        },
        "density_melt": {
            "value": null,
            "unit": null
        },
        "specific_heat_capacity_melt": {
            "value": null,
            "unit": null
        },
        "thermal_conductivity_melt": {
            "value": null,
            "unit": null
        },
        "molding_shrinkage_normal": {
            "value": null,
            "unit": "%",
            "test_condition": "0.9-1.2%",
            "test_method": "ISO 294-4, 2577"
        },
        "molding_shrinkage_parallel": {
            "value": null,
            "unit": "%",
            "test_condition": "0.5-0.7%",
            "test_method": "ISO 294-4, 2577"
        }
    },
    "processing": {
        "drying_temperature_circulating_air_dryer": {
            "value": 248,
            "unit": "°F"
        },
        "drying_time_circulating_air_dryer_min": {
            "value": 4,
            "unit": "h"
        },
        "drying_time_circulating_air_dryer_max": {
            "value": null,
            "unit": null
        },
        "residual_moisture_content_min": {
            "value": "<=0.02",
            "unit": "%",
            "test_method": null
        },
        "residual_moisture_content_max": {
            "value": null,
            "unit": null,
            "test_method": null
        },
        "melt_temperature_min": {
            "value": 464,
            "unit": "°F"
        },
        "melt_temperature_max": {
            "value": 500,
            "unit": "°F"
        },
        "mold_temperature_min": {
            "value": 140,
            "unit": "°F"
        },
        "mold_temperature_max": {
            "value": 266,
            "unit": "°F"
        },
        "ejection_temperature": {
            "value": null,
            "unit": null
        },
        "permitted_residence_time_prt_min": {
            "value": null,
            "unit": null
        },
        "permitted_residence_time_prt_max": {
            "value": null,
            "unit": null
        }
    },
    "electrical": {
        "relative_permittivity_100hz": {
            "value": 3.7,
            "test_condition": null,
            "test_method": "IEC 62631-2-1"
        },
        "relative_permittivity_1mhz": {
            "value": 3.5,
            "test_condition": null,
            "test_method": "IEC 62631-2-1"
        },
        "dissipation_factor_100hz": {
            "value": 33,
            "unit": "E-4",
            "test_condition": null,
            "test_method": "IEC 62631-2-1"
        },
        "dissipation_factor_1mhz": {
            "value": 160,
            "unit": "E-4",
            "test_condition": null,
            "test_method": "IEC 62631-2-1"
        },
        "volume_resistivity": {
            "value": 10000000000000,
            "unit": "Ohm.m",
            "test_condition": null,
            "test_method": "IEC 62631-3-1"
        },
        "surface_resistivity": {
            "value": null,
            "unit": null,
            "test_condition": null,
            "test_method": null
        },
        "electric_strength": {
            "value": 762,
            "unit": "kV/in",
            "test_condition": null,
            "test_method": "IEC 60243-1"
        },
        "comparative_tracking_index_cti": {
            "value": 250,
            "unit": null,
            "test_method": "IEC 60112"
        },
        "comparative_tracking_index_cti_plc": {
            "value": null,
            "unit": null,
            "test_method": null
        }
    },
    "thermal": {
        "melting_temperature_10c_per_min": {
            "value": 437,
            "unit": "°F",
            "test_condition": null,
            "test_method": null
        },
        "temp_of_deflection_under_load_1_80_mpa": {
            "value": 369,
            "unit": "°F",
            "test_condition": null,
            "test_method": "ISO 75-1/-2"
        },
        "temp_of_deflection_under_load_0_45_mpa": {
            "value": 423,
            "unit": "°F",
            "test_condition": null,
            "test_method": "ISO 75-1/-2"
        },
        "coeff_of_linear_therm_expansion_cte_parallel": {
            "value": 0.2,
            "unit": "E-4/°F",
            "test_condition": null,
            "test_method": "ISO 11359-1/-2"
        },
        "coeff_of_linear_therm_expansion_cte_normal": {
            "value": 0.556,
            "unit": "E-4/°F",
            "test_condition": null,
            "test_method": "ISO 11359-1/-2"
        },
        "vicat_softening_temperature": {
            "value": 403,
            "unit": "°F",
            "test_condition": null,
            "test_method": "ISO 306"
        },
        "inherent_flame_resistance": {
            "value": null,
            "unit": null
        },
        "flame_retardant_fr_rating": {
            "value": null
        },
        "flame_rating_ul_94": {
            "value": null,
            "unit": null,
            "test_condition": null,
            "test_method": null
        },
        "burning_behavior_yellow_card_available": {
            "value": null
        },
        "burning_rate_thickness_1_mm": {
            "value": null,
            "unit": null,
            "test_method": null
        },
        "oxygen_index": {
            "value": 29.5,
            "unit": "%",
            "test_condition": null,
            "test_method": "ISO 4589-1/-2"
        },
        "glow_wire_flammability_index_gwfi": {
            "value": null,
            "unit": null,
            "test_condition": "dbjsbnsf jsfbjsfjdjsfdhfd",
            "test_method": null
        }
    },
    "chemical": {
        "hydrolysis_resistant_hr": {
            "value": "No"
        }
    }
}

const single = sanitizeUnifiedJson(schema);
fs.appendFileSync(path.join(process.cwd(), "Logs", "dropped_feilds.log"), "\n");
logDroppedMeasurementFields(schema, single);
console.log(single);


