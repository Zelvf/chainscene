import { NextRequest, NextResponse } from "next/server";
import { isSignature, traceNextHops } from "@/lib/solana";
import type { Network } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json();
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    const network: Network = body.network === "devnet" ? "devnet" : "mainnet";
    if (!isSignature(signature)) return NextResponse.json({ error: "Enter a valid Solana transaction signature." }, { status: 400 });
    return NextResponse.json(await traceNextHops(signature, network), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trace scan failed." }, { status: 502 });
  }
}
