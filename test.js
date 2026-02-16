import { processPdfFromUrl } from "./utils/processPdfFromUrl.js";

const text = await processPdfFromUrl("http://localhost:3000/data/AKROLEN PP-GFM 25-15/AKROLEN PP GFM 25 -15 - Marketing.pdf","marketing");

console.log(text);
