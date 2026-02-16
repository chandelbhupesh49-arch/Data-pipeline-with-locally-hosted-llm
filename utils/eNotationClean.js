// export function toENotationClean(n, sig = 6) {
//     // 10000000000000 -> "1E13"
//     // 12300000000000 -> "1.23E13" (sig controls mantissa precision)
//     const s = n.toExponential(sig - 1);     // "1.23000e+13"
//     let [m, e] = s.split("e");

//     // trim trailing zeros
//     m = m.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
//     e = e.replace("+", "").replace(/^(-?)0+(\d+)/, "$1$2"); // "+013" -> "13"

//     return `${m}E${e}`;
// }

// export function formatLargeNumbersToENotation(node, opts = {}) {
//     const {
//         minAbs = 1e9,        // only convert very large values
//         onlyIntegers = true, // avoid converting normal decimals
//         sig = 6,             // "1.23E13" style mantissa
//     } = opts;

//     const visit = (x) => {
//         if (x === null || x === undefined) return;

//         if (Array.isArray(x)) {
//             for (const v of x) visit(v);
//             return;
//         }

//         if (typeof x === "object") {
//             // value-object pattern: { value, unit, test_condition, ... }
//             if ("value" in x && typeof x.value === "number" && Number.isFinite(x.value)) {
//                 const n = x.value;
//                 if (Math.abs(n) >= minAbs && (!onlyIntegers || Number.isInteger(n))) {
//                     x.value = toENotationClean(n, sig); // becomes string "1E.."
//                 }
//             }

//             for (const k of Object.keys(x)) visit(x[k]);
//         }
//     };

//     visit(node);
//     return node;
// }
