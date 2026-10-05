import "server-only";
import type { AiReport, Investigation } from "./types";

export async function explainWithAi(caseFile: Investigation, suppliedKey?: string): Promise<AiReport | null> {
  const apiKey = process.env.OPENAI_API_KEY || suppliedKey;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const facts = {
    signature: caseFile.signature,
    network: caseFile.network,
    slot: caseFile.slot,
    success: caseFile.success,
    feeLamports: caseFile.fee,
    signers: caseFile.signers,
    programs: caseFile.programs,
    transfers: caseFile.transfers,
    balanceChanges: caseFile.balances,
    unresolvedInstructions: caseFile.unresolvedInstructions,
    evidence: caseFile.evidence,
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: "You are a careful Solana transaction analyst. Use only supplied facts. Give a concise plain-English summary and up to four specific claims. Each claim must reference evidence IDs that directly support it. Never assert wallet ownership, fraud, intent, or transaction purpose from an address alone. Do not infer a full fund trail from this single transaction. If data is incomplete, state the limit clearly. Raw token units are not human units unless decimals are known. Avoid speculation.",
      input: JSON.stringify(facts),
      text: { format: { type: "json_schema", name: "chain_scene_report", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: {
          summary: { type: "string" },
          claims: { type: "array", items: { type: "object", additionalProperties: false, properties: {
            text: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } },
          }, required: ["text", "evidenceIds"] } },
          limitations: { type: "array", items: { type: "string" } },
        }, required: ["summary", "claims", "limitations"],
      } } },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(22000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("The OpenAI API key was rejected.");
    throw new Error(`AI analysis returned HTTP ${response.status}. The onchain investigation still worked.`);
  }
  const body = await response.json();
  const text = (body.output || []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
    .find((item: { type: string; text?: string }) => item.type === "output_text")?.text;
  if (!text) throw new Error("AI analysis returned no report. The onchain investigation still worked.");
  const candidate = JSON.parse(text) as Omit<AiReport, "model">;
  const ids = new Set(caseFile.evidence.map((item) => item.id));
  return {
    summary: candidate.summary,
    claims: candidate.claims.filter((claim) => claim.evidenceIds.length > 0 && claim.evidenceIds.every((id) => ids.has(id))).slice(0, 4),
    limitations: candidate.limitations,
    model,
  };
}
