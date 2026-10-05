import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "ChainScene",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    mainnetRpc: process.env.SOLANA_RPC_URL ? "custom" : "public",
    devnetRpc: process.env.SOLANA_DEVNET_RPC_URL ? "custom" : "public",
  });
}
