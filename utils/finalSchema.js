import OpenAI from "openai";
import "dotenv/config";
import { calcSpiderScore } from "./calcSpiderScore.js";
import { calcFinalSpiderPlotValues } from "./calcFinalSpiderPlotValues.js";


    //     async function generateEngineeringInsights(finalJson) {
    //         const apiKey = process.env.OPENAI_API_KEY;
    //         if (!apiKey) {
    //             throw new Error(
    //                 "Missing OPENAI_API_KEY. Set it in your environment (or .env) to generate engineering insights."
    //             );
    //         }

    //         const client = new OpenAI({ apiKey });


    //         const systemMsg = {
    //             role: "system",
    //             content: `
    // You are a top 0.1% injection molding process engineer and polymer materials scientist focused on polymer processing and manufacturability.

    // Hard rules:
    // - Output ONLY valid JSON. No markdown. No extra text.
    // - Use double quotes for all keys and strings. No trailing commas.
    // - Output MUST match the provided schema EXACTLY. Do not add, rename, reorder, or omit keys.
    // - Do NOT invent properties, test methods, ratings, compliance, reinforcement, polymer family, hydrolysis, or processing windows unless explicitly present in the input JSON.
    // - If you lack evidence for a field, set that field to null. Still return the full schema.
    // - Use ONLY numbers that appear in the input JSON. Do not create ranges, averages, or typical values.
    // - Keep every string value as a single line of plain text. Do not use escape sequences like \\n, \\t, or \\u.
    // - Absolutely do not use any bracket characters inside string values: ( ) [ ] { } < >
    // - Do not use list formatting, bullets, or colon-led fragments. Write natural sentences.
    // - Do not include placeholders like TBD, N/A, unknown, or any template text. Use null instead.
    // `.trim()
    //         };

    //         const userMsg = {
    //             role: "user",
    //             content: `
    // Analyze the provided Material Property JSON and output engineering guidance suitable for injection molding and manufacturing.

    // Return JSON that matches this schema EXACTLY:
    // ${JSON.stringify(engineeringInsightSchema, null, 2)}

    // Writing style and length:
    // - "overview": 1 to 2 sentences, 140 to 260 characters total.
    // - Other string fields: 1 to 2 sentences each, concise and actionable, 120 to 220 characters total.
    // - Avoid sounding robotic. Write like a senior process engineer leaving notes for another engineer.
    // - No bracket characters in any string value: ( ) [ ] { } < >

    // Numeric anchoring:
    // - Use at least TWO numeric values from the input JSON across the output when available.
    // - Use ONLY numbers present in the input JSON and keep their units as written.
    // - If the input JSON contains no numeric values at all, do not force numbers.

    // Field guidance:
    // - overview: what it is good for plus one limitation only if supported by the input.
    // - processing_strategy.fiber_orientation: mention gate and flow only if anisotropy or reinforcement is explicitly indicated.
    // - processing_strategy.injection_speed: tie to viscosity or MFR or thin wall fill and defect avoidance only with evidence.
    // - processing_strategy.surface_finish: tie to mold temperature, flow, and fillers; include setpoints only if present.
    // - tooling.wear_protection: recommend hardened steel or coatings only if abrasive fillers or reinforcement is explicitly indicated.
    // - tooling.venting: practical venting guidance; include vent depth only if present.
    // - best_fit_applications: infer realistic uses from the properties; 3 to 6 items; each item 2 to 4 words; no punctuation.
    // - warning: a realistic risk tied to a property; include a numeric value if available.

    // INPUT JSON:
    // ${JSON.stringify(finalJson)}
    // `.trim()
    //         };


    //         const response = await client.chat.completions.create({
    //             model: "gpt-5.2",
    //             messages: [
    //                 systemMsg, userMsg
    //             ],
    //             temperature: 0.2
    //         });


    //         const text = response.choices[0]?.message?.content?.trim();
    //         if (!text) return null;

    //         return text;
    //     }


const engineeringInsightSchema = {
    overview: null,
    processing_strategy: {
        fiber_orientation: null,
        injection_speed: null,
        surface_finish: null
    },
    tooling: {
        wear_protection: null,
        venting: null
    },
    best_fit_applications: [],
    warning: null
};


export const finalSchemaTransformation = async (sanitizedJson) => {
    async function generateEngineeringInsights(finalJson) {
        const LOCALLY_HOSTED_LLM_BASE_URL = process.env.LOCALLY_HOSTED_LLM_BASE_URL2;
        try {
            const prompt = `
You are a top 0.1% injection molding process engineer and polymer materials scientist focused on polymer processing and manufacturability.

Hard rules:
- Output ONLY valid JSON. No markdown. No extra text.
- Use double quotes for all keys and strings. No trailing commas.
- Output MUST match the provided schema EXACTLY. Do not add, rename, reorder, or omit keys.
- Do NOT invent properties, test methods, ratings, compliance, reinforcement, polymer family, hydrolysis, or processing windows unless explicitly present in the input JSON.
- If you lack evidence for a field, set that field to null. Still return the full schema.
- Use ONLY numbers that appear in the input JSON. Do not create ranges, averages, or typical values.
- Keep every string value as a single line of plain text. Do not use escape sequences like \\n, \\t, or \\u.
- Absolutely do not use any bracket characters inside string values: ( ) [ ] { } < >
- Do not use list formatting, bullets, or colon-led fragments. Write natural sentences.
- Do not include placeholders like TBD, N/A, unknown, or any template text. Use null instead.
`.trim()

            const userPrompt = `Analyze the provided Material Property JSON and output engineering guidance suitable for injection molding and manufacturing.

Return JSON that matches this schema EXACTLY:
${JSON.stringify(engineeringInsightSchema, null, 2)}

Writing style and length:
- "overview": 1 to 2 sentences, 140 to 260 characters total.
- Other string fields: 1 to 2 sentences each, concise and actionable, 120 to 220 characters total.
- Avoid sounding robotic. Write like a senior process engineer leaving notes for another engineer.
- No bracket characters in any string value: ( ) [ ] { } < >

Numeric anchoring:
- Use at least TWO numeric values from the input JSON across the output when available.
- Use ONLY numbers present in the input JSON and keep their units as written.
- If the input JSON contains no numeric values at all, do not force numbers.

Field guidance:
- overview: what it is good for plus one limitation only if supported by the input.
- processing_strategy.fiber_orientation: mention gate and flow only if anisotropy or reinforcement is explicitly indicated.
- processing_strategy.injection_speed: tie to viscosity or MFR or thin wall fill and defect avoidance only with evidence.
- processing_strategy.surface_finish: tie to mold temperature, flow, and fillers; include setpoints only if present.
- tooling.wear_protection: recommend hardened steel or coatings only if abrasive fillers or reinforcement is explicitly indicated.
- tooling.venting: practical venting guidance; include vent depth only if present.
- best_fit_applications: infer realistic uses from the properties; 3 to 6 items; each item 2 to 4 words; no punctuation.
- warning: a realistic risk tied to a property; include a numeric value if available.

INPUT JSON:
${JSON.stringify(finalJson)}
`.trim()

            const response = await fetch(`${LOCALLY_HOSTED_LLM_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    "model": "gpt-oss:20b-cloud",
                    // "format": strictSchema,
                    "format": "json",
                    "messages": [
                        {
                            "role": "system",
                            "content": prompt
                        },
                        {
                            "role": "user",
                            "content": userPrompt
                        }
                    ],
                    "stream": false
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`error while generating engineering insights in local llm call ${response.status}: ${errText}`);
            }

            const res = await response.json();

            const content = res?.message?.content;

            if (!content) {
                throw new Error(`No message.content in LLM response: ${JSON.stringify(res)}`);
            }

            return content;

        }
        catch (err) {
            console.err(`error generating engineering insights : `,err);
        }

    }
    const insightsText = await generateEngineeringInsights(sanitizedJson);
    let insightsObj = null;
    try {
        insightsObj = JSON.parse(insightsText);
    } catch (e) {
        // fallback if model ever returns invalid JSON
        insightsObj = null;
    }
    sanitizedJson["engineering_insights"] = insightsObj;

    const finalizedJson = calcFinalSpiderPlotValues(sanitizedJson);
    return finalizedJson;
};
