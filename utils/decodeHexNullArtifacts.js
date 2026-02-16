export function decodeHexNullArtifacts(str) {
    if (typeof str !== "string") return str;
    return str
        // NUL followed by two hex digits -> emit that codepoint (e.g., \x00b0 -> °)
        .replace(/\u0000([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        // drop any remaining NULs
        .replace(/\u0000+/g, "");
}