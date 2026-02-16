// const spider_plot_value = {
//     strength: null,
//     stiffness: null,
//     impact_Res: null,
//     heat_cap: null,
//     therm_cond: null,
//     chem_res: null,
//     processing: null,
//     viscosity: null,
//     dim_stat: null,
// }

import { calcSpiderScore } from './calcSpiderScore.js';
import { calculateAverageCarbonFootPrint } from './calculateAverageCarbonFootprint.js';

const spider_axises = {
    mechanical: null,
    thermal_and_fire: null,
    chemical_and_moisture: null,
    dimensional_stability: null,
    processability: null,
    sustainability: null,
    price: null
}

// const spider_chart = {
//     tensile_modulus: {
//         raw_value: null,
//         score: null,
//         scoring_type: "LIN_HI",
//         min: 800,
//         max: 9000
//     },
//     flexural_modulus: {
//         raw_value: null,
//         score: null,
//         scoring_type: "LIN_HI",
//         min: 800,
//         max: 10000
//     },
//     stress_at_break : {
//         raw_value: null,
//         score: null,
//         scoring_type: "LIN_HI",
//         min: 20,
//         max: 120
//     }
// }

const spider_chart = {
    tensile_modulus: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 800,
        max: 9000
    },
    flexural_modulus: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 800,
        max: 10000
    },
    stress_at_break: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 20,
        max: 120
    },
    flexural_strength: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 30,
        max: 180
    },
    strain_at_break: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 1,
        max: 200
    },
    flexural_strain_at_flexural_strength: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 1,
        max: 100
    },
    impact_23c: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 1,
        max: 30
    },
    impact_minus_30c: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 1,
        max: 30
    },
    melt_volume_flow_rate_mvr: {
        raw_value: null,
        score: null,
        scoring_type: "LOG_HI",
        min: 0.5,
        max: 100
    },
    melt_temperature_window: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 10,
        max: 60
    },
    mold_temperature_window: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 5,
        max: 80
    },
    drying_temperature: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 60,
        max: 140
    },
    avg_drying_time: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0,
        max: 12
    },
    residual_moisture_content: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 0.01,
        max: 0.2
    },
    permitted_residence_time_prt: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 1,
        max: 10
    },
    avg_shrinkage: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0.1,
        max: 3
    },
    shrinkage_anisotropy: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0,
        max: 1
    },
    avg_cte: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0.2,
        max: 3
    },
    cte_anisotropy: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0,
        max: 2
    },
    hydrolysis_resistant: {
        raw_value: null,
        score: null,
        scoring_type: "BOOL_YES",
        min: null,
        max: null
    },
    water_absorption: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0.05,
        max: 3
    },
    humidity_absorption: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0.02,
        max: 1.5
    },
    hdt_at_1_8_mpa: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 40,
        max: 220
    },
    hdt_at_0_45_mpa: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 60,
        max: 250
    },
    melting_temperature: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 100,
        max: 350
    },
    ul94_rating: {
        raw_value: null,
        score: null,
        scoring_type: "UL94",
        min: null,
        max: null
    },
    oxygen_index: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 18,
        max: 50
    },
    glow_wire_flammability_index_gwfi: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_HI",
        min: 550,
        max: 960
    },
    burning_rate_1_mm: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0,
        max: 5
    },
    average_carbon_footprint: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 0.5,
        max: 15
    },
    estimated_price: {
        raw_value: null,
        score: null,
        scoring_type: "LIN_LO",
        min: 1,
        max: 25
    }
};





// function avg(...nums) {
//     if (nums.length === 0) return 0; // or throw an error
//     const sum = nums.reduce((a, b) => a + b, 0);
//     return sum / nums.length;
// }

// export async function calcFinalSpiderPlotValues(finalJson) {
//     const { stress_at_break, flexural_strength, tensile_modulus, flexural_modulus, charpy_notched_impact_strength_23c, charpy_notched_impact_strength_minus_30c } = finalJson.mechanical;

//     const { melt_volume_flow_rate_mvr, molding_shrinkage_normal, molding_shrinkage_parallel , thermal_conductivity_melt } = finalJson.rheological;

//     const { drying_time_circulating_air_dryer_min, drying_time_circulating_air_dryer_max, residual_moisture_content_max, melt_temperature_min, melt_temperature_max, mold_temperature_min, mold_temperature_max, permitted_residence_time_prt_max, drying_temperature_circulating_air_dryer } = finalJson.processing;

//     const { coeff_of_linear_therm_expansion_cte_parallel, coeff_of_linear_therm_expansion_cte_normal ,temp_of_deflection_under_load_1_80_mpa ,temp_of_deflection_under_load_0_45_mpa , melting_temperature_10c_per_min } = finalJson.thermal;

//     const { water_absorption, humidity_absorption } = finalJson.physical;
//     const { hydrolysis_resistant_hr } = finalJson.chemical;

//     // strength
//     spider_plot_value.strength = avg(stress_at_break.spider_chart.score, flexural_strength.spider_chart.score);

//     // stiffness
//     spider_plot_value.stiffness = avg(tensile_modulus.spider_chart.score, flexural_modulus.spider_chart.score);

//     // Impact res
//     spider_plot_value.impact_Res = avg(charpy_notched_impact_strength_23c.spider_chart.score, charpy_notched_impact_strength_minus_30c.spider_chart.score);

//     // viscosity
//     spider_plot_value.viscosity = melt_volume_flow_rate_mvr.spider_chart.score;

//     // ----------------processing
//     const melt_temperature_window = melt_temperature_max.spider_chart.score - melt_temperature_min.spider_chart.score;

//     const mold_temperature_window = mold_temperature_max.spider_chart.score - mold_temperature_min.spider_chart.score;

//     const avg_drying_time = avg(drying_time_circulating_air_dryer_max.spider_chart.score, drying_time_circulating_air_dryer_min.spider_chart.score);

//     // processing
//     spider_plot_value.processing = avg(melt_temperature_window, mold_temperature_window, avg_drying_time, mold_temperature_window, permitted_residence_time_prt_max.spider_chart.score, residual_moisture_content_max.spider_chart.score, drying_temperature_circulating_air_dryer.spider_chart.score)

//     // --------dim_stat

//     const avg_shrinkage = avg(molding_shrinkage_normal.spider_chart.score, molding_shrinkage_parallel.spider_chart.score);
//     const shrinkage_anisotropy = molding_shrinkage_parallel.spider_chart.score - molding_shrinkage_normal.spider_chart.score;

//     const avg_CTE = avg(coeff_of_linear_therm_expansion_cte_parallel.spider_chart.score, coeff_of_linear_therm_expansion_cte_normal.spider_chart.score)
//     const CTE_anisotropy = coeff_of_linear_therm_expansion_cte_parallel.spider_chart.score - coeff_of_linear_therm_expansion_cte_normal.spider_chart.score;

//     // dim_stat
//     spider_plot_value.dim_stat = avg(avg_shrinkage, shrinkage_anisotropy, avg_CTE, CTE_anisotropy);

//     // chem res
//     spider_plot_value.chem_res = avg(hydrolysis_resistant_hr.spider_chart.score, humidity_absorption.spider_chart.score, water_absorption.spider_chart.score);

//     // heat cap
//     spider_plot_value.heat_cap = avg(melting_temperature_10c_per_min.spider_chart.score,temp_of_deflection_under_load_1_80_mpa.spider_chart.score ,temp_of_deflection_under_load_0_45_mpa.spider_chart.score );

//     // therm cond
//     // spider_plot_value.therm_cond = 
// }

function avg(...nums) {
    // if no numbers or any value is null/undefined → return null
    if (nums.length === 0 || nums.some(n => n == null || Number.isNaN(n))) {
        return null;
    }

    const sum = nums.reduce((a, b) => a + b, 0);
    return sum / nums.length;
}

function toNumberOrNull(v) {
    // Excel COUNT counts numbers only; ignore "", "-", null, undefined, non-numeric strings
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
        const s = v.trim();
        if (s === "" || s === "-") return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    return null;
}

function countNums(arr) {
    return arr.reduce((c, x) => c + (x !== null ? 1 : 0), 0);
}

function average(arr) {
    const nums = arr.filter(x => x !== null);
    if (nums.length === 0) throw new Error("AVERAGE of empty");
    const sum = nums.reduce((a, b) => a + b, 0);
    return sum / nums.length;
}

function geoMean2(a, b) {
    // Excel GEOMEAN errors if any value <= 0
    if (!(a > 0) || !(b > 0)) throw new Error("GEOMEAN requires positive values");
    return Math.sqrt(a * b);
}

function calcMechanicalAxis(d14, d15, d16, d17) {
    try {
        const D14 = toNumberOrNull(d14);
        const D15 = toNumberOrNull(d15);
        const D16 = toNumberOrNull(d16);
        const D17 = toNumberOrNull(d17);

        const all = [D14, D15, D16, D17];
        if (countNums(all) === 0) return "";

        const pair1 = [D14, D15];
        const pair2 = [D16, D17];

        const hasPair1 = countNums(pair1) > 0;
        const hasPair2 = countNums(pair2) > 0;

        if (hasPair1 && hasPair2) {
            const avg1 = average(pair1);
            const avg2 = average(pair2);
            return geoMean2(avg1, avg2);
        }

        // Only one pair has numbers
        return hasPair1 ? average(pair1) : average(pair2);
    } catch (e) {
        // IFERROR(...,"")
        return "";
    }
}

function calcFireAndThermalAxis({ D36, D37, D39, D40, D41, D42 } = {}) {
    try {
        const isBlank = (v) => v === "" || v === null || v === undefined;

        // Excel COUNT: counts only real numbers (not numeric strings)
        const excelCount = (arr) =>
            arr.reduce((c, v) => (typeof v === "number" && Number.isFinite(v) ? c + 1 : c), 0);

        // Excel AVERAGE: averages only numbers; error if none
        const excelAverage = (arr) => {
            const nums = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
            if (nums.length === 0) throw new Error("DIV/0");
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        };

        // Your weighted part: include a cell if it's <> "" (non-blank)
        const weightedAvgNonBlank = (values, weights) => {
            let num = 0;
            let den = 0;

            for (let i = 0; i < values.length; i++) {
                const v = values[i];
                const w = weights[i];

                if (!isBlank(v)) {
                    den += w;

                    // Excel math coerces text to number if possible; otherwise #VALUE! -> IFERROR => ""
                    const coerced = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(coerced)) throw new Error("VALUE");
                    num += w * coerced;
                }
            }
            if (den === 0) throw new Error("DIV/0");
            return num / den;
        };

        // --- Part A (65%) ---
        const topCount = excelCount([D36, D37]);
        const topPart = topCount === 0 ? 0 : excelAverage([D36, D37]);

        // --- Part B (35%) ---
        const bottomCount = excelCount([D39, D40, D41, D42]);
        const bottomPart =
            bottomCount === 0
                ? 0
                : weightedAvgNonBlank([D39, D40, D41, D42], [0.4, 0.25, 0.25, 0.1]);

        const result = 0.65 * topPart + 0.35 * bottomPart;

        return Number.isFinite(result) ? result : "";
    } catch (e) {
        return "";
    }
}

function calcChemicalAxis({ D33, D34, D35 } = {}) {
    try {
        const isBlank = (v) => v === "" || v === null || v === undefined;

        // Mimic Excel arithmetic coercion:
        // "" -> 0, "12" -> 12, non-numeric text -> error -> ""
        const toExcelNumber = (v) => {
            if (isBlank(v)) return 0;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            const n = Number(v);
            if (!Number.isFinite(n)) throw new Error("VALUE");
            return n;
        };

        const result =
            0.4 * toExcelNumber(D33) +
            0.35 * toExcelNumber(D34) +
            0.25 * toExcelNumber(D35);

        return Number.isFinite(result) ? result : "";
    } catch (e) {
        return "";
    }
}

function calcDimensionalStabilityAxis({ D29, D30, D31, D32 } = {}) {
    try {
        // Excel AVERAGE ignores non-numeric cells, but errors (#DIV/0!) if there are no numbers at all.
        const values = [D29, D30, D31, D32];
        const nums = values.filter(v => typeof v === "number" && Number.isFinite(v));

        if (nums.length === 0) return ""; // matches IFERROR(AVERAGE(...),"") when all are non-numeric/blank

        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return Number.isFinite(avg) ? avg : "";
    } catch (e) {
        return "";
    }
}

function calcProcessabilityAxis({ D22, D23, D24, D25, D26, D27, D28 } = {}) {
    try {
        const isBlank = (v) => v === "" || v === null || v === undefined;

        // Excel COUNT counts only real numbers (not numeric strings).
        const excelCountNumbers = (arr) =>
            arr.reduce((c, v) => (typeof v === "number" && Number.isFinite(v) ? c + 1 : c), 0);

        // Excel AVERAGE averages only numbers; errors if none (but we guard with COUNT anyway).
        const excelAverageNumbers = (arr) => {
            const nums = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
            if (nums.length === 0) throw new Error("DIV/0");
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        };

        // Excel arithmetic coercion for single-cell terms (D22, D28):
        // "" -> 0 by formula, numeric ok, numeric string -> number, other text -> error -> ""
        const toExcelNumber = (v) => {
            if (isBlank(v)) return 0;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            const n = Number(v);
            if (!Number.isFinite(n)) throw new Error("VALUE");
            return n;
        };

        // ---- group pieces exactly like Excel ----
        const has22 = !isBlank(D22);
        const part22 = 0.35 * (has22 ? toExcelNumber(D22) : 0);
        const w22 = 0.35 * (has22 ? 1 : 0);

        const cnt2324 = excelCountNumbers([D23, D24]);
        const avg2324 = cnt2324 === 0 ? 0 : excelAverageNumbers([D23, D24]);
        const part2324 = 0.25 * (cnt2324 === 0 ? 0 : avg2324);
        const w2324 = 0.25 * (cnt2324 === 0 ? 0 : 1);

        const cnt252627 = excelCountNumbers([D25, D26, D27]);
        const avg252627 = cnt252627 === 0 ? 0 : excelAverageNumbers([D25, D26, D27]);
        const part252627 = 0.25 * (cnt252627 === 0 ? 0 : avg252627);
        const w252627 = 0.25 * (cnt252627 === 0 ? 0 : 1);

        const has28 = !isBlank(D28);
        const part28 = 0.15 * (has28 ? toExcelNumber(D28) : 0);
        const w28 = 0.15 * (has28 ? 1 : 0);

        const numerator = part22 + part2324 + part252627 + part28;
        const denominator = w22 + w2324 + w252627 + w28;

        // If denominator is 0, Excel would #DIV/0! then IFERROR => ""
        if (denominator === 0) return "";

        const result = numerator / denominator;
        return Number.isFinite(result) ? result : "";
    } catch (e) {
        return "";
    }
}

function absDiff(a, b) {
    // If either value is null / undefined → return null (Excel "")
    if (a == null || b == null) {
        return null;
    }

    return Math.abs(a - b);
}

export async function calcFinalSpiderPlotValues(finalJson) {

    //! first we will set price according to new changes here 

    const min = 3;
    const max = 20;

    finalJson.general.est_price.value = Math.floor(Math.random() * (max - min + 1)) + min;
    finalJson.general.est_price.unit = "USD / kg";

    //! we will set average carbon footprint here !

    finalJson.general.avrg_carbon_footprint.value = calculateAverageCarbonFootPrint(finalJson.general.polymer_type.value,finalJson.general.generic_type);
    finalJson.general.avrg_carbon_footprint.unit = "CO2e/kg"


    // calculate all row values

    spider_chart.tensile_modulus.raw_value = finalJson.mechanical.tensile_modulus.value;
    spider_chart.flexural_modulus.raw_value = finalJson.mechanical.flexural_modulus.value;
    spider_chart.stress_at_break.raw_value = finalJson.mechanical.stress_at_break.value;
    spider_chart.flexural_strength.raw_value = finalJson.mechanical.flexural_strength.value;
    spider_chart.strain_at_break.raw_value = finalJson.mechanical.strain_at_break.value;
    spider_chart.flexural_strain_at_flexural_strength.raw_value = finalJson.mechanical.flexural_strain_at_flexural_strength.value;

    if (finalJson.mechanical.charpy_notched_impact_strength_23c.value) {
        spider_chart.impact_23c.raw_value = finalJson.mechanical.charpy_notched_impact_strength_23c.value;
    }

    if (spider_chart.impact_23c.raw_value == null && finalJson.mechanical.izod_impact_strength_23c.value) {
        spider_chart.impact_23c.raw_value = finalJson.mechanical.izod_impact_strength_23c.value;
    }

    if (finalJson.mechanical.charpy_notched_impact_strength_minus_30c.value) {
        spider_chart.impact_minus_30c.raw_value = finalJson.mechanical.charpy_notched_impact_strength_minus_30c.value;
    }

    if (spider_chart.impact_minus_30c.raw_value == null && finalJson.mechanical.izod_impact_strength_minus_30c
        .value) {
        spider_chart.impact_minus_30c.value = finalJson.mechanical.izod_impact_strength_minus_30c.value;
    }

    spider_chart.melt_volume_flow_rate_mvr.raw_value = finalJson.rheological.melt_volume_flow_rate_mvr.value;

    if (finalJson.processing.melt_temperature_max.value && finalJson.processing.melt_temperature_min.value) {
        spider_chart.melt_temperature_window.raw_value = finalJson.processing.melt_temperature_max.value - finalJson.processing.melt_temperature_min.value
    }

    if (finalJson.processing.mold_temperature_max.value && finalJson.processing.mold_temperature_min.value) {
        spider_chart.mold_temperature_window.raw_value = finalJson.processing.mold_temperature_max.value - finalJson.processing.mold_temperature_min.value
    }

    spider_chart.drying_temperature.raw_value = finalJson.processing.drying_temperature_circulating_air_dryer.value;

    spider_chart.avg_drying_time.raw_value = avg(finalJson.processing.drying_time_circulating_air_dryer_min.value, finalJson.processing.drying_time_circulating_air_dryer_max.value);

    spider_chart.residual_moisture_content.raw_value = finalJson.processing.residual_moisture_content_max.value;

    spider_chart.permitted_residence_time_prt.raw_value = finalJson.processing.permitted_residence_time_prt_max.value;

    spider_chart.avg_shrinkage.raw_value = avg(finalJson.rheological.molding_shrinkage_normal.value, finalJson.rheological.molding_shrinkage_parallel.value);

    spider_chart.shrinkage_anisotropy.raw_value = absDiff(finalJson.rheological.molding_shrinkage_normal.value, finalJson.rheological.molding_shrinkage_parallel.value);

    spider_chart.avg_cte.raw_value = avg(finalJson.thermal.coeff_of_linear_therm_expansion_cte_normal.value, finalJson.thermal.coeff_of_linear_therm_expansion_cte_parallel.value);

    spider_chart.cte_anisotropy.raw_value = absDiff(finalJson.thermal.coeff_of_linear_therm_expansion_cte_normal.value, finalJson.thermal.coeff_of_linear_therm_expansion_cte_parallel.value);

    spider_chart.hydrolysis_resistant.raw_value = "";

    spider_chart.water_absorption.raw_value = finalJson.physical.water_absorption.value;

    spider_chart.humidity_absorption.raw_value = finalJson.physical.humidity_absorption.value;

    spider_chart.hdt_at_1_8_mpa.raw_value = finalJson.thermal.temp_of_deflection_under_load_1_80_mpa.value;

    spider_chart.hdt_at_0_45_mpa.raw_value = finalJson.thermal.temp_of_deflection_under_load_0_45_mpa.value;

    spider_chart.melting_temperature.raw_value = finalJson.thermal.melting_temperature_10c_per_min.value;

    spider_chart.ul94_rating.raw_value = finalJson.thermal.flame_rating_ul_94.value;

    spider_chart.oxygen_index.raw_value = finalJson.thermal.oxygen_index.value;

    spider_chart.glow_wire_flammability_index_gwfi.raw_value = finalJson.thermal.glow_wire_flammability_index_gwfi.value;

    spider_chart.burning_rate_1_mm.raw_value = finalJson.thermal.burning_rate_thickness_1_mm.value;

    spider_chart.average_carbon_footprint.raw_value = finalJson.general.avrg_carbon_footprint.value;

    spider_chart.estimated_price.raw_value = finalJson.general.est_price.value;

    // Object.entries( ([key,obj]) => {
    //     key.score = calcSpiderScore(key.raw_value,key.min,key.max,key.scoring_type);
    // })

    Object.entries(spider_chart).forEach(([key, obj]) => {
        obj.score = calcSpiderScore(obj.raw_value, obj.min, obj.max, obj.scoring_type);
    });


    // calculate all feilds for spider axises ?

    //mechanical : 
    spider_axises.mechanical = Math.floor(calcMechanicalAxis(spider_chart.tensile_modulus.score, spider_chart.flexural_modulus.score, spider_chart.stress_at_break.score, spider_chart.flexural_strength.score));

    //thermal & fire : 
    spider_axises.thermal_and_fire = Math.floor(calcFireAndThermalAxis({
        D36: spider_chart.hdt_at_1_8_mpa.score,
        D37: spider_chart.hdt_at_0_45_mpa.score,
        D39: spider_chart.ul94_rating.score,
        D40: spider_chart.oxygen_index.score,
        D41: spider_chart.glow_wire_flammability_index_gwfi.score,
        D42: spider_chart.burning_rate_1_mm.score
    }));

    //chemical & moisture
    spider_axises.chemical_and_moisture = Math.floor(calcChemicalAxis({
        D33: spider_chart.hydrolysis_resistant.score, D34: spider_chart.water_absorption.score, D35: spider_chart.humidity_absorption.score
    }
    ))

    // dimensional stability 
    spider_axises.dimensional_stability = Math.floor(calcDimensionalStabilityAxis({
        D29: spider_chart.avg_shrinkage.score,
        D30: spider_chart.shrinkage_anisotropy.score,
        D31: spider_chart.avg_cte.score,
        D32: spider_chart.cte_anisotropy.score
    })
    )
    //processability 
    spider_axises.processability = Math.floor(calcProcessabilityAxis({
        D22: spider_chart.melt_volume_flow_rate_mvr.score,
        D23: spider_chart.melt_temperature_window.score,
        D24: spider_chart.mold_temperature_window.score,
        D25: spider_chart.drying_temperature.score,
        D26: spider_chart.avg_drying_time.score,
        D27: spider_chart.residual_moisture_content.score,
        D28: spider_chart.permitted_residence_time_prt.score
    }))

    // sustainability 
    spider_axises.sustainability = Math.floor(spider_chart.average_carbon_footprint.score);

    // price
    spider_axises.price = Math.floor(spider_chart.estimated_price.score);

    finalJson["spider_chart"] = spider_chart;
    finalJson["spider_axises"] = spider_axises;

    return finalJson;
}












