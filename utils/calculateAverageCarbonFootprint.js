// kg CO2e per kg polymer (cradle-to-gate), representative values from the provided table
const polymerCarbonFootprint = {
    "Polypropylene (PP)": 1.25,
    "Polyethylene (HDPE)": 1.4,
    "Polystyrene (GPPS)": 2.3,
    "Polystyrene (HIPS)": 2.4,
    "Acrylonitrile-Butadiene-Styrene (ABS)": 3.1,
    "Styrene-Acrylonitrile (SAN)": 3.0,
    "Polymethyl Methacrylate (PMMA)": 3.8,
    "Polycarbonate (PC)": 3.4,
    "PC/ABS Blend": 4.0,
    "Polyoxymethylene (POM, Acetal)": 3.2,
    "Polyamide 6 (PA6)": 6.7,
    "Polyamide 66 (PA66)": 6.4,
    "Polybutylene Terephthalate (PBT)": 4.9,
    "Polyethylene Terephthalate (PET)": 2.05,
    "Polyphenylene Sulfide (PPS)": 5.5,
    "Liquid Crystal Polymer (LCP)": 6.0,
    "Thermoplastic Elastomer (TPE-S, Styrenic)": 5.0,
    "Thermoplastic Polyurethane (TPU)": 5.5,
    "Thermoplastic Copolyester (TPC)": 4.0,
    "Thermoplastic Vulcanizate (TPV)": 3.0
};

// 1) optional: aliases for common ways people write materials
const ALIASES = {
    // codes
    "PP": "Polypropylene (PP)",
    "HDPE": "Polyethylene (HDPE)",
    "GPPS": "Polystyrene (GPPS)",
    "HIPS": "Polystyrene (HIPS)",
    "ABS": "Acrylonitrile-Butadiene-Styrene (ABS)",
    "SAN": "Styrene-Acrylonitrile (SAN)",
    "PMMA": "Polymethyl Methacrylate (PMMA)",
    "PC": "Polycarbonate (PC)",
    "POM": "Polyoxymethylene (POM, Acetal)",
    "ACETAL": "Polyoxymethylene (POM, Acetal)",
    "PA6": "Polyamide 6 (PA6)",
    "PA66": "Polyamide 66 (PA66)",
    "PBT": "Polybutylene Terephthalate (PBT)",
    "PET": "Polyethylene Terephthalate (PET)",
    "PPS": "Polyphenylene Sulfide (PPS)",
    "LCP": "Liquid Crystal Polymer (LCP)",
    "TPU": "Thermoplastic Polyurethane (TPU)",
    "TPC": "Thermoplastic Copolyester (TPC)",
    "TPV": "Thermoplastic Vulcanizate (TPV)",
    "TPE": "Thermoplastic Elastomer (TPE-S, Styrenic)",
    "TPE-S": "Thermoplastic Elastomer (TPE-S, Styrenic)",

    // full names (normalized versions handled below too, but this helps)
    "POLYBUTYLENE TEREPHTHALATE": "Polybutylene Terephthalate (PBT)",
    "POLYETHYLENE TEREPHTHALATE": "Polyethylene Terephthalate (PET)",
    "POLYPROPYLENE": "Polypropylene (PP)",
    "POLYCARBONATE": "Polycarbonate (PC)"
};

// normalize input/key for comparison
function normalize(str) {
    return String(str)
        .toUpperCase()
        // remove common modifiers/fillers: GFxx, FR, NAT, BK, etc. (extend as needed)
        .replace(/\bGF\s*\d+\b/g, " ")
        .replace(/\bGLASS\s*FIB(ER|RE)?\s*\d+\b/g, " ")
        .replace(/\bFR\b/g, " ")
        .replace(/\bNAT(URAL)?\b/g, " ")
        .replace(/\bBK\b/g, " ")
        // unify separators
        .replace(/[_/\\-]+/g, " ")
        // drop punctuation
        .replace(/[().,:+]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// pull a code like PA66 / PBT from things like "PBT-GF20", "PA66 30% GF"
function extractLikelyCode(inputNorm) {
    // common polymer codes patterns: PA6, PA66, PBT, PET, PC, ABS, SAN, PMMA, PPS, LCP, POM, PP, HDPE, etc.
    // We'll return the first token that looks like a known code.
    const tokens = inputNorm.split(" ");
    return tokens.find(t => ALIASES[t]) || null;
}

// code inside parentheses from keys: e.g. "Polyamide 66 (PA66)" -> "PA66"
function codeFromKey(key) {
    const m = key.match(/\(([^)]+)\)/);
    // for "PC/ABS Blend" there's no parentheses; m will be null
    return m ? m[1].toUpperCase().trim() : null;
}

// simple token overlap score (0..1)
function overlapScore(aNorm, bNorm) {
    const a = new Set(aNorm.split(" ").filter(Boolean));
    const b = new Set(bNorm.split(" ").filter(Boolean));
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / Math.max(a.size, b.size);
}

export function findFootprint(input, data = polymerCarbonFootprint) {
    if (input == null || String(input).trim() === "") return null;

    const inputNorm = normalize(input);

    // A) direct alias match on full normalized input
    if (ALIASES[inputNorm] && data[ALIASES[inputNorm]] != null) {
        const k = ALIASES[inputNorm];
        return { key: k, value: data[k] };
    }

    // B) extract likely code from input like "PBT-GF20"
    const code = extractLikelyCode(inputNorm);
    if (code && ALIASES[code] && data[ALIASES[code]] != null) {
        const k = ALIASES[code];
        return { key: k, value: data[k] };
    }

    // C) match by parentheses code inside keys
    for (const k of Object.keys(data)) {
        const c = codeFromKey(k);
        if (c && inputNorm.includes(c)) {
            return { key: k, value: data[k] };
        }
    }

    // D) fuzzy match by name similarity (token overlap)
    let best = null;
    for (const k of Object.keys(data)) {
        const kNorm = normalize(k);
        const score = overlapScore(inputNorm, kNorm);
        if (!best || score > best.score) best = { key: k, value: data[k], score };
    }

    // require a minimum confidence threshold
    if (best && best.score >= 0.6) {
        return { key: best.key, value: best.value };
    }

    return null;
}

export function randomWithinPercent(base, maxPercent = 33) {
    const pct = Math.random() * (maxPercent / 100); // 0 .. 0.33
    const sign = Math.random() < 0.5 ? -1 : 1;      // subtract or add
    return base * (1 + sign * pct);
}

export function calculateAverageCarbonFootPrint(polymer_type, generic_type) {
    let avg_carbon_footprint_object = null;
    if (polymer_type != null) {
        avg_carbon_footprint_object = findFootprint(polymer_type);

        if (avg_carbon_footprint_object != null) {
            let avg_carbon_value = avg_carbon_footprint_object.value;
            const randomized = randomWithinPercent(avg_carbon_value, 33);
            return randomized;
        }
    }

    if (generic_type != null) {
        let avg_carbon_footprint_object = findFootprint(generic_type);

        if (avg_carbon_footprint_object != null) {
            avg_carbon_value = avg_carbon_footprint_object.value;
            const randomized = randomWithinPercent(avg_carbon_value, 33);
            return randomized;
        }
    }

    return null;
}