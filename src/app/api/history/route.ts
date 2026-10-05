import { NextRequest, NextResponse } from "next/server";
import { getAddressHistory, isAddress } from "@/lib/solana";
import type { Network } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address") || "";
  const network: Network = request.nextUrl.searchParams.get("network") === "devnet" ? "devnet" : "mainnet";
  if (!isAddress(address)) return NextResponse.json({ error: "Invalid account address." }, { status: 400 });
  try {
    const items = await getAddressHistory(address, network);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "History request failed." }, { status: 502 });
  }
}
