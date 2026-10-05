import { Workbench } from "@/components/workbench";
import { investigate, isSignature } from "@/lib/solana";
import type { Investigation, Network } from "@/lib/types";

export default async function Home({ searchParams }: { searchParams: Promise<{ signature?: string; network?: string }> }) {
  const query = await searchParams;
  const network: Network = query.network === "devnet" ? "devnet" : "mainnet";
  let initialCase: Investigation | null = null;
  if (query.signature && isSignature(query.signature)) {
    try { initialCase = await investigate(query.signature, network); } catch { /* The visitor can retry with the form. */ }
  }
  return <Workbench initialSignature={query.signature || ""} initialNetwork={network} initialCase={initialCase} />;
}
