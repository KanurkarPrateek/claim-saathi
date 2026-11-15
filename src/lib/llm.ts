import { z } from "zod";

/**
 * Thin client for the Azure AI Foundry model-inference endpoint (OpenAI-style chat completions).
 * Configured by AZURE_AI_ENDPOINT / AZURE_AI_KEY / AZURE_AI_MODEL / AZURE_AI_API_VERSION.
 */

export type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Msg = { role: "system" | "user" | "assistant"; content: string | Part[] };

export const llmConfigured = () => Boolean(process.env.AZURE_AI_ENDPOINT && process.env.AZURE_AI_KEY);

/** Primary model first; on a rate limit (429) or capacity error, retry once on the fallback model. */
async function chat(messages: Msg[]): Promise<string> {
  const primary = process.env.AZURE_AI_MODEL ?? "Kimi-K3.1-Pro";
  const fallback = process.env.AZURE_AI_FALLBACK_MODEL;
  try {
    return await chatWith(primary, messages);
  } catch (e) {
    const retryable = e instanceof LlmError ? e.status === 429 || e.status >= 500 : e instanceof TypeError; // TypeError = network failure
    if (fallback && fallback !== primary && retryable) {
      console.warn(`[llm] ${primary} failed (${e instanceof LlmError ? e.status : "network"}); using ${fallback}`);
      return chatWith(fallback, messages);
    }
    throw e;
  }
}

async function chatWith(model: string, messages: Msg[]): Promise<string> {
  const base = process.env.AZURE_AI_ENDPOINT!.replace(/\/+$/, "");
  const version = process.env.AZURE_AI_API_VERSION ?? "2024-05-01-preview";
  const res = await fetch(`${base}/models/chat/completions?api-version=${version}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_AI_KEY! },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: 16000,
    }),
    signal: AbortSignal.timeout(110_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new LlmError(res.status, `${model}: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new LlmError(502, "Empty reply from model");
  return content;
}

export class LlmError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const stripFence = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

/** Ask for JSON matching `schema`; validate with zod and give the model one chance to repair. */
export async function extractJson<S extends z.ZodType>(schema: S, instructions: string, parts: Part[]): Promise<z.infer<S>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const messages: Msg[] = [
    {
      role: "system",
      content: `${instructions}\n\nReply with ONE JSON object only (no markdown) that matches this JSON Schema exactly — every required key present, correct types, no extra keys:\n${jsonSchema}`,
    },
    { role: "user", content: parts },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chat(messages);
    let parsed: unknown;
    let problem: string;
    try {
      parsed = JSON.parse(stripFence(raw));
      const r = schema.safeParse(parsed);
      if (r.success) return r.data;
      problem = r.error.issues.slice(0, 15).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    } catch {
      problem = "Reply was not valid JSON.";
    }
    messages.push({ role: "assistant", content: raw }, { role: "user", content: `That JSON did not match the schema:\n${problem}\nReturn the corrected full JSON object only.` });
  }
  throw new LlmError(422, "The model could not produce valid details from this document.");
}
