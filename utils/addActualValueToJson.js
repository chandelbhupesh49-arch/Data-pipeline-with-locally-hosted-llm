export function addActualValueToJson(inputJson) {
    function walk(node) {
        if (Array.isArray(node)) {
            return node.map(walk);
        }

        if (node !== null && typeof node === "object") {
            const result = {};

            for (const key of Object.keys(node)) {
                result[key] = walk(node[key]);
            }

            if (Object.prototype.hasOwnProperty.call(node, "value")) {
                const value = node.value;
                const unit = node.unit;

                let actualValue = value;

                const eNotationUnitMatch =
                    typeof unit === "string"
                        ? unit.trim().match(/^[eE]([+-]?\d+)(?:\/.*)?$/)
                        : null;

                if (eNotationUnitMatch) {
                    const numericValue =
                        typeof value === "number"
                            ? value
                            : typeof value === "string" && value.trim() !== ""
                                ? Number(value.trim())
                                : null;

                    const exponent = Number(eNotationUnitMatch[1]);

                    if (
                        numericValue !== null &&
                        Number.isFinite(numericValue) &&
                        Number.isFinite(exponent)
                    ) {
                        const convertedValue = numericValue * Math.pow(10, exponent);

                        const cleanedValue = Number(convertedValue.toPrecision(12));

                        actualValue =
                            Math.abs(cleanedValue) > 0 && Math.abs(cleanedValue) < 0.001
                                ? cleanedValue
                                : Number.isInteger(cleanedValue)
                                    ? cleanedValue
                                    : Number(cleanedValue.toFixed(4   
                                        
                                    ));
                    }
                } else {
                    const isScientificNotationValue =
                        typeof value === "string" &&
                        /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))[eE][+-]?\d+$/.test(
                            value.trim()
                        );

                    if (isScientificNotationValue) {
                        const numericValue = Number(value.trim());

                        if (Number.isFinite(numericValue)) {
                            const cleanedValue = Number(numericValue.toPrecision(12));

                            actualValue =
                                Math.abs(cleanedValue) > 0 && Math.abs(cleanedValue) < 0.001
                                    ? cleanedValue
                                    : Number.isInteger(cleanedValue)
                                        ? cleanedValue
                                        : Number(cleanedValue.toFixed(3));
                        }
                    }
                }

                result.actual_value = actualValue;
            }

            return result;
        }

        return node;
    }

    return walk(inputJson);
}