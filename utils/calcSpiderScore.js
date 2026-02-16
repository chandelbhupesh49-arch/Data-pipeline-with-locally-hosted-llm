
// export function calcSpiderScore(C, F, G, type = "LIN_HI") {
//     const t = String(type || "").trim().toUpperCase();
  
//     const isBlank = (v) => {
//       if (v === null || v === undefined) return true;
//       if (typeof v === "string") {
//         const s = v.trim();
//         return s === "" || s === "-" || s === "–" || s === "—"; // common "missing" markers
//       }
//       return false;
//     };
  
//     const clamp0100 = (x) => Math.max(0, Math.min(100, x));
  
//     const toFiniteNumber = (v) => {
//       const n = typeof v === "number" ? v : Number(String(v).trim());
//       return Number.isFinite(n) ? n : null;
//     };
  
//     const log10 = Math.log10 ? (x) => Math.log10(x) : (x) => Math.log(x) / Math.LN10;
  
//     // ---- BOOL_YES (special blank rule: blank => 30)
//     if (t === "BOOL_YES") {
//       if (isBlank(C)) return 30;
//       const s = String(C).trim().toLowerCase();
//       return s === "yes" ? 100 : 0;
//     }
  
//     // ---- UL94 (categorical)
//     if (t === "UL94") {
//       if (isBlank(C)) return ""; // Excel returns blank if C is blank
//       const s = String(C).trim().toUpperCase();
  
//       if (s === "5VA" || s === "V-0" || s === "V0") return 100;
//       if (s === "V-1" || s === "V1") return 80;
//       if (s === "V-E492" || s === "V2") return 60;
//       if (s === "HB") return 30;
//       if (s === "HBF") return 25;
//       return 0;
//     }
  
//     // For numeric-based types, Excel returns blank if C is blank
//     if (isBlank(C)) return "";
  
//     const c = toFiniteNumber(C);
//     const f = toFiniteNumber(F);
//     const g = toFiniteNumber(G);
//     if (c === null || f === null || g === null) return "";
  
//     // ---- LIN_HI / LIN_LO
//     if (t === "LIN_HI" || t === "LIN_LO") {
//       const denom = g - f;
//       if (denom === 0) return ""; // Excel would be #DIV/0!, but avoid crashing
  
//       const base = (c - f) / denom; // 0..1 in-range
//       const raw = t === "LIN_HI" ? 100 * base : 100 * (1 - base);
//       return clamp0100(raw);
//     }
  
//     // ---- LOG_HI
//     if (t === "LOG_HI") {
//       // LOG10 requires positive inputs
//       if (c <= 0 || f <= 0 || g <= 0) return "";
  
//       const denom = log10(g) - log10(f);
//       if (denom === 0) return ""; // avoid divide-by-zero
  
//       const raw = 100 * ((log10(c) - log10(f)) / denom);
//       return clamp0100(raw);
//     }
  
//     throw new Error(`Unknown score type: ${type}`);
//   }
  

export function calcSpiderScore(C, F, G, type) {
  const t = String(type || "").trim().toUpperCase();

  const isBlank = (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") {
      const s = v.trim();
      return s === "" || s === "-" || s === "–" || s === "—";
    }
    return false;
  };

  // ✅ Clamp + floor (final numeric score is always an integer)
  const clamp0100 = (x) => Math.max(0, Math.min(100, Math.floor(x)));

  const toFiniteNumber = (v) => {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const log10 = Math.log10 ? (x) => Math.log10(x) : (x) => Math.log(x) / Math.LN10;

  // ---- BOOL_YES (special blank rule: blank => 30)
  if (t === "BOOL_YES") {
    if (isBlank(C)) return 30; // already integer
    const s = String(C).trim().toLowerCase();
    return s === "yes" ? 100 : 0; // already integer
  }

  // ---- UL94 (categorical)
  if (t === "UL94") {
    if (isBlank(C)) return ""; // Excel returns blank if C is blank
    const s = String(C).trim().toUpperCase();

    if (s === "5VA" || s === "V-0" || s === "V0") return 100;
    if (s === "V-1" || s === "V1") return 80;
    if (s === "V-E492" || s === "V2") return 60;
    if (s === "HB") return 30;
    if (s === "HBF") return 25;
    return 0;
  }

  // For numeric-based types, Excel returns blank if C is blank
  if (isBlank(C)) return "";

  const c = toFiniteNumber(C);
  const f = toFiniteNumber(F);
  const g = toFiniteNumber(G);
  if (c === null || f === null || g === null) return "";

  // ---- LIN_HI / LIN_LO
  if (t === "LIN_HI" || t === "LIN_LO") {
    const denom = g - f;
    if (denom === 0) return "";

    const base = (c - f) / denom;
    const raw = t === "LIN_HI" ? 100 * base : 100 * (1 - base);
    return clamp0100(raw); // ✅ floored here
  }

  // ---- LOG_HI
  if (t === "LOG_HI") {
    if (c <= 0 || f <= 0 || g <= 0) return "";

    const denom = log10(g) - log10(f);
    if (denom === 0) return "";

    const raw = 100 * ((log10(c) - log10(f)) / denom);
    return clamp0100(raw); // ✅ floored here
  }

  throw new Error(`Unknown score type: ${type}`);
}
