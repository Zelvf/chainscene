export type Network = "mainnet" | "devnet";

export type BalanceChange = {
  id: string;
  address: string;
  owner: string | null;
  mint: string | null;
  raw: string;
  decimals: number;
};

export type Transfer = {
  id: string;
  instruction: string;
  source: string;
  destination: string;
  sourceOwner: string | null;
  destinationOwner: string | null;
  mint: string | null;
  raw: string;
  decimals: number | null;
};

export type Evidence = {
  id: string;
  label: string;
  detail: string;
  kind: "transfer" | "balance" | "fee" | "status" | "instruction";
};

export type Investigation = {
  network: Network;
  signature: string;
  slot: number;
  blockTime: number | null;
  success: boolean;
  fee: string;
  signers: string[];
  programs: string[];
  transfers: Transfer[];
  balances: BalanceChange[];
  evidence: Evidence[];
  unresolvedInstructions: number;
  checkedAt: string;
  ai: AiReport | null;
};

export type AiReport = {
  summary: string;
  claims: { text: string; evidenceIds: string[] }[];
  limitations: string[];
  model: string;
};

export type HistoryItem = {
  signature: string;
  slot: number;
  blockTime: number | null;
  failed: boolean;
};
