import { NextRequest, NextResponse } from "next/server";
import { explainWithAi } from "@/lib/ai";
import { investigate, isSignature } from "@/lib/solana";
import type { Network } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 3000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json();
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    const network: Network = body.network === "devnet" ? "devnet" : "mainnet";
    const suppliedKey = typeof body.apiKey === "string" && body.apiKey.startsWith("sk-") && body.apiKey.length < 500 ? body.apiKey : undefined;
    if (!isSignature(signature)) return NextResponse.json({ error: "Enter a valid Solana transaction signature." }, { status: 400 });
    const result = await investigate(signature, network);
    let aiError: string | null = null;
    try {
      result.ai = await explainWithAi(result, suppliedKey);
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI analysis was unavailable.";
    }
    return NextResponse.json({ result, aiError }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investigation failed." }, { status: 502 });
  }
}
