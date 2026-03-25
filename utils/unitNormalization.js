/**
 * Unit Normalization and Conversion Module (schema-safe)
 *
 * IMPORTANT CONSTRAINTS (from outputSchema requirements):
 * - Do NOT add any new keys to value objects (no original_value/original_unit/etc.).
 * - Do NOT turn `value` into an object. `value` must remain scalar (number/string/null).
 *   - Ranges must stay string: "0.4 - 0.6"
 *   - Operators must stay string: "> 2E11"
 */

/**
 * Canonical unit map: defines the standard unit for each field path
 * When a value has a different unit, it will be converted to the canonical unit
 */

function normalizeConfusablePunctuation(str) {
    if (typeof str !== "string") return str;

    return str
        .normalize("NFKC")
        // dash / minus family -> ASCII hyphen-minus
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
        // slash-like chars -> ASCII slash
        .replace(/[\u2215\u2044]/g, "/")
        // dot / middle-dot family -> canonical middle dot
        .replace(/[\u2022\u22C5]/g, "·")
        // degree ring used in OCR -> degree sign
        .replace(/\u2218/g, "°")
        // Greek mu / micro sign -> canonical micro sign
        .replace(/[\u03BC]/g, "µ");
}

const CANONICAL_UNITS = {
    // Physical (Excel: kg/m³)
    "physical.density": "kg/m³",

    // Rheological (Excel: cm³/10min)
    "rheological.melt_volume_flow_rate_mvr": "cm³/10min",

    // Electrical (Excel: Ohm / Ohm*m)
    "electrical.volume_resistivity": "Ohm*m",
    "electrical.surface_resistivity": "Ohm",

    // Mechanical (Excel: MPa)
    "mechanical.tensile_modulus": "MPa",
    "mechanical.stress_at_break": "MPa",
    "mechanical.flexural_modulus": "MPa",
    "mechanical.flexural_strength": "MPa",

    // Impact strength (Excel: kJ/m²)
    "mechanical.charpy_impact_strength_23c": "kJ/m²",
    "mechanical.charpy_impact_strength_minus_30c": "kJ/m²",
    "mechanical.charpy_notched_impact_strength_23c": "kJ/m²",
    "mechanical.charpy_notched_impact_strength_minus_30c": "kJ/m²",
    "mechanical.izod_impact_strength_23c": "kJ/m²",
    "mechanical.izod_impact_strength_minus_30c": "kJ/m²",

    // Thermal (Excel: °C)
    "thermal.melting_temperature_10c_per_min": "°C",
    "thermal.temp_of_deflection_under_load_1_80_mpa": "°C",
    "thermal.temp_of_deflection_under_load_0_45_mpa": "°C",
    "thermal.glow_wire_flammability_index_gwfi": "°C",
    "thermal.vicat_softening_temperature": "°C",

    // Coefficient of linear thermal expansion (Excel: E-4/K - always output in E-4 format)
    "thermal.coeff_of_linear_therm_expansion_cte_normal": "E-4/K",
    "thermal.coeff_of_linear_therm_expansion_cte_parallel": "E-4/K",

    // Processing temperatures (Excel: °C)
    "processing.drying_temperature_circulating_air_dryer": "°C",
    "processing.melt_temperature_min": "°C",
    "processing.melt_temperature_max": "°C",
    "processing.ejection_temperature": "°C",
    "processing.mold_temperature_min": "°C",
    "processing.mold_temperature_max": "°C",

    // "rheological.melt_volume_flow_rate_mvr": "g/10 min",

    "rheological.density_melt": "kg/m³",

    "rheological.specific_heat_capacity_melt": "J/(kg·K)",

    "rheological.thermal_conductivity_melt": "W/(m·K)",

    "processing.drying_time_circulating_air_dryer_min": "h",
    "processing.drying_time_circulating_air_dryer_max": "h",

    "processing.permitted_residence_time_prt_min": "min",
    "processing.permitted_residence_time_prt_max": "min",

    "mechanical.flexural_strain_at_flexural_strength": "% ISO",

    "electrical.dissipation_factor_100hz": "E-4",
    "electrical.dissipation_factor_1mhz": "E-4",

    "electrical.electric_strength": "kV/mm",

    "thermal.burning_rate_thickness_1_mm": "in/mm",

};

/**
 * Unit conversion factors
 * Maps from source unit to target unit with conversion factor
 * Format: { fromUnit: { toUnit: factor } }
 * To convert: value_in_toUnit = value_in_fromUnit * factor
 */

const UNIT_CONVERSIONS = {
    // Density -> canonical kg/m³
    "g/cm³": { "kg/m³": 1000 },
    "g/cm3": { "kg/m³": 1000 },
    "kg/m³": { "kg/m³": 1 },
    "kg/m3": { "kg/m³": 1 },
    "g/mL": { "kg/m³": 1000 },
    "kg/L": { "kg/m³": 1000 },
    "g/L": { "kg/m³": 1 },
    "mg/mL": { "kg/m³": 1 },
    "mg/L": { "kg/m³": 0.001 },
    "lb/ft³": { "kg/m³": 16.01846337396 },
    "lb/in³": { "kg/m³": 27679.9047102 },
    "lb/gal (US)": { "kg/m³": 119.8264273169 },
    "lb/gal (UK)": { "kg/m³": 99.7763726631 },
    "oz/in³": { "kg/m³": 1729.9940443877 },
    "slug/ft³": { "kg/m³": 515.3788184919 },
    "ton/m³": { "kg/m³": 1000 },
    "ton/yd³": { "kg/m³": 1307.9506193144 },

    // MVR -> canonical cm³/10min (volume flow)
    "cm³/10min": { "cm³/10min": 1 },
    "cm³/10 min": { "cm³/10min": 1 },
    "cm3/10min": { "cm³/10min": 1 },
    "cm3/10 min": { "cm³/10min": 1 },

    // Resistivity -> canonical Ohm*m
    "Ohm*m": { "Ohm*m": 1 },
    "Ohm.m": { "Ohm*m": 1 },
    "Ohm m": { "Ohm*m": 1 },
    "Ω·m": { "Ohm*m": 1 },
    "Ω.m": { "Ohm*m": 1 },
    "Ω m": { "Ohm*m": 1 },

    "Ω·cm": { "Ohm*m": 0.01 },
    "Ω.cm": { "Ohm*m": 0.01 },
    "Ω cm": { "Ohm*m": 0.01 },
    "ohm-cm": { "Ohm*m": 0.01 },
    "Ohm.cm": { "Ohm*m": 0.01 },
    "Ohm cm": { "Ohm*m": 0.01 },

    // Surface resistivity -> canonical Ohm
    "Ohm": { "Ohm": 1 },
    "Ω": { "Ohm": 1 },
    "Ohm/sq": { "Ohm": 1 },
    "ohm/sq": { "Ohm": 1 },
    "Ω/sq": { "Ohm": 1 },

    // Temperature normalization (keep!)
    "°C": { "°C": 1 },
    "° C": { "°C": 1 },
    "degC": { "°C": 1 },
    "C": { "°C": 1 },

    // Pressure/stress
    "GPa": { "GPa": 1, "MPa": 1000 },
    "MPa": { "MPa": 1, "GPa": 0.001 },
    "kPa": { "MPa": 0.001 },
    "Pa": { "MPa": 0.000001 },
    "psi": { "MPa": 0.006894757293168 },
    "ksi": { "MPa": 6.894757293168 },
    "lb/in²": { "MPa": 0.006894757293168 },
    "lb/in2": { "MPa": 0.006894757293168 },
    "lb/in^2": { "MPa": 0.006894757293168 },
    "lbf/in²": { "MPa": 0.006894757293168 },
    "lbf/in2": { "MPa": 0.006894757293168 },
    "lbf/in^2": { "MPa": 0.006894757293168 },

    //! adding
    "g/10 min": { "g/10 min": 1 },
    "g/10min": { "g/10 min": 1 },

    // Impact strength -> canonical kJ/m²
    "kJ/m²": { "kJ/m²": 1 },
    "kJ/m2": { "kJ/m²": 1 },
    "kJ/m^2": { "kJ/m²": 1 },
    "kJ/msquare": { "kJ/m²": 1 },
    "J/m²": { "kJ/m²": 0.001 },      // J/m² -> kJ/m²: divide by 1000
    "J/m2": { "kJ/m²": 0.001 },
    "J/m^2": { "kJ/m²": 0.001 },
    "J/msquare": { "kJ/m²": 0.001 },
    "J/cm²": { "kJ/m²": 10 },        // J/cm² -> kJ/m²: multiply by 10 (1 cm² = 1e-4 m², so 1 J/cm² = 10,000 J/m² = 10 kJ/m²)
    "J/cm2": { "kJ/m²": 10 },
    "J/cm^2": { "kJ/m²": 10 },
    "kJ/cm²": { "kJ/m²": 10000 },    // kJ/cm² -> kJ/m²: multiply by 10,000
    "kJ/cm2": { "kJ/m²": 10000 },
    "kJ/cm^2": { "kJ/m²": 10000 },
    "ft·lbf/in²": { "kJ/m²": 2.101522 },  // ft·lbf/in² -> kJ/m²: multiply by 2.101522
    "ft·lbf/in2": { "kJ/m²": 2.101522 },
    "ft·lbf/in^2": { "kJ/m²": 2.101522 },
    "ft-lbf/in²": { "kJ/m²": 2.101522 },
    "ft-lbf/in2": { "kJ/m²": 2.101522 },
    "ft-lbf/in^2": { "kJ/m²": 2.101522 },
    "ft·lb/in²": { "kJ/m²": 2.101522 },
    "ft·lb/in2": { "kJ/m²": 2.101522 },
    "ft·lb/in^2": { "kJ/m²": 2.101522 },
    "ft-lb/in²": { "kJ/m²": 2.101522 },
    "ft-lb/in2": { "kJ/m²": 2.101522 },
    "ft-lb/in^2": { "kJ/m²": 2.101522 },
    "ftlbf/in²": { "kJ/m²": 2.101522 },
    "ftlbf/in2": { "kJ/m²": 2.101522 },
    "ftlbf/in^2": { "kJ/m²": 2.101522 },
    "ftlb/in²": { "kJ/m²": 2.101522 },
    "ftlb/in2": { "kJ/m²": 2.101522 },
    "ftlb/in^2": { "kJ/m²": 2.101522 },



    // Specific heat capacity -> canonical J/(kg·K)
    "J/(kg·K)": { "J/(kg·K)": 1 },
    "kJ/(kg·K)": { "J/(kg·K)": 1000 },
    "cal/(g·°C)": { "J/(kg·K)": 4184 },
    "kcal/(kg·°C)": { "J/(kg·K)": 4184 },
    "cal/(kg·°C)": { "J/(kg·K)": 4.184 },
    "Btu/(lb·°F)": { "J/(kg·K)": 4186.8 },
    "Btu/(lb·°R)": { "J/(kg·K)": 4186.8 },
    "kJ/(kg·°C)": { "J/(kg·K)": 1000 },
    "J/(g·K)": { "J/(kg·K)": 1000 },
    "J/(g·°C)": { "J/(kg·K)": 1000 },
    "kJ/(g·K)": { "J/(kg·K)": 1000000 },
    "erg/(g·K)": { "J/(kg·K)": 0.0001 },
    "ft·lbf/(lb·°F)": { "J/(kg·K)": 5.380320456 },
    "Wh/(kg·K)": { "J/(kg·K)": 3600 },
    "kWh/(kg·K)": { "J/(kg·K)": 3600000 },

    // Thermal conductivity -> canonical W/(m·K)
    "W/(m·K)": { "W/(m·K)": 1 },
    "kW/(m·K)": { "W/(m·K)": 1000 },
    "mW/(m·K)": { "W/(m·K)": 0.001 },

    "W/(m·°C)": { "W/(m·K)": 1 },
    "kW/(m·°C)": { "W/(m·K)": 1000 },
    "mW/(m·°C)": { "W/(m·K)": 0.001 },

    "W/(cm·K)": { "W/(m·K)": 100 },
    "W/(cm·°C)": { "W/(m·K)": 100 },

    "W/(mm·K)": { "W/(m·K)": 1000 },
    "W/(mm·°C)": { "W/(m·K)": 1000 },

    "W/(µm·K)": { "W/(m·K)": 1000000 },

    "kW/(cm·K)": { "W/(m·K)": 100000 },
    "kW/(mm·K)": { "W/(m·K)": 1000000 },

    "J/(s·m·K)": { "W/(m·K)": 1 },
    "J/(s·cm·K)": { "W/(m·K)": 100 },
    "J/(s·mm·K)": { "W/(m·K)": 1000 },

    "cal/(s·cm·°C)": { "W/(m·K)": 418.4 },
    "cal/(s·m·°C)": { "W/(m·K)": 4.184 },

    "kcal/(h·m·°C)": { "W/(m·K)": 1.1622222222222223 },
    "kcal/(h·cm·°C)": { "W/(m·K)": 116.22222222222223 },

    "Btu/(ft·h·°F)": { "W/(m·K)": 1.7307346663713907 },
    "Btu/(ft·s·°F)": { "W/(m·K)": 6230.644798937008 },
    "Btu/(in·h·°F)": { "W/(m·K)": 20.76881599645669 },

    "erg/(s·cm·K)": { "W/(m·K)": 0.00001 },

    // Time duration -> canonical h
    "h": { "h": 1 },
    "hr": { "h": 1 },
    "hrs": { "h": 1 },
    "hour": { "h": 1 },
    "hours": { "h": 1 },

    "min": { "h": 1 / 60 },
    "mins": { "h": 1 / 60 },
    "minute": { "h": 1 / 60 },
    "minutes": { "h": 1 / 60 },

    "s": { "h": 1 / 3600 },
    "sec": { "h": 1 / 3600 },
    "secs": { "h": 1 / 3600 },
    "second": { "h": 1 / 3600 },
    "seconds": { "h": 1 / 3600 },

    "ms": { "h": 1 / 3600000 },
    "millisecond": { "h": 1 / 3600000 },
    "milliseconds": { "h": 1 / 3600000 },

    "µs": { "h": 1 / 3600000000 },
    "μs": { "h": 1 / 3600000000 },
    "us": { "h": 1 / 3600000000 },
    "microsecond": { "h": 1 / 3600000000 },
    "microseconds": { "h": 1 / 3600000000 },

    "ns": { "h": 1 / 3600000000000 },
    "nanosecond": { "h": 1 / 3600000000000 },
    "nanoseconds": { "h": 1 / 3600000000000 },

    "d": { "h": 24 },
    "day": { "h": 24 },
    "days": { "h": 24 },

    "week": { "h": 168 },
    "weeks": { "h": 168 },
    "wk": { "h": 168 },
    "wks": { "h": 168 },


    // Time duration -> canonical min
    "min": { "min": 1 },
    "mins": { "min": 1 },
    "minute": { "min": 1 },
    "minutes": { "min": 1 },

    "h": { "min": 60 },
    "hr": { "min": 60 },
    "hrs": { "min": 60 },
    "hour": { "min": 60 },
    "hours": { "min": 60 },

    "s": { "min": 1 / 60 },
    "sec": { "min": 1 / 60 },
    "secs": { "min": 1 / 60 },
    "second": { "min": 1 / 60 },
    "seconds": { "min": 1 / 60 },

    "ms": { "min": 1 / 60000 },
    "millisecond": { "min": 1 / 60000 },
    "milliseconds": { "min": 1 / 60000 },

    "µs": { "min": 1 / 60000000 },
    "μs": { "min": 1 / 60000000 },
    "us": { "min": 1 / 60000000 },
    "microsecond": { "min": 1 / 60000000 },
    "microseconds": { "min": 1 / 60000000 },

    "ns": { "min": 1 / 60000000000 },
    "nanosecond": { "min": 1 / 60000000000 },
    "nanoseconds": { "min": 1 / 60000000000 },

    "d": { "min": 1440 },
    "day": { "min": 1440 },
    "days": { "min": 1440 },

    "week": { "min": 10080 },
    "weeks": { "min": 10080 },
    "wk": { "min": 10080 },
    "wks": { "min": 10080 },

    "%": { "%": 1, "% ISO": 1 },
    "% ISO": { "% ISO": 1 },


    // Electric strength -> canonical kV/mm
    "V/m": { "kV/mm": 0.000001 },
    "V/cm": { "kV/mm": 0.00001 },
    "V/mm": { "kV/mm": 0.001 },
    "V/in": { "kV/mm": 0.00003937007874015748 },

    "kV/m": { "kV/mm": 0.001 },
    "kV/cm": { "kV/mm": 0.1 },
    "kV/mm": { "kV/mm": 1 },
    "kV/in": { "kV/mm": 0.03937007874015748 },

    "MV/m": { "kV/mm": 1 },
    "MV/cm": { "kV/mm": 100 },
    "MV/mm": { "kV/mm": 1000 },
    "MV/in": { "kV/mm": 39370.07874015748 },

    "V/µm": { "kV/mm": 1 },
    "kV/µm": { "kV/mm": 1000 },
    "MV/µm": { "kV/mm": 1000000 },

    "N/C": { "kV/mm": 0.000001 },

    // Burning rate thickness -> canonical in/mm
    "mm/mm": { "in/mm": 0.03937007874015748 },
    "cm/mm": { "in/mm": 0.3937007874015748 },
    "m/mm": { "in/mm": 39.37007874015748 },
    "km/mm": { "in/mm": 39370.078740157485 },

    "in/mm": { "in/mm": 1 },
    "ft/mm": { "in/mm": 12 },
    "yd/mm": { "in/mm": 36 },

    "mil/mm": { "in/mm": 0.001 },
    "µm/mm": { "in/mm": 0.00003937007874015748 },
    "nm/mm": { "in/mm": 0.00000003937007874015748 },

    "in/in": { "in/mm": 0.03937007874015748 },
    "ft/in": { "in/mm": 0.47244094488188987 },
    "yd/in": { "in/mm": 1.4173228346456694 },

    "mm/in": { "in/mm": 0.0015500031000062 },
    "cm/in": { "in/mm": 0.015500031000062002 },
    "m/in": { "in/mm": 1.5500031000062002 },
    "mil/in": { "in/mm": 0.00003937007874015748 },
    "µm/in": { "in/mm": 0.0000015500031000062003 },

    "mm/cm": { "in/mm": 0.003937007874015748 },
    "cm/cm": { "in/mm": 0.03937007874015748 },
    "m/cm": { "in/mm": 3.937007874015748 },
    "in/cm": { "in/mm": 0.1 },
    "ft/cm": { "in/mm": 1.2 },

    "mm/m": { "in/mm": 0.00003937007874015748 },
    "cm/m": { "in/mm": 0.00039370078740157485 },
    "m/m": { "in/mm": 0.03937007874015748 },
    "km/m": { "in/mm": 39.37007874015749 },
    "in/m": { "in/mm": 0.001 },
    "ft/m": { "in/mm": 0.012 },
    "yd/m": { "in/mm": 0.036 },
};

function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function formatExponentString(n) {
    // Canonical scientific string like "2E11" (uppercase E, no "+")
    const s = n.toExponential(); // e.g. "2e+11"
    const m = s.split("e");
    if (m.length !== 2) return s;
    const mantissa = m[0];
    const exp = m[1].replace("+", "");
    return `${mantissa}E${exp}`;
}

function formatScalarForString(n) {
    // Prefer plain string for moderate values, scientific for very large/small.
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return formatExponentString(n);
    return String(n);
}

function parseOperatorString(s) {
    if (typeof s !== "string") return null;
    const m = s.trim().match(/^(>=|<=|>|<|≥|≤)\s*(.+)$/);
    if (!m) return null;
    return { operator: m[1], rhs: m[2].trim() };
}

function parseRangeString(s) {
    if (typeof s !== "string") return null;
    const trimmed = s.trim();
    const splits = [
        { re: /\s+to\s+/i, split: /\s+to\s+/i },
        { re: /\s+-\s+/, split: /\s+-\s+/ },
        { re: /\s+–\s+/, split: /\s+–\s+/ },
        { re: /\s+—\s+/, split: /\s+—\s+/ },
    ];
    for (const { re, split } of splits) {
        if (re.test(trimmed)) {
            const parts = trimmed.split(split);
            if (parts.length === 2) return { a: parts[0].trim(), b: parts[1].trim() };
        }
    }
    return null;
}

/**
 * Parses numeric-ish strings including:
 * - European decimals: "3,5" -> 3.5
 * - Scientific notation: "2E9" -> 2e9
 * - Multiplicative scientific forms: "2x10^11", "2 * 10¹¹" -> 2e11
 *
 * If it can't be parsed deterministically, returns null.
 */
export function parseNumericExpression(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;

    let s = raw.trim();
    if (!s) return null;

    // Normalize unicode superscripts (0-9) into normal digits for exponent parsing.
    const superscripts = {
        '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
        '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
    };
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (m) => superscripts[m] ?? m);

    // Normalize decimal comma when it looks like a decimal separator.
    // Note: don't escape '-' in Unicode regex; use -? directly.
    s = s.replace(/^(-?\d+),(\d+)$/u, '$1.$2');

    // Strip spaces
    s = s.replace(/\s+/g, '');

    // 1) Plain scientific notation (2E9, 5.0e+2)
    if (/^-?\d+(\.\d+)?[Ee][+-]?\d+$/u.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    // 2) Plain number
    if (/^-?\d+(\.\d+)?$/u.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    // 3) Multiplicative scientific forms: 2x10^11, 2*10^11, 2×10^11, 2·10^11
    const multSci = s.match(/^(-?\d+(\.\d+)?)(x|\*|×|·)10(\^)?(-?\d+)$/iu);
    if (multSci) {
        const a = Number(multSci[1]);
        const b = Number(multSci[5]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        const n = a * Math.pow(10, b);
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

/**
 * Gets the canonical unit for a given field path
 * 
 * @param {string} fieldPath - The dot-separated path to the field
 * @returns {string|null} - The canonical unit, or null if not defined
 */
export function getCanonicalUnit(fieldPath) {
    return CANONICAL_UNITS[fieldPath] || null;
}

/**
 * Converts a temperature value from one unit to another
 * Handles °F -> °C and K -> °C conversions with proper formulas
 * 
 * @param {number} value - The numeric value to convert
 * @param {string} fromUnit - The source unit (normalized)
 * @param {string} toUnit - The target unit (canonical, should be °C)
 * @returns {number|null} - Converted value (floored to 2 decimal places), or null if conversion not available
 */
function convertTemperature(value, fromUnit, toUnit) {
    const normalizedFrom = normalizeUnitForConversion(fromUnit);
    const normalizedTo = normalizeUnitForConversion(toUnit);

    // If already in target unit, return as-is (but still floor)
    if (normalizedFrom === normalizedTo) {
        return floorTo2(value);
    }

    let converted = null;

    // Convert to °C
    if (normalizedTo === "°C") {
        if (normalizedFrom === "°F" || normalizedFrom === "F" || normalizedFrom === "degF" || normalizedFrom === "fahrenheit") {
            // °F -> °C: (F - 32) * 5/9
            converted = (value - 32) * (5 / 9);
        } else if (normalizedFrom === "K" || normalizedFrom === "kelvin") {
            // K -> °C: K - 273.15
            converted = value - 273.15;
        } else if (normalizedFrom === "°C" || normalizedFrom === "C" || normalizedFrom === "degC" || normalizedFrom === "celsius" || normalizedFrom === "centigrade") {
            // Already °C, no conversion needed
            converted = value;
        }
    }

    if (converted === null) {
        return null;
    }

    // Floor to 2 decimal places
    return floorTo2(converted);
}

/**
 * Converts a CTE (coefficient of linear thermal expansion) value to E-4/K
 * Handles per-°C, per-K, ppm, µm/m, and per-°F conversions
 * 
 * @param {number} value - The numeric value to convert
 * @param {string} fromUnit - The source unit (normalized)
 * @param {string} toUnit - The target unit (canonical, should be E-4/K)
 * @returns {Object|null} - {value, unit} object with converted value (floored to 2 decimal places), or null if conversion not available
 */
function convertCTE(value, fromUnit, toUnit) {
    const normalizedFrom = normalizeUnitForConversion(fromUnit);
    const targetUnit = "E-4/K";

    // If already in target unit format (case-insensitive), normalize unit and return value as-is
    if (normalizedFrom.match(/^E-4\/K$/i)) {
        return { value: floorTo2(value), unit: targetUnit };
    }

    // Parse unit to extract scale factor and temperature unit
    let scaleFactor = 1; // Default: no scaling (value is already in 1/K or 1/°C or 1/°F)
    let tempUnit = null; // 'C', 'K', or 'F'
    let unitStr = normalizedFrom;

    // Handle "ratio clutter" - remove length/length parts (cm/cm, m/m, etc.)
    // Pattern: something/something/temp -> treat as /temp
    // Examples: cm/cm/°C -> /°C, m/m/K -> /K, degreeC/cm/degreeC -> /degreeC
    // But preserve: ppm/°C, E-4/K, x10^-6/°C (these have meaningful prefixes)
    // Check if unit starts with special prefixes that should be preserved
    const hasSpecialPrefix = /^(ppm|E[-+]?\d+|x10|×10|µm\/m|um\/m)/i.test(unitStr);
    if (!hasSpecialPrefix) {
        // Remove ratio clutter: pattern like "word/word/temp" -> "/temp"
        // Match common length units: cm, m, mm, in, inch, etc. or generic words
        // This handles: cm/cm/°C, m/m/K, degreeC/cm/degreeC, etc.
        unitStr = unitStr.replace(/^[^\/]+\/[^\/]+\//, '/');
        // Handle multiple levels if needed
        unitStr = unitStr.replace(/^[^\/]+\/[^\/]+\//, '/');
    }

    // Extract E notation (E-4, E-6, etc.)
    const eMatch = unitStr.match(/^E([-+]?)(\d+)\/(.+)$/i);
    if (eMatch) {
        const sign = eMatch[1] === '-' ? -1 : 1;
        const exp = parseInt(eMatch[2], 10);
        scaleFactor = Math.pow(10, sign * exp); // E-4 => 1e-4, E-6 => 1e-6
        unitStr = '/' + eMatch[3]; // Extract temperature part
    }

    // Extract x10 notation (x10^-6, ×10^-6, etc.)
    const x10Match = unitStr.match(/^([×x]10\^?[-]?)(\d+)\/(.+)$/i);
    if (x10Match && !eMatch) {
        const sign = x10Match[1].includes('-') ? -1 : 1;
        const exp = parseInt(x10Match[2], 10);
        scaleFactor = Math.pow(10, sign * exp); // x10^-6 => 1e-6
        unitStr = '/' + x10Match[3]; // Extract temperature part
    }

    // Extract ppm or µm/m (both mean 1e-6)
    if (unitStr.match(/^ppm/i) || unitStr.match(/µm\/m/i) || unitStr.match(/um\/m/i)) {
        scaleFactor = 1e-6;
        // Remove ppm/µm/m prefix to get temperature part
        unitStr = unitStr.replace(/^ppm\s*/i, '');
        unitStr = unitStr.replace(/^µm\/m\s*/i, '');
        unitStr = unitStr.replace(/^um\/m\s*/i, '');
        if (!unitStr.startsWith('/')) {
            unitStr = '/' + unitStr;
        }
    }

    // Extract temperature unit from remaining string
    // Patterns: /°C, /K, /°F, °C^-1, K^-1, °F^-1, 1/°C, 1/K, 1/°F, C, K, F (standalone)
    // Also handle: degreeC, degreeF, celsius, fahrenheit, kelvin
    if (unitStr.match(/\/\s*°?C/i) || unitStr.match(/°?C\s*\^?[-]?1/i) || unitStr.match(/1\s*\/\s*°?C/i) ||
        unitStr.match(/\/\s*C(?=\s|$|\/)/i) || unitStr.match(/C\s*\^?[-]?1(?=\s|$)/i) ||
        unitStr.match(/^C(?=\s|$)/i) || unitStr.match(/degree\s*C/i) || unitStr.match(/celsius/i)) {
        tempUnit = 'C';
    } else if (unitStr.match(/\/\s*K(?=\s|$|\/)/i) || unitStr.match(/K\s*\^?[-]?1(?=\s|$)/i) ||
        unitStr.match(/1\s*\/\s*K(?=\s|$)/i) || unitStr.match(/^K(?=\s|$)/i) ||
        unitStr.match(/kelvin/i)) {
        tempUnit = 'K';
    } else if (unitStr.match(/\/\s*°?F/i) || unitStr.match(/°?F\s*\^?[-]?1/i) || unitStr.match(/1\s*\/\s*°?F/i) ||
        unitStr.match(/\/\s*F(?=\s|$|\/)/i) || unitStr.match(/F\s*\^?[-]?1(?=\s|$)/i) ||
        unitStr.match(/^F(?=\s|$)/i) || unitStr.match(/degree\s*F/i) || unitStr.match(/fahrenheit/i)) {
        tempUnit = 'F';
    }

    // If we couldn't parse the unit, return null
    if (tempUnit === null) {
        return null;
    }

    // Compute conversion:
    // 1. Start with value_in * scaleFactor to get true α (in 1/tempUnit)
    let alpha = value * scaleFactor;

    // 2. If per °F, convert to per K: α_K = α_F * 1.8
    if (tempUnit === 'F') {
        alpha = alpha * 1.8;
    }
    // Note: °C and K are the same for CTE (ΔK == Δ°C), so no conversion needed

    // 3. Scale to E-4/K format: value_out = alpha * 1e4
    const valueOut = alpha * 1e4;

    // Floor to 2 decimal places
    return { value: floorTo2(valueOut), unit: targetUnit };
}

/**
 * Converts a value from one unit to another
 * 
 * @param {number} value - The numeric value to convert
 * @param {string} fromUnit - The source unit (normalized)
 * @param {string} toUnit - The target unit (canonical)
 * @returns {number|null} - Converted value, or null if conversion not available
 */
export function convertUnit(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
        return value; // No conversion needed
    }

    // Normalize units first (handle case variations, spacing, etc.)
    const normalizedFrom = normalizeUnitForConversion(fromUnit);
    const normalizedTo = normalizeUnitForConversion(toUnit);

    if (normalizedFrom === normalizedTo) {
        return value;
    }

    // Check if this is a temperature conversion
    const isTemperature = normalizedTo === "°C" &&
        (normalizedFrom === "°C" || normalizedFrom === "C" || normalizedFrom === "degC" ||
            normalizedFrom === "celsius" || normalizedFrom === "centigrade" ||
            normalizedFrom === "°F" || normalizedFrom === "F" || normalizedFrom === "degF" ||
            normalizedFrom === "fahrenheit" ||
            normalizedFrom === "K" || normalizedFrom === "kelvin");

    if (isTemperature) {
        return convertTemperature(value, fromUnit, toUnit);
    }

    // Check if this is a CTE (coefficient of linear thermal expansion) conversion
    const isCTE = (normalizedTo === "E-4/K" || normalizedTo === "1/K" || normalizedTo.match(/^E[-+]\d+\/K$/i)) &&
        (normalizedFrom.includes("/°C") || normalizedFrom.includes("/K") || normalizedFrom.includes("/°F") ||
            normalizedFrom.includes("ppm") || normalizedFrom.includes("µm/m") || normalizedFrom.includes("x10") ||
            normalizedFrom.includes("×10") || normalizedFrom.includes("°C^-1") || normalizedFrom.includes("°C⁻¹") ||
            normalizedFrom.includes("K^-1") || normalizedFrom.includes("K⁻¹") || normalizedFrom.includes("°F^-1") ||
            normalizedFrom.match(/^E[-+]\d+\//i));

    if (isCTE) {
        const result = convertCTE(value, fromUnit, toUnit);
        // convertCTE now returns {value, unit} object
        if (result && typeof result === 'object' && 'value' in result) {
            return result;
        }
        // Fallback for old format (shouldn't happen)
        return result;
    }

    // Look up conversion factor
    const conversions = UNIT_CONVERSIONS[normalizedFrom];
    if (!conversions) {
        return null; // Unknown source unit
    }

    const factor = conversions[normalizedTo];
    if (factor === undefined || factor === null) {
        return null; // Conversion not available
    }

    const converted = value * factor;
    // Apply floorTo2 for all conversions (user requirement)
    return floorTo2(converted);
}




function normalizeDensityUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/³/g, "3")
        .replace(/\^3/g, "3")
        .replace(/cubed/g, "cube")
        .replace(/cubic/g, "cube")
        .replace(/feet/g, "ft")
        .replace(/foot/g, "ft")
        .replace(/inch(?:es)?/g, "in")
        .replace(/yards?/g, "yd")
        .replace(/met(?:er|re)s?/g, "m")
        .replace(/centimet(?:er|re)s?/g, "cm")
        .replace(/millilit(?:er|re)s?/g, "ml")
        .replace(/lit(?:er|re)s?/g, "l")
        .replace(/milligrams?/g, "mg")
        .replace(/kilograms?/g, "kg")
        .replace(/grams?/g, "g")
        .replace(/pounds?/g, "lb")
        .replace(/ounces?/g, "oz")
        .replace(/slugs?/g, "slug")
        .replace(/tons?/g, "ton")
        .replace(/imperial/g, "uk")
        .replace(/u\.?k\.?/g, "uk")
        .replace(/u\.?s\.?/g, "us")
        .replace(/\s+/g, "")
        .replace(/[()]/g, "");

    const map = {
        "kg/m3": "kg/m³",
        "kg/mcube": "kg/m³",

        "g/cm3": "g/cm³",
        "g/cmcube": "g/cm³",

        "g/ml": "g/mL",
        "kg/l": "kg/L",
        "g/l": "g/L",
        "mg/ml": "mg/mL",
        "mg/l": "mg/L",

        "lb/ft3": "lb/ft³",
        "lb/ftcube": "lb/ft³",

        "lb/in3": "lb/in³",
        "lb/incube": "lb/in³",

        "lb/galus": "lb/gal (US)",
        "lb/galuk": "lb/gal (UK)",

        "oz/in3": "oz/in³",
        "oz/incube": "oz/in³",

        "slug/ft3": "slug/ft³",
        "slug/ftcube": "slug/ft³",

        "ton/m3": "ton/m³",
        "ton/mcube": "ton/m³",

        "ton/yd3": "ton/yd³",
        "ton/ydcube": "ton/yd³",
    };

    return map[compact] || null;
}



function normalizeSpecificHeatCapacityUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/[·⋅.]/g, "*")
        .replace(/deg/g, "°")
        .replace(/centigrade/g, "°c")
        .replace(/celsius/g, "°c")
        .replace(/kelvin/g, "k");

    if (/^j\/kg\*?k$/.test(compact)) return "J/(kg·K)";
    if (/^kj\/kg\*?k$/.test(compact)) return "kJ/(kg·K)";
    if (/^kj\/kg\*?°c$/.test(compact)) return "kJ/(kg·°C)";
    if (/^cal\/g\*?°c$/.test(compact)) return "cal/(g·°C)";
    if (/^kcal\/kg\*?°c$/.test(compact)) return "kcal/(kg·°C)";
    if (/^cal\/kg\*?°c$/.test(compact)) return "cal/(kg·°C)";
    if (/^btu\/lb\*?°f$/.test(compact)) return "Btu/(lb·°F)";
    if (/^btu\/lb\*?°r$/.test(compact)) return "Btu/(lb·°R)";
    if (/^j\/g\*?k$/.test(compact)) return "J/(g·K)";
    if (/^j\/g\*?°c$/.test(compact)) return "J/(g·°C)";
    if (/^kj\/g\*?k$/.test(compact)) return "kJ/(g·K)";
    if (/^erg\/g\*?k$/.test(compact)) return "erg/(g·K)";
    if (/^ft\*?lbf\/lb\*?°f$/.test(compact) || /^ftlbf\/lb\*?°f$/.test(compact)) return "ft·lbf/(lb·°F)";
    if (/^wh\/kg\*?k$/.test(compact)) return "Wh/(kg·K)";
    if (/^kwh\/kg\*?k$/.test(compact)) return "kWh/(kg·K)";

    return null;
}

function normalizeThermalConductivityUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/[·⋅.]/g, "*")
        .replace(/µ|μ/g, "u")
        .replace(/deg/g, "°")
        .replace(/centigrade/g, "°c")
        .replace(/celsius/g, "°c")
        .replace(/kelvin/g, "k")
        .replace(/seconds?/g, "s")
        .replace(/hours?/g, "h")
        .replace(/watts?/g, "w")
        .replace(/kilowatts?/g, "kw")
        .replace(/milliwatts?/g, "mw")
        .replace(/joules?/g, "j")
        .replace(/calories?/g, "cal")
        .replace(/kilocalories?/g, "kcal")
        .replace(/btu(?:s)?/g, "btu")
        .replace(/ergs?/g, "erg")
        .replace(/meters?|metres?/g, "m")
        .replace(/centimeters?|centimetres?/g, "cm")
        .replace(/millimeters?|millimetres?/g, "mm")
        .replace(/micrometers?|micrometres?|microns?/g, "um")
        .replace(/feet|foot/g, "ft")
        .replace(/inches?|inch/g, "in");

    const map = {
        "w/m*k": "W/(m·K)",
        "kw/m*k": "kW/(m·K)",
        "mw/m*k": "mW/(m·K)",

        "w/m*°c": "W/(m·°C)",
        "kw/m*°c": "kW/(m·°C)",
        "mw/m*°c": "mW/(m·°C)",

        "w/cm*k": "W/(cm·K)",
        "w/cm*°c": "W/(cm·°C)",

        "w/mm*k": "W/(mm·K)",
        "w/mm*°c": "W/(mm·°C)",

        "w/um*k": "W/(µm·K)",

        "kw/cm*k": "kW/(cm·K)",
        "kw/mm*k": "kW/(mm·K)",

        "j/s*m*k": "J/(s·m·K)",
        "j/s*cm*k": "J/(s·cm·K)",
        "j/s*mm*k": "J/(s·mm·K)",

        "cal/s*cm*°c": "cal/(s·cm·°C)",
        "cal/s*m*°c": "cal/(s·m·°C)",

        "kcal/h*m*°c": "kcal/(h·m·°C)",
        "kcal/h*cm*°c": "kcal/(h·cm·°C)",

        "btu/ft*h*°f": "Btu/(ft·h·°F)",
        "btu/ft*s*°f": "Btu/(ft·s·°F)",
        "btu/in*h*°f": "Btu/(in·h·°F)",

        "erg/s*cm*k": "erg/(s·cm·K)",

        "w/mk": "W/(m·K)",
        "kw/mk": "kW/(m·K)",
        "mw/mk": "mW/(m·K)",

        "w/m°c": "W/(m·°C)",
        "kw/m°c": "kW/(m·°C)",
        "mw/m°c": "mW/(m·°C)",

        "w/cmk": "W/(cm·K)",
        "w/cm°c": "W/(cm·°C)",

        "w/mmk": "W/(mm·K)",
        "w/mm°c": "W/(mm·°C)",

        "w/umk": "W/(µm·K)",

        "kw/cmk": "kW/(cm·K)",
        "kw/mmk": "kW/(mm·K)",

        "j/smk": "J/(s·m·K)",
        "j/scmk": "J/(s·cm·K)",
        "j/smmk": "J/(s·mm·K)",

        "erg/scmk": "erg/(s·cm·K)",
    };

    return map[compact] || null;
}

function normalizeDurationUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/µ|μ/g, "u");

    const map = {
        "h": "h",
        "hr": "h",
        "hrs": "h",
        "hour": "h",
        "hours": "h",

        "min": "min",
        "mins": "min",
        "minute": "min",
        "minutes": "min",

        "s": "s",
        "sec": "s",
        "secs": "s",
        "second": "s",
        "seconds": "s",

        "ms": "ms",
        "msec": "ms",
        "msecs": "ms",
        "millisecond": "ms",
        "milliseconds": "ms",

        "us": "µs",
        "usec": "µs",
        "usecs": "µs",
        "microsecond": "µs",
        "microseconds": "µs",

        "ns": "ns",
        "nsec": "ns",
        "nsecs": "ns",
        "nanosecond": "ns",
        "nanoseconds": "ns",

        "d": "d",
        "day": "d",
        "days": "d",

        "week": "week",
        "weeks": "week",
        "wk": "week",
        "wks": "week",
    };

    return map[compact] || null;
}


function normalizePressureStressUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/\./g, "")
        .replace(/µ|μ/g, "u")
        .replace(/pounds?/g, "lb")
        .replace(/force/g, "f")
        .replace(/lbs?/g, "lb")
        .replace(/sq(?:uare)?/g, "sq")
        .replace(/inches?|inch/g, "in")
        .replace(/per/g, "/");

    const map = {
        "psi": "psi",
        "psig": "psi",
        "psia": "psi",
        "psi(g)": "psi",
        "psi(a)": "psi",
        "ksi": "ksi",
        "kpsi": "ksi",
        "lb/in2": "lb/in²",
        "lb/in^2": "lb/in²",
        "lb/in²": "lb/in²",
        "lbf/in2": "lbf/in²",
        "lbf/in^2": "lbf/in²",
        "lbf/in²": "lbf/in²",
        "lb/sqin": "lb/in²",
        "lbf/sqin": "lbf/in²",
        "lbpersquarein": "lb/in²",
        "lbfpersquarein": "lbf/in²",
    };

    return map[compact] || null;
}



function normalizeExponentOnlyUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .replace(/\s+/g, "")
        .replace(/^e/i, "E");

    const match = compact.match(/^E([+-]?\d+)$/);
    if (!match) return null;

    const exp = Number(match[1]);
    if (!Number.isInteger(exp)) return null;

    return `E${exp > 0 ? `+${exp}` : exp}`;
}

function getExponentFromUnit(unit) {
    const normalized = normalizeExponentOnlyUnitAlias(unit);
    if (!normalized) return null;
    return Number(normalized.slice(1));
}

function normalizeScaledExponentValue(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;

    const precise = Number.parseFloat(n.toPrecision(15));
    return Object.is(precise, -0) ? 0 : precise;
}

function convertExponentOnlyUnit(value, fromUnit, toUnit) {
    const fromExp = getExponentFromUnit(fromUnit);
    const toExp = getExponentFromUnit(toUnit);

    if (fromExp === null || toExp === null) return null;

    const converted = value * Math.pow(10, fromExp - toExp);
    return Number.isFinite(converted) ? normalizeScaledExponentValue(converted) : null;
}


function normalizeElectricStrengthUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/µ|μ/g, "u")
        .replace(/volts?/g, "v")
        .replace(/kilovolts?/g, "kv")
        .replace(/megavolts?/g, "mv")
        .replace(/newtons?/g, "n")
        .replace(/coulombs?/g, "c")
        .replace(/meters?|metres?/g, "m")
        .replace(/centimeters?|centimetres?/g, "cm")
        .replace(/millimeters?|millimetres?/g, "mm")
        .replace(/micrometers?|micrometres?|microns?/g, "um")
        .replace(/inches?|inch/g, "in");

    const map = {
        "v/m": "V/m",
        "v/cm": "V/cm",
        "v/mm": "V/mm",
        "v/in": "V/in",

        "kv/m": "kV/m",
        "kv/cm": "kV/cm",
        "kv/mm": "kV/mm",
        "kv/in": "kV/in",

        "mv/m": "MV/m",
        "mv/cm": "MV/cm",
        "mv/mm": "MV/mm",
        "mv/in": "MV/in",

        "v/um": "V/µm",
        "kv/um": "kV/µm",
        "mv/um": "MV/µm",

        "n/c": "N/C",
    };

    return map[compact] || null;
}

function normalizeResistivityUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/µ|μ/g, "u")
        .replace(/omega/g, "ω")
        .replace(/ohms?/g, "ohm")
        .replace(/[·•⋅]/g, ".")
        .replace(/×/g, "*")
        .replace(/per/g, "/")
        .replace(/square/g, "sq");

    const map = {
        // Volume resistivity -> canonical Ohm*m
        "ohm*m": "Ohm*m",
        "ohm.m": "Ohm*m",
        "ohmm": "Ohm*m",
        "ω*m": "Ohm*m",
        "ω.m": "Ohm*m",
        "ωm": "Ohm*m",

        "ohm*cm": "ohm-cm",
        "ohm.cm": "ohm-cm",
        "ohmcm": "ohm-cm",
        "ω*cm": "Ω·cm",
        "ω.cm": "Ω·cm",
        "ωcm": "Ω·cm",

        // Surface resistivity / sheet-style aliases -> canonical Ohm
        "ohm": "Ohm",
        "ω": "Ohm",
        "ohm/sq": "Ohm",
        "ohm/square": "Ohm",
        "ohm/sqin": "Ohm",
        "ω/sq": "Ohm",
        "ω/square": "Ohm",
    };

    return map[compact] || null;
}


function normalizeBurningRateThicknessUnitAlias(unit) {
    if (!unit || typeof unit !== "string") return null;

    const compact = unit
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "")
        .replace(/µ|μ/g, "u")
        .replace(/\*/g, "/")
        .replace(/millimeters?|millimetres?/g, "mm")
        .replace(/centimeters?|centimetres?/g, "cm")
        .replace(/meters?|metres?/g, "m")
        .replace(/kilometers?|kilometres?/g, "km")
        .replace(/inches?|inch/g, "in")
        .replace(/feet|foot/g, "ft")
        .replace(/yards?/g, "yd")
        .replace(/mils?/g, "mil")
        .replace(/micrometers?|micrometres?|microns?/g, "um")
        .replace(/nanometers?|nanometres?/g, "nm");

    const map = {
        "mm/mm": "mm/mm",
        "cm/mm": "cm/mm",
        "m/mm": "m/mm",
        "km/mm": "km/mm",

        "in/mm": "in/mm",
        "ft/mm": "ft/mm",
        "yd/mm": "yd/mm",

        "mil/mm": "mil/mm",
        "um/mm": "µm/mm",
        "nm/mm": "nm/mm",

        "in/in": "in/in",
        "ft/in": "ft/in",
        "yd/in": "yd/in",

        "mm/in": "mm/in",
        "cm/in": "cm/in",
        "m/in": "m/in",
        "mil/in": "mil/in",
        "um/in": "µm/in",

        "mm/cm": "mm/cm",
        "cm/cm": "cm/cm",
        "m/cm": "m/cm",
        "in/cm": "in/cm",
        "ft/cm": "ft/cm",

        "mm/m": "mm/m",
        "cm/m": "cm/m",
        "m/m": "m/m",
        "km/m": "km/m",
        "in/m": "in/m",
        "ft/m": "ft/m",
        "yd/m": "yd/m",
    };

    return map[compact] || null;
}


/**
 * Normalizes unit string for conversion lookup
 * Handles case, spacing, and symbol variations
 * This should match the normalization done in sanitizeJson.js
 * 
 * @param {string} unit - The unit string to normalize
 * @returns {string} - Normalized unit string
 */
export function normalizeUnitForConversion(unit) {
    if (!unit || typeof unit !== 'string') return unit;

    // let normalized = unit.trim();
    let normalized = normalizeConfusablePunctuation(unit.trim());

    // Collapse spaces
    normalized = normalized.replace(/\s+/g, " ");

    normalized = normalized.replace(/%\s*ISO/gi, "% ISO");

    const burningRateAlias = normalizeBurningRateThicknessUnitAlias(normalized);
    if (burningRateAlias) return burningRateAlias;

    const resistivityAlias = normalizeResistivityUnitAlias(normalized);
    if (resistivityAlias) return resistivityAlias;

    const electricStrengthAlias = normalizeElectricStrengthUnitAlias(normalized);
    if (electricStrengthAlias) return electricStrengthAlias;

    const pressureStressAlias = normalizePressureStressUnitAlias(normalized);
    if (pressureStressAlias) return pressureStressAlias;

    const exponentAlias = normalizeExponentOnlyUnitAlias(normalized);
    if (exponentAlias) return exponentAlias;

    const densityAlias = normalizeDensityUnitAlias(normalized);
    if (densityAlias) return densityAlias;

    const specificHeatAlias = normalizeSpecificHeatCapacityUnitAlias(normalized);
    if (specificHeatAlias) return specificHeatAlias;

    const thermalConductivityAlias = normalizeThermalConductivityUnitAlias(normalized);
    if (thermalConductivityAlias) return thermalConductivityAlias;

    const durationAlias = normalizeDurationUnitAlias(normalized);
    if (durationAlias) return durationAlias;

    // Normalize superscript notation
    normalized = normalized.replace(/\^3/g, "³");
    normalized = normalized.replace(/\^2/g, "²");

    // Temperature normalization
    // Celsius variations -> "°C"
    normalized = normalized.replace(/°\s*C/gi, "°C");
    normalized = normalized.replace(/deg\s*C/gi, "°C");
    normalized = normalized.replace(/^C(?=\s|$)/i, "°C");
    normalized = normalized.replace(/celsius(?=\s|$)/gi, "°C");
    normalized = normalized.replace(/centigrade(?=\s|$)/gi, "°C");

    // Fahrenheit variations -> "°F" (for conversion detection)
    normalized = normalized.replace(/°\s*F/gi, "°F");
    normalized = normalized.replace(/deg\s*F/gi, "°F");
    normalized = normalized.replace(/^F(?=\s|$)/i, "°F");
    normalized = normalized.replace(/fahrenheit(?=\s|$)/gi, "°F");

    // Kelvin variations -> "K"
    normalized = normalized.replace(/^K(?=\s|$)/i, "K");
    normalized = normalized.replace(/kelvin(?=\s|$)/gi, "K");

    // CTE (Coefficient of Linear Thermal Expansion) normalization -> "1/K"
    // IMPORTANT: Handle E notation FIRST before other CTE normalizations to preserve exponent in unit
    // Handle E notation variations (E-4, E−4, etc.) - keep exponent in unit
    normalized = normalized.replace(/E\s*[-−]\s*(\d+)\s*\/\s*°C/gi, "E-$1/°C");
    normalized = normalized.replace(/E\s*[-−]\s*(\d+)\s*\/\s*K(?=\s|$)/gi, "E-$1/K");
    normalized = normalized.replace(/E\s*[-−]\s*(\d+)\s*\/\s*°F/gi, "E-$1/°F");
    normalized = normalized.replace(/E\s*[+]\s*(\d+)\s*\/\s*°C/gi, "E+$1/°C");
    normalized = normalized.replace(/E\s*[+]\s*(\d+)\s*\/\s*K(?=\s|$)/gi, "E+$1/K");
    normalized = normalized.replace(/E\s*[+]\s*(\d+)\s*\/\s*°F/gi, "E+$1/°F");

    // Handle per-°C variations (only if not already part of E notation unit)
    if (!normalized.match(/^E[-+]\d+\/°C/i)) {
        normalized = normalized.replace(/1\s*\/\s*°C/gi, "1/°C");
        normalized = normalized.replace(/\/\s*°C(?=\s|$)/gi, "/°C");
    }
    normalized = normalized.replace(/°C\s*\^\s*[-]?1/gi, "°C^-1");
    normalized = normalized.replace(/°C\s*⁻¹/gi, "°C⁻¹");

    // Handle per-K variations (only if not already part of E notation unit)
    if (!normalized.match(/^E[-+]\d+\/K/i)) {
        normalized = normalized.replace(/1\s*\/\s*K(?=\s|$)/gi, "1/K");
        normalized = normalized.replace(/\/\s*K(?=\s|$)/gi, "/K");
    }
    normalized = normalized.replace(/K\s*\^\s*[-]?1(?=\s|$)/gi, "K^-1");
    normalized = normalized.replace(/K\s*⁻¹(?=\s|$)/gi, "K⁻¹");

    // Handle per-°F variations (only if not already part of E notation unit)
    if (!normalized.match(/^E[-+]\d+\/°F/i)) {
        normalized = normalized.replace(/1\s*\/\s*°F/gi, "1/°F");
        normalized = normalized.replace(/\/\s*°F(?=\s|$)/gi, "/°F");
    }
    normalized = normalized.replace(/°F\s*\^\s*[-]?1/gi, "°F^-1");

    // Handle ppm variations
    normalized = normalized.replace(/ppm\s*\/\s*°C/gi, "ppm/°C");
    normalized = normalized.replace(/ppm\s*\/\s*K(?=\s|$)/gi, "ppm/K");
    normalized = normalized.replace(/ppm\s*\/\s*°F/gi, "ppm/°F");

    // Handle µm/m variations
    normalized = normalized.replace(/µm\s*\/\s*m\s*[··]\s*°C/gi, "µm/m·°C");
    normalized = normalized.replace(/µm\s*\/\s*m\s*[·×*]\s*°C/gi, "µm/m·°C");
    normalized = normalized.replace(/\(µm\s*\/\s*m\)\s*\/\s*°C/gi, "(µm/m)/°C");
    normalized = normalized.replace(/µm\s*\/\s*m\s*[··]\s*K(?=\s|$)/gi, "µm/m·K");
    normalized = normalized.replace(/µm\s*\/\s*m\s*[·×*]\s*K(?=\s|$)/gi, "µm/m·K");

    // Handle ×10^-6 or x10^-6 variations
    normalized = normalized.replace(/×\s*10\s*\^\s*[-]?\s*6\s*\/\s*°C/gi, "×10^-6/°C");
    normalized = normalized.replace(/x\s*10\s*\^\s*[-]?\s*6\s*\/\s*°C/gi, "x10^-6/°C");
    normalized = normalized.replace(/×\s*10\s*\^\s*[-]?\s*6\s*\/\s*K(?=\s|$)/gi, "×10^-6/K");
    normalized = normalized.replace(/x\s*10\s*\^\s*[-]?\s*6\s*\/\s*K(?=\s|$)/gi, "x10^-6/K");
    normalized = normalized.replace(/×\s*10\s*\^\s*[-]?\s*6\s*\/\s*°F/gi, "×10^-6/°F");
    normalized = normalized.replace(/x\s*10\s*\^\s*[-]?\s*6\s*\/\s*°F/gi, "x10^-6/°F");

    // Pressure/stress casing (incl. inside longer strings; keep only unit token)
    normalized = normalized.replace(/\bmpa\b/gi, "MPa");
    normalized = normalized.replace(/\bgpa\b/gi, "GPa");
    normalized = normalized.replace(/\bkpa\b/gi, "kPa");
    normalized = normalized.replace(/\bpa\b/g, "Pa");

    // Density
    normalized = normalized.replace(/kg\s*\/\s*m[³3]/gi, "kg/m³");
    normalized = normalized.replace(/g\s*\/\s*cm³/gi, "g/cm³");
    // Keep g/cm3 recognized (do not force-convert away; conversion table supports both)
    normalized = normalized.replace(/g\s*\/\s*cm3/gi, "g/cm3");

    // MVR formatting -> canonical "cm³/10min"
    normalized = normalized.replace(/cm3\s*\/\s*10\s*min/gi, "cm³/10min");
    normalized = normalized.replace(/cm³\s*\/\s*10\s*min/gi, "cm³/10min");
    normalized = normalized.replace(/cm3\s*\/\s*10min/gi, "cm³/10min");
    normalized = normalized.replace(/cm³\s*\/\s*10min/gi, "cm³/10min");

    // Mass-flow aliases (for detection only; do not provide cross-type conversions)
    normalized = normalized.replace(/g\s*\/\s*10\s*min/gi, "g/10 min");
    normalized = normalized.replace(/g\s*\/\s*10min/gi, "g/10 min");

    // Resistivity canonicalization
    // - Surface resistivity: "Ω" / "ohm" -> "Ohm"
    normalized = normalized.replace(/^Ω$/g, "Ohm");
    normalized = normalized.replace(/^ohms?$/i, "Ohm");

    // - Volume resistivity: meter-based -> "Ohm*m"
    // Accept: Ω·m, Ω m, Ω*m, ohm*m, ohms*m, Ohm*m
    normalized = normalized.replace(/ohms?\s*\*\s*m(?=\s|$)/gi, "Ohm*m");
    normalized = normalized.replace(/ohms?\s*·\s*m(?=\s|$)/gi, "Ohm*m");
    normalized = normalized.replace(/Ω\s*\*\s*m(?=\s|$)/gi, "Ohm*m");
    normalized = normalized.replace(/Ω\s*·\s*m(?=\s|$)/gi, "Ohm*m");
    normalized = normalized.replace(/Ω\s+m(?=\s|$)/gi, "Ohm*m");

    //! adding 
    // Accept hyphen form too: "ohm-m", "ohms-m", "Ω-m"
    normalized = normalized.replace(/ohms?\s*-\s*m(?=\s|$)/gi, "Ohm*m");
    normalized = normalized.replace(/Ω\s*-\s*m(?=\s|$)/gi, "Ohm*m");

    // - Centimeter-based intermediate form allowed: "Ω·cm"
    // Accept: Ω·cm, Ω cm, Ω x cm, ohm-cm, ohms·cm, Ω×cm
    normalized = normalized.replace(/ohms?\s*[-·]\s*cm/gi, "Ω·cm");
    normalized = normalized.replace(/Ω\s*(x|×)\s*cm/gi, "Ω·cm");
    normalized = normalized.replace(/Ω\s+cm/gi, "Ω·cm");

    // Impact strength normalization -> canonical "kJ/m²"
    // Note: ^2 should already be normalized to ² by earlier code, but handle both for safety

    // Normalize ft·lbf/in² variations first (most specific patterns)
    // Patterns: ft·lbf/in², ft-lbf/in², ft·lb/in², ft-lb/in², ftlbf/in²
    normalized = normalized.replace(/ft\s*[·\-]?\s*lbf\s*\/\s*in\s*²/gi, "ft·lbf/in²");
    normalized = normalized.replace(/ft\s*[·\-]?\s*lbf\s*\/\s*in\s*2/gi, "ft·lbf/in²");
    normalized = normalized.replace(/ft\s*[·\-]?\s*lbf\s*\/\s*in\s*\^?\s*2/gi, "ft·lbf/in²");
    normalized = normalized.replace(/ftlbf\s*\/\s*in\s*²/gi, "ft·lbf/in²");
    normalized = normalized.replace(/ftlbf\s*\/\s*in\s*2/gi, "ft·lbf/in²");
    normalized = normalized.replace(/ftlbf\s*\/\s*in\s*\^?\s*2/gi, "ft·lbf/in²");
    // Also handle ft·lb (without 'f') variations
    normalized = normalized.replace(/ft\s*[·\-]?\s*lb\s*\/\s*in\s*²/gi, "ft·lb/in²");
    normalized = normalized.replace(/ft\s*[·\-]?\s*lb\s*\/\s*in\s*2/gi, "ft·lb/in²");
    normalized = normalized.replace(/ft\s*[·\-]?\s*lb\s*\/\s*in\s*\^?\s*2/gi, "ft·lb/in²");
    normalized = normalized.replace(/ftlb\s*\/\s*in\s*²/gi, "ft·lb/in²");
    normalized = normalized.replace(/ftlb\s*\/\s*in\s*2/gi, "ft·lb/in²");
    normalized = normalized.replace(/ftlb\s*\/\s*in\s*\^?\s*2/gi, "ft·lb/in²");

    // Normalize kJ/cm² variations (case-insensitive)
    normalized = normalized.replace(/kj\s*\/\s*cm\s*²/gi, "kJ/cm²");
    normalized = normalized.replace(/kj\s*\/\s*cm\s*2/gi, "kJ/cm²");
    normalized = normalized.replace(/kj\s*\/\s*cm\s*\^?\s*2/gi, "kJ/cm²");

    // Normalize J/cm² variations (case-insensitive)
    normalized = normalized.replace(/j\s*\/\s*cm\s*²(?=\s|$)/gi, "J/cm²");
    normalized = normalized.replace(/j\s*\/\s*cm\s*2(?=\s|$)/gi, "J/cm²");
    normalized = normalized.replace(/j\s*\/\s*cm\s*\^?\s*2(?=\s|$)/gi, "J/cm²");

    // Normalize kJ/m² variations (case-insensitive)
    normalized = normalized.replace(/kj\s*\/\s*m\s*²/gi, "kJ/m²");
    normalized = normalized.replace(/kj\s*\/\s*m\s*2/gi, "kJ/m²");
    normalized = normalized.replace(/kj\s*\/\s*m\s*\^?\s*2/gi, "kJ/m²");

    // Normalize J/m² variations (case-insensitive)
    normalized = normalized.replace(/j\s*\/\s*m\s*²(?=\s|$)/gi, "J/m²");
    normalized = normalized.replace(/j\s*\/\s*m\s*2(?=\s|$)/gi, "J/m²");
    normalized = normalized.replace(/j\s*\/\s*m\s*\^?\s*2(?=\s|$)/gi, "J/m²");
    normalized = normalized.replace(/j\s*\/\s*m\s*square(?=\s|$)/gi, "J/m²");

    // Final cleanup
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
}

/**
 * Canonicalizes all value objects in a JSON tree by field path.
 * - Only applies where a canonical unit is defined for the field path.
 * - STRICT: if unit exists but cannot be converted into the canonical unit, value/unit become null.
 */

//! i have changed this manually to remove strict mode !
// export function canonicalizeUnitsByFieldPath(node, optionsOrCurrentPath = "", maybeCurrentPath = "") {
//     // Backward-compatible signature:
//     // - canonicalizeUnitsByFieldPath(node, currentPath)
//     // - canonicalizeUnitsByFieldPath(node, { strict: true }, currentPath)
//     const options = (optionsOrCurrentPath && typeof optionsOrCurrentPath === "object" && !Array.isArray(optionsOrCurrentPath))
//         ? optionsOrCurrentPath
//         : null;
//     const currentPath = options ? (maybeCurrentPath || "") : (optionsOrCurrentPath || "");
//     // Current implementation is STRICT by default; keep behavior even if options.strict is omitted/false.
//     if (node === null || node === undefined) return node;
//     if (Array.isArray(node)) {
//         return node.map((x, idx) => canonicalizeUnitsByFieldPath(x, `${currentPath}[${idx}]`));
//     }
//     if (typeof node !== "object") return node;

//     // Value object: apply canonicalization using the dot path (ignore array indices)
//     if ("value" in node) {
//         // Strip any array indexing from paths for canonical unit lookup
//         const fieldPath = currentPath.replace(/\[\d+\]/g, "");
//         return normalizeValueObjectUnits(node, fieldPath);
//     }

//     const out = {};
//     for (const key of Object.keys(node)) {
//         const childPath = currentPath ? `${currentPath}.${key}` : key;
//         out[key] = options ? canonicalizeUnitsByFieldPath(node[key], options, childPath) : canonicalizeUnitsByFieldPath(node[key], childPath);
//     }
//     return out;
// }

export function canonicalizeUnitsByFieldPath(node, optionsOrCurrentPath = "", maybeCurrentPath = "") {
    // Backward-compatible signature:
    // - canonicalizeUnitsByFieldPath(node, currentPath)
    // - canonicalizeUnitsByFieldPath(node, { strict: true }, currentPath)
    const options = (optionsOrCurrentPath && typeof optionsOrCurrentPath === "object" && !Array.isArray(optionsOrCurrentPath))
        ? optionsOrCurrentPath
        : null;
    const currentPath = options ? (maybeCurrentPath || "") : (optionsOrCurrentPath || "");
    const isStrict = options?.strict !== false; // Default to true if not specified
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) {
        return node.map((x, idx) => canonicalizeUnitsByFieldPath(x, options, `${currentPath}[${idx}]`));
    }
    if (typeof node !== "object") return node;

    // Value object: apply canonicalization using the dot path (ignore array indices)
    if ("value" in node) {
        // Strip any array indexing from paths for canonical unit lookup
        const fieldPath = currentPath.replace(/\[\d+\]/g, "");
        return normalizeValueObjectUnits(node, fieldPath, isStrict);
    }

    const out = {};
    for (const key of Object.keys(node)) {
        const childPath = currentPath ? `${currentPath}.${key}` : key;
        out[key] = options ? canonicalizeUnitsByFieldPath(node[key], options, childPath) : canonicalizeUnitsByFieldPath(node[key], childPath);
    }
    return out;
}

/**
 * Collects remaining mismatches where a canonical unit exists but unit != canonical.
 */
export function collectCanonicalUnitMismatches(node, currentPath = "") {
    const mismatches = [];

    function visit(n, p) {
        if (n === null || n === undefined) return;
        if (Array.isArray(n)) {
            n.forEach((x, idx) => visit(x, `${p}[${idx}]`));
            return;
        }
        if (typeof n !== "object") return;

        if ("value" in n && "unit" in n) {
            const fieldPath = p.replace(/\[\d+\]/g, "");
            const canonical = getCanonicalUnit(fieldPath);
            const unit = n.unit;
            if (canonical && typeof unit === "string" && unit && unit !== canonical) {
                mismatches.push({ path: fieldPath, unit, canonical });
            }
            return;
        }

        for (const k of Object.keys(n)) {
            const childPath = p ? `${p}.${k}` : k;
            visit(n[k], childPath);
        }
    }

    visit(node, currentPath);
    return mismatches;
}

/**
 * Parses a numeric value that may be in scientific notation
 * Handles: "5.0E+2", "2E9", "1.5e-3", etc.
 * 
 * @param {string|number} value - The value to parse
 * @returns {number|null} - Parsed number, or null if not parseable
 */
export function parseNumericValue(value) {
    // Backward-compatible wrapper used by existing code paths.
    return parseNumericExpression(value);
}

/**
 * Checks if a value string represents a range
 * Examples: "5.0E+2 to 2.5E+13", "0.4 - 0.6"
 * 
 * @param {string} value - The value string to check
 * @returns {boolean} - True if it's a range
 */
export function isRangeValue(value) {
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();
    const rangePatterns = [
        /\s+to\s+/i,
        /\s+-\s+/,
        /\s+–\s+/,
        /\s+—\s+/,
        /\s+\.\.\.\s+/,
    ];

    return rangePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Checks if a value string represents an inequality
 * Examples: "> 1", "< 0.1", "≥ 5", "≤ 10", "> 2 * 10¹¹"
 * 
 * @param {string} value - The value string to check
 * @returns {boolean} - True if it's an inequality
 */
export function isInequalityValue(value) {
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();
    const inequalityPatterns = [
        /^[><≥≤]/,
        /^>=/,
        /^<=/,
    ];

    return inequalityPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Parses a range string into a structured object
 * Example: "5.0E+2 to 2.5E+13" -> { min: 500, max: 25000000000000 }
 * 
 * @param {string} rangeStr - The range string
 * @returns {Object|null} - { min, max } object, or null if not parseable
 */
export function parseRange(rangeStr) {
    if (typeof rangeStr !== 'string') return null;

    const trimmed = rangeStr.trim();

    // Try different range separators
    let parts = [];
    if (/\s+to\s+/i.test(trimmed)) {
        parts = trimmed.split(/\s+to\s+/i);
    } else if (/\s+-\s+/.test(trimmed)) {
        parts = trimmed.split(/\s+-\s+/);
    } else if (/\s+–\s+/.test(trimmed)) {
        parts = trimmed.split(/\s+–\s+/);
    } else if (/\s+—\s+/.test(trimmed)) {
        parts = trimmed.split(/\s+—\s+/);
    } else {
        return null;
    }

    if (parts.length !== 2) return null;

    const min = parseNumericExpression(parts[0].trim().replace(',', '.'));
    const max = parseNumericExpression(parts[1].trim().replace(',', '.'));

    if (min === null || max === null) return null;

    return { min, max };
}

/**
 * Converts a range value to canonical units
 * 
 * @param {Object} range - { min, max } object
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target canonical unit
 * @returns {Object|null} - Converted range, or null if conversion fails
 */
export function convertRange(range, fromUnit, toUnit) {
    if (!range || typeof range !== 'object' || !('min' in range) || !('max' in range)) {
        return null;
    }

    const convertedMin = convertUnit(range.min, fromUnit, toUnit);
    const convertedMax = convertUnit(range.max, fromUnit, toUnit);

    if (convertedMin === null || convertedMax === null) {
        return null;
    }

    return { min: convertedMin, max: convertedMax };
}

/**
 * Normalizes and converts a value object to canonical units
 * 
 * @param {Object} valueObj - The value object { value, unit, ... }
 * @param {string} fieldPath - The field path for canonical unit lookup
 * @returns {Object} - Normalized value object with original values preserved
 */

//! changed this manually for removing strict mode !
// export function normalizeValueObjectUnits(valueObj, fieldPath) {
//     if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) {
//         return valueObj;
//     }

//     // Schema safety: if this value object doesn't have a `unit` key, do NOT add one.
//     // This prevents schema mutation for non-measurement fields (e.g. {value: "..."}).
//     if (!('unit' in valueObj)) {
//         return valueObj;
//     }

//     // If value is null/empty => unit must be null (but do not add/remove other keys)
//     if (valueObj.value === null || valueObj.value === '' || (typeof valueObj.value === 'string' && valueObj.value.trim() === '')) {
//         return { ...valueObj, value: null, unit: null };
//     }

//     const canonicalUnit = getCanonicalUnit(fieldPath);
//     if (!canonicalUnit) {
//         return valueObj;
//     }

//     const result = { ...valueObj };

//     // If unit is missing, we cannot convert. Keep as-is (schema-safe).
//     const currentUnit = result.unit;
//     if (!currentUnit || typeof currentUnit !== 'string') return result;

//     // Normalize unit string first
//     const normalizedCurrentUnit = normalizeUnitForConversion(currentUnit);
//     const normalizedCanonical = normalizeUnitForConversion(canonicalUnit);

//     // If already canonical (after normalization), set unit to canonical spelling.
//     if (normalizedCurrentUnit === normalizedCanonical) {
//         result.unit = canonicalUnit;
//         return result;
//     }

//     // Convert based on value type, but ALWAYS keep value scalar (no objects).
//     const v = result.value;

//     // Helper: apply factor and format for output (number stays number, strings stay string).
//     const applyConversionNumber = (num) => {
//         const converted = convertUnit(num, normalizedCurrentUnit, canonicalUnit);
//         return converted === null ? null : converted;
//     };

//     if (typeof v === "number") {
//         const converted = applyConversionNumber(v);
//         if (converted !== null) {
//             result.value = converted;
//             result.unit = canonicalUnit;
//             return result;
//         }
//         // STRICT: incompatible/unknown unit for this field -> null value/unit
//         return { ...result, value: null, unit: null };
//     }

//     if (typeof v === "string") {
//         // Operator string: "> 2E11"
//         const op = parseOperatorString(v);
//         if (op) {
//             const parsed = parseNumericExpression(op.rhs);
//             if (parsed !== null) {
//                 const converted = applyConversionNumber(parsed);
//                 if (converted !== null) {
//                     result.value = `${op.operator} ${formatScalarForString(converted)}`;
//                     result.unit = canonicalUnit;
//                     return result;
//                 }
//             }
//             // STRICT: incompatible/unknown unit for this field -> null value/unit
//             return { ...result, value: null, unit: null };
//         }

//         // Range string: "0.4 - 0.6"
//         const r = parseRangeString(v);
//         if (r) {
//             const a = parseNumericExpression(r.a);
//             const b = parseNumericExpression(r.b);
//             if (a !== null && b !== null) {
//                 const ca = applyConversionNumber(a);
//                 const cb = applyConversionNumber(b);
//                 if (ca !== null && cb !== null) {
//                     result.value = `${formatScalarForString(ca)} - ${formatScalarForString(cb)}`;
//                     result.unit = canonicalUnit;
//                     return result;
//                 }
//             }
//             // STRICT: incompatible/unknown unit for this field -> null value/unit
//             return { ...result, value: null, unit: null };
//         }

//         // Pure numeric scientific string: keep string but convert and canonicalize.
//         const parsed = parseNumericExpression(v);
//         if (parsed !== null) {
//             const converted = applyConversionNumber(parsed);
//             if (converted !== null) {
//                 // Preserve string-ness if input was string.
//                 result.value = v.toLowerCase().includes("e") ? formatExponentString(converted) : String(converted);
//                 result.unit = canonicalUnit;
//                 return result;
//             }
//         }
//         // STRICT: incompatible/unknown unit for this field -> null value/unit
//         return { ...result, value: null, unit: null };
//     }

//     // Any other non-scalar (shouldn't happen) – leave untouched to avoid schema mutation.
//     if (isPlainObject(v) || Array.isArray(v)) return result;

//     return result;
// }

//! changed this
// export function normalizeValueObjectUnits(valueObj, fieldPath, isStrict = true) {
//     if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) {
//         return valueObj;
//     }

//     // Schema safety: if this value object doesn't have a `unit` key, do NOT add one.
//     // This prevents schema mutation for non-measurement fields (e.g. {value: "..."}).
//     if (!('unit' in valueObj)) {
//         return valueObj;
//     }

//     // If value is null/empty => unit must be null (but do not add/remove other keys)
//     if (valueObj.value === null || valueObj.value === '' || (typeof valueObj.value === 'string' && valueObj.value.trim() === '')) {
//         return { ...valueObj, value: null, unit: null };
//     }

//     const canonicalUnit = getCanonicalUnit(fieldPath);
//     if (!canonicalUnit) {
//         return valueObj;
//     }

//     const result = { ...valueObj };

//     // If unit is missing, we cannot convert. Keep as-is (schema-safe).
//     const currentUnit = result.unit;
//     if (!currentUnit || typeof currentUnit !== 'string') return result;

//     // Normalize unit string first
//     const normalizedCurrentUnit = normalizeUnitForConversion(currentUnit);
//     const normalizedCanonical = normalizeUnitForConversion(canonicalUnit);

//     // If already canonical (after normalization), set unit to canonical spelling.
//     if (normalizedCurrentUnit === normalizedCanonical) {
//         result.unit = canonicalUnit;
//         return result;
//     }

//     // Convert based on value type, but ALWAYS keep value scalar (no objects).
//     const v = result.value;

//     // Helper: apply factor and format for output (number stays number, strings stay string).
//     const applyConversionNumber = (num) => {
//         const converted = convertUnit(num, normalizedCurrentUnit, canonicalUnit);
//         return converted === null ? null : converted;
//     };

//     if (typeof v === "number") {
//         const converted = applyConversionNumber(v);
//         if (converted !== null) {
//             result.value = converted;
//             result.unit = canonicalUnit;
//             return result;
//         }
//         // STRICT: incompatible/unknown unit for this field -> null value/unit
//         // NON-STRICT: preserve original value/unit when conversion fails
//         return isStrict ? { ...result, value: null, unit: null } : result;
//     }

//     if (typeof v === "string") {
//         // Operator string: "> 2E11"
//         const op = parseOperatorString(v);
//         if (op) {
//             const parsed = parseNumericExpression(op.rhs);
//             if (parsed !== null) {
//                 const converted = applyConversionNumber(parsed);
//                 if (converted !== null) {
//                     result.value = `${op.operator} ${formatScalarForString(converted)}`;
//                     result.unit = canonicalUnit;
//                     return result;
//                 }
//             }
//             // STRICT: incompatible/unknown unit for this field -> null value/unit
//             // NON-STRICT: preserve original value/unit when conversion fails
//             return isStrict ? { ...result, value: null, unit: null } : result;
//         }

//         // Range string: "0.4 - 0.6"
//         const r = parseRangeString(v);
//         if (r) {
//             const a = parseNumericExpression(r.a);
//             const b = parseNumericExpression(r.b);
//             if (a !== null && b !== null) {
//                 const ca = applyConversionNumber(a);
//                 const cb = applyConversionNumber(b);
//                 if (ca !== null && cb !== null) {
//                     result.value = `${formatScalarForString(ca)} - ${formatScalarForString(cb)}`;
//                     result.unit = canonicalUnit;
//                     return result;
//                 }
//             }
//             // STRICT: incompatible/unknown unit for this field -> null value/unit
//             // NON-STRICT: preserve original value/unit when conversion fails
//             return isStrict ? { ...result, value: null, unit: null } : result;
//         }

//         // Pure numeric scientific string: keep string but convert and canonicalize.
//         const parsed = parseNumericExpression(v);
//         if (parsed !== null) {
//             const converted = applyConversionNumber(parsed);
//             if (converted !== null) {
//                 // Preserve string-ness if input was string.
//                 result.value = v.toLowerCase().includes("e") ? formatExponentString(converted) : String(converted);
//                 result.unit = canonicalUnit;
//                 return result;
//             }
//         }
//         // STRICT: incompatible/unknown unit for this field -> null value/unit
//         // NON-STRICT: preserve original value/unit when conversion fails
//         return isStrict ? { ...result, value: null, unit: null } : result;
//     }

//     // Any other non-scalar (shouldn't happen) – leave untouched to avoid schema mutation.
//     if (isPlainObject(v) || Array.isArray(v)) return result;

//     return result;
// }

//! floorTo2
// function floorTo2(n) {
//     return Math.floor(n * 100) / 100;
// }

function floorTo2(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return n;

    // Normalize floating-point noise first so values like
    // 0.8999999999999999 become 0.9 before flooring.
    const normalized = Number.parseFloat(n.toPrecision(15));

    return Math.floor(normalized * 100) / 100;
}

function isInvalidScalarMarker(v) {
    return v === null ||
        v === undefined ||
        (typeof v === "string" && ["", "-", "*"].includes(v.trim()));
}

function normalizeExponentOnlyValueObject(result, currentUnit, canonicalUnit, isStrict = true) {
    if (isInvalidScalarMarker(result.value)) {
        return { ...result, value: null, unit: null };
    }

    const rawUnit = typeof currentUnit === "string" ? currentUnit.trim() : "";
    const unitMissing = rawUnit === "" || rawUnit === "-" || rawUnit === "*";

    const fromUnit = unitMissing ? "E0" : normalizeUnitForConversion(rawUnit);

    if (!unitMissing && getExponentFromUnit(fromUnit) === null) {
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    const convertOne = (num) => convertExponentOnlyUnit(num, fromUnit, canonicalUnit);

    if (typeof result.value === "number") {
        const converted = convertOne(result.value);
        if (converted === null) {
            return isStrict ? { ...result, value: null, unit: null } : result;
        }
        return { ...result, value: converted, unit: canonicalUnit };
    }

    if (typeof result.value === "string") {
        const parsed = parseNumericExpression(result.value);
        if (parsed !== null) {
            const converted = convertOne(parsed);
            if (converted === null) {
                return isStrict ? { ...result, value: null, unit: null } : result;
            }
            return { ...result, value: converted, unit: canonicalUnit };
        }

        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    return isStrict ? { ...result, value: null, unit: null } : result;
}


export function normalizeValueObjectUnits(valueObj, fieldPath, isStrict = true) {
    if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) return valueObj;
    if (!('unit' in valueObj)) return valueObj;

    if (
        valueObj.value === null ||
        valueObj.value === '' ||
        (typeof valueObj.value === 'string' && valueObj.value.trim() === '')
    ) {
        return { ...valueObj, value: null, unit: null };
    }

    const canonicalUnit = getCanonicalUnit(fieldPath);
    if (!canonicalUnit) return valueObj;

    const result = { ...valueObj };
    let currentUnit = result.unit;

    const isExponentOnlyField = canonicalUnit === "E-4";

    if (isExponentOnlyField) {
        return normalizeExponentOnlyValueObject(result, currentUnit, canonicalUnit, isStrict);
    }

    // For CTE fields, if unit is missing, try to extract from value string
    const isCTEField = canonicalUnit === "E-4/K" || canonicalUnit === "1/K";
    // if (isCTEField && (!currentUnit || typeof currentUnit !== 'string' || currentUnit.trim() === '')) {
    //     if (typeof result.value === 'string') {
    //         // Try to extract unit from value string (this should have been done in sanitizeJson, but handle it here as fallback)
    //         const valueStr = result.value.trim();
    //         // Look for unit patterns in the value string
    //         if (valueStr.includes('/K') || valueStr.includes('/°C') || valueStr.includes('/°F') ||
    //             valueStr.includes('ppm') || valueStr.includes('µm/m') || valueStr.includes('x10') || valueStr.includes('×10')) {
    //             // Unit is embedded in value - this should have been extracted earlier, but if not, preserve value
    //             // and set unit to canonical unit as fallback
    //             result.unit = canonicalUnit;
    //             return result;
    //         }
    //     }
    //     // If we can't extract unit and it's a CTE field, set unit to canonical and preserve value
    //     if (isCTEField) {
    //         result.unit = canonicalUnit;
    //         return result;
    //     }
    // }
    if (isCTEField && (!currentUnit || typeof currentUnit !== 'string' || currentUnit.trim() === '')) {
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    if (!currentUnit || typeof currentUnit !== 'string') return result;

    const normalizedCurrentUnit = normalizeUnitForConversion(currentUnit);
    const normalizedCanonical = normalizeUnitForConversion(canonicalUnit);

    const isMVR = fieldPath === "rheological.melt_volume_flow_rate_mvr";
    const isMassFlowUnit =
        normalizedCurrentUnit === "g/10 min" ||
        normalizedCurrentUnit === "g/10min" ||
        normalizedCurrentUnit === "dg/min" ||
        normalizedCurrentUnit === "g/min";

    // For CTE fields, check if unit already matches canonical (E-4/K format)
    if (isCTEField) {
        // Check if it's already in canonical format (E-4/K)
        if (normalizedCurrentUnit === normalizedCanonical ||
            normalizedCurrentUnit.match(/^E-4\/K$/i)) {
            result.unit = canonicalUnit; // Always "E-4/K"
            return result;
        }
        // If it's in 1/K format, we still need to convert to E-4/K
        // (don't return early, let conversion happen)
    } else {
        if (normalizedCurrentUnit === normalizedCanonical) {
            result.unit = canonicalUnit;
            return result;
        }
    }

    const v = result.value;
    const applyConversionNumber = (num) => {
        const converted = convertUnit(num, normalizedCurrentUnit, canonicalUnit);
        if (converted === null) return null;
        // CTE conversion returns {value, unit} object, others return number
        if (typeof converted === 'object' && 'value' in converted && 'unit' in converted) {
            return converted;
        }
        return converted;
    };

    // Numbers
    if (typeof v === "number") {
        const converted = applyConversionNumber(v);
        if (converted !== null) {
            // Handle CTE conversion which returns {value, unit}
            if (typeof converted === 'object' && 'value' in converted && 'unit' in converted) {
                result.value = converted.value;
                result.unit = converted.unit;
            } else {
                result.value = floorTo2(converted);
                result.unit = canonicalUnit;
            }
            return result;
        }
        if (isMVR && isMassFlowUnit) {
            result.unit = normalizedCurrentUnit === "g/10min" ? "g/10 min" : normalizedCurrentUnit;
            return result;
        }
        // For CTE fields, preserve value and set unit to canonical even if conversion fails
        // if (isCTEField) {
        //     result.unit = canonicalUnit;
        //     return result;
        // }
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    // Operator strings
    const op = typeof v === "string" ? parseOperatorString(v) : null;
    if (op) {
        const parsed = parseNumericExpression(op.rhs);
        if (parsed !== null) {
            const converted = applyConversionNumber(parsed);
            if (converted !== null) {
                // Handle CTE conversion which returns {value, unit}
                if (typeof converted === 'object' && 'value' in converted && 'unit' in converted) {
                    result.value = `${op.operator} ${formatScalarForString(converted.value)}`;
                    result.unit = converted.unit;
                } else {
                    result.value = `${op.operator} ${formatScalarForString(converted)}`;
                    result.unit = canonicalUnit;
                }
                return result;
            }
        }
        if (isMVR && isMassFlowUnit) {
            result.unit = normalizedCurrentUnit === "g/10min" ? "g/10 min" : normalizedCurrentUnit;
            return result;
        }
        // For CTE fields, preserve value and set unit to canonical even if conversion fails
        // if (isCTEField) {
        //     result.unit = canonicalUnit;
        //     return result;
        // }
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    // Range strings
    const r = typeof v === "string" ? parseRangeString(v) : null;
    if (r) {
        const a = parseNumericExpression(r.a);
        const b = parseNumericExpression(r.b);
        if (a !== null && b !== null) {
            const ca = applyConversionNumber(a);
            const cb = applyConversionNumber(b);
            if (ca !== null && cb !== null) {
                // Handle CTE conversion which returns {value, unit}
                let caValue = typeof ca === 'object' && 'value' in ca ? ca.value : ca;
                let cbValue = typeof cb === 'object' && 'value' in cb ? cb.value : cb;
                let outputUnit = canonicalUnit;
                if (typeof ca === 'object' && 'unit' in ca) {
                    outputUnit = ca.unit;
                } else if (typeof cb === 'object' && 'unit' in cb) {
                    outputUnit = cb.unit;
                }
                result.value = `${formatScalarForString(caValue)} - ${formatScalarForString(cbValue)}`;
                result.unit = outputUnit;
                return result;
            }
        }
        if (isMVR && isMassFlowUnit) {
            result.unit = normalizedCurrentUnit === "g/10min" ? "g/10 min" : normalizedCurrentUnit;
            return result;
        }
        // For CTE fields, preserve value and set unit to canonical even if conversion fails
        // if (isCTEField) {
        //     result.unit = canonicalUnit;
        //     return result;
        // }
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    // Pure numeric strings
    if (typeof v === "string") {
        const parsed = parseNumericExpression(v);
        if (parsed !== null) {
            const converted = applyConversionNumber(parsed);
            if (converted !== null) {
                // Handle CTE conversion which returns {value, unit}
                // if (typeof converted === 'object' && 'value' in converted && 'unit' in converted) {
                //     const floored = converted.value; // Already floored in convertCTE
                //     result.value = v.toLowerCase().includes("e")
                //         ? formatExponentString(floored)
                //         : String(floored);
                //     result.unit = converted.unit;
                // } else {
                //     const floored = floorTo2(converted);
                //     result.value = v.toLowerCase().includes("e")
                //         ? formatExponentString(floored)
                //         : String(floored);
                //     result.unit = canonicalUnit;
                // }
                if (typeof converted === 'object' && 'value' in converted && 'unit' in converted) {
                    const floored = converted.value; // Already floored in convertCTE

                    // For CTE fields, output the scaled decimal value in canonical E-4/K units.
                    // Do not re-emit scientific notation based on the original raw string.
                    result.value = isCTEField
                        ? String(floored)
                        : (v.toLowerCase().includes("e")
                            ? formatExponentString(floored)
                            : String(floored));

                    result.unit = converted.unit;
                } else {
                    const floored = floorTo2(converted);

                    result.value = isCTEField
                        ? String(floored)
                        : (v.toLowerCase().includes("e")
                            ? formatExponentString(floored)
                            : String(floored));

                    result.unit = canonicalUnit;
                }
                return result;
            }
        }
        if (isMVR && isMassFlowUnit) {
            result.unit = normalizedCurrentUnit === "g/10min" ? "g/10 min" : normalizedCurrentUnit;
            return result;
        }
        // For CTE fields, preserve value and set unit to canonical even if conversion fails
        // if (isCTEField) {
        //     result.unit = canonicalUnit;
        //     return result;
        // }
        return isStrict ? { ...result, value: null, unit: null } : result;
    }

    // Other types: leave as-is
    return result;
}