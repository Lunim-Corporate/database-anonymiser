
import { AiRiskResult } from "./ai.types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

type OllamaGenerateResponse = {
  response: string;
};


export async function warmupLLM() {

  console.info("LLM request started - in warmupLLM");
  const start = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: "warmup",
      stream: false,
    }),
  });
  console.info(`LLM headers received after ${Date.now() - start}ms`);
  const raw = (await res.json()) as unknown;
  return (raw as OllamaGenerateResponse).response.trim();
}


// export async function llmScan(
//   schema: string,
//   tables: any[],
//   samples: any
// ): Promise<AiRiskResult | null> {
//   try {
//     const prompt = buildRiskPrompt(schema, tables, samples);

//     console.info("LLM request started - in llmScan");

//     const start = Date.now();

//     const res = await fetch(`${OLLAMA_URL}/api/generate`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({
//         model: MODEL,
//         prompt,
//         stream: false,
//         options: { temperature: 0 },
//       }),
//     });

//     console.info(`LLM headers received after ${Date.now() - start}ms`);


//     if (!res.ok) return null;

//     const raw = (await res.json()) as unknown;

//     if (
//       typeof raw !== "object" ||
//       raw === null ||
//       !("response" in raw) ||
//       typeof (raw as any).response !== "string"
//     ) {
//       return null;
//     }

//     return JSON.parse((raw as OllamaGenerateResponse).response) as AiRiskResult;
//   } catch (err) {
//     console.warn("LLM scan failed:", err);
//     return null;
//   }
// }


export async function llmComplete(prompt: string): Promise<string | null> {
  try {
    console.info("LLM request started - in llmComplete - prompt - " + prompt);
    console.info("LLM request started - in llmComplete - model - " + MODEL);

    const start = Date.now();
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2 },
      }),
 
    });
    console.info(`LLM headers received after ${Date.now() - start}ms`);

    if (!res.ok) return null;

    const raw = (await res.json()) as unknown;

    if (
      typeof raw !== "object" ||
      raw === null ||
      !("response" in raw) ||
      typeof (raw as any).response !== "string"
    ) {
      return null;
    }

    return (raw as OllamaGenerateResponse).response.trim();
  } catch (err) {
    console.warn("LLM completion failed:", err);
    return null;
  }
}


// function buildRiskPrompt(schema: string, tables: any[], samples: any) {
//   return `
// You are a data privacy engineer.

// Task:
// 1. Classify each column risk: HIGH, MEDIUM, LOW
// 2. Recommend anonymization strategies

// Allowed strategies:
// - EMAIL_FAKE
// - HASH_SHA256
// - REDACT
// - SET_NULL
// - KEEP

// Rules:
// - Output JSON only
// - No explanations
// - Use only given info
// - Treat masked values ("***") as sensitive
// - Do not invent columns

// Schema:
// ${schema}

// Tables:
// ${JSON.stringify(tables, null, 2)}

// Masked Samples:
// ${JSON.stringify(samples, null, 2)}

// Return JSON:
// {
//   "riskByColumn": { "column": "HIGH|MEDIUM|LOW" },
//   "recommendations": {
//     "EMAIL_FAKE": [],
//     "HASH_SHA256": [],
//     "REDACT": [],
//     "SET_NULL": [],
//     "KEEP": []
//   }
// }
// `;
// }
