import "server-only";
import JSONbig from "json-bigint";
import type { BalanceChange, Evidence, HistoryItem, Investigation, Network, TraceResult, Transfer } from "./types";

const DEFAULT_ENDPOINTS: Record<Network, string> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

type RpcTransaction = {
  slot: number;
  blockTime: number | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: ({ pubkey: string; signer: boolean } | string)[];
      instructions: RpcInstruction[];
    };
  };
  meta: {
    err: unknown;
    fee: number;
    preBalances: (number | string)[];
    postBalances: (number | string)[];
    preTokenBalances?: RpcTokenBalance[];
    postTokenBalances?: RpcTokenBalance[];
    innerInstructions?: { index: number; instructions: RpcInstruction[] }[];
  } | null;
};

type RpcInstruction = {
  program?: string;
  programId?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
};

type RpcTokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};

function endpoint(network: Network) {
  const custom = network === "mainnet" ? process.env.SOLANA_RPC_URL : process.env.SOLANA_DEVNET_RPC_URL;
  return custom || DEFAULT_ENDPOINTS[network];
}

async function rpc<T>(network: Network, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint(network), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}. Try again shortly.`);
  const body = JSONbig({ storeAsString: true }).parse(await response.text());
  if (body.error) throw new Error(body.error.message || "Solana RPC rejected the request.");
  return body.result as T;
}

export function isAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function isSignature(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value);
}

function keyAt(keys: RpcTransaction["transaction"]["message"]["accountKeys"], index: number): string {
  const key = keys[index];
  return typeof key === "string" ? key : key?.pubkey || `Account #${index}`;
}

function tokenAmount(balance: RpcTokenBalance | undefined): bigint {
  return BigInt(balance?.uiTokenAmount.amount || "0");
}

function stringField(info: Record<string, unknown>, key: string): string | null {
  return typeof info[key] === "string" ? info[key] as string : null;
}

export async function investigate(signature: string, network: Network): Promise<Investigation> {
  const tx = await rpc<RpcTransaction | null>(network, "getTransaction", [signature, {
    commitment: "finalized", encoding: "jsonParsed", maxSupportedTransactionVersion: 1,
  }]);
  if (!tx || !tx.meta) throw new Error("Transaction not found in finalized history on this network.");

  const keys = tx.transaction.message.accountKeys;
  const preTokens = new Map((tx.meta.preTokenBalances || []).map((item) => [item.accountIndex, item]));
  const postTokens = new Map((tx.meta.postTokenBalances || []).map((item) => [item.accountIndex, item]));
  const tokenIndexes = new Set([...preTokens.keys(), ...postTokens.keys()]);
  const tokenOwners = new Map<string, string>();
  const tokenMints = new Map<string, { mint: string; decimals: number }>();
  const balances: BalanceChange[] = [];
  const evidence: Evidence[] = [];

  for (let i = 0; i < keys.length; i++) {
    const change = BigInt(tx.meta.postBalances[i] || 0) - BigInt(tx.meta.preBalances[i] || 0);
    if (change !== BigInt(0)) {
      const address = keyAt(keys, i);
      const id = `balance-sol-${i}`;
      balances.push({ id, address, owner: null, mint: null, raw: change.toString(), decimals: 9 });
      evidence.push({ id, label: "SOL balance change", detail: `${address}: ${change.toString()} lamports`, kind: "balance" });
    }
  }
  for (const i of tokenIndexes) {
    const before = preTokens.get(i);
    const after = postTokens.get(i);
    const item = after || before;
    if (!item) continue;
    const address = keyAt(keys, i);
    if (item.owner) tokenOwners.set(address, item.owner);
    tokenMints.set(address, { mint: item.mint, decimals: item.uiTokenAmount.decimals });
    const change = tokenAmount(after) - tokenAmount(before);
    if (change !== BigInt(0)) {
      const id = `balance-token-${i}`;
      balances.push({ id, address, owner: item.owner || null, mint: item.mint, raw: change.toString(), decimals: item.uiTokenAmount.decimals });
      evidence.push({ id, label: "Token balance change", detail: `${address}: ${change.toString()} raw units of ${item.mint}`, kind: "balance" });
    }
  }

  const instructions = [
    ...tx.transaction.message.instructions.map((instruction, i) => ({ instruction, path: `${i + 1}` })),
    ...(tx.meta.innerInstructions || []).flatMap((group) => group.instructions.map((instruction, i) => ({ instruction, path: `${group.index + 1}.${i + 1}` }))),
  ];
  const programs = [...new Set(instructions.map(({ instruction }) => instruction.programId).filter((id): id is string => Boolean(id)))];
  programs.forEach((program, index) => evidence.push({ id: `program-${index + 1}`, label: "Program called", detail: program, kind: "instruction" }));
  const transfers: Transfer[] = [];
  let unresolvedInstructions = 0;
  for (const { instruction, path } of instructions) {
    const parsed = instruction.parsed;
    const info = parsed?.info;
    if (!parsed || !info) { unresolvedInstructions++; continue; }
    const type = parsed.type || "unknown";
    const source = stringField(info, "source");
    const destination = stringField(info, "destination");
    const isSystem = instruction.program === "system" && (type === "transfer" || type === "transferWithSeed");
    const isToken = (instruction.program === "spl-token" || instruction.program === "spl-token-2022") && (type === "transfer" || type === "transferChecked");
    if (!isSystem && !isToken) continue;
    if (!source || !destination) { unresolvedInstructions++; continue; }
    const amountField = isSystem ? info.lamports : (info.tokenAmount && typeof info.tokenAmount === "object" ? (info.tokenAmount as Record<string, unknown>).amount : info.amount);
    if (typeof amountField !== "string" && typeof amountField !== "number") { unresolvedInstructions++; continue; }
    const raw = String(amountField);
    if (!/^\d+$/.test(raw)) { unresolvedInstructions++; continue; }
    const mintData = tokenMints.get(source) || tokenMints.get(destination);
    const mint = isToken ? stringField(info, "mint") || mintData?.mint || null : null;
    const tokenAmountInfo = info.tokenAmount && typeof info.tokenAmount === "object" ? info.tokenAmount as Record<string, unknown> : null;
    const decimals = isSystem ? 9 : (typeof tokenAmountInfo?.decimals === "number" ? tokenAmountInfo.decimals : mintData?.decimals ?? null);
    const id = `transfer-${path}`;
    transfers.push({ id, instruction: path, source, destination, sourceOwner: tokenOwners.get(source) || null, destinationOwner: tokenOwners.get(destination) || null, mint, raw, decimals });
    evidence.push({ id, label: isSystem ? "SOL transfer instruction" : "Token transfer instruction", detail: `Instruction ${path}: ${source} → ${destination}, ${raw} raw units${mint ? `, mint ${mint}` : ""}`, kind: "transfer" });
  }

  const success = tx.meta.err === null;
  const fee = String(tx.meta.fee);
  evidence.unshift({ id: "status", label: "Execution status", detail: success ? "Transaction succeeded" : "Transaction failed; parsed instructions did not commit transfers", kind: "status" });
  evidence.push({ id: "fee", label: "Network fee", detail: `${fee} lamports`, kind: "fee" });

  return {
    network, signature, slot: tx.slot, blockTime: tx.blockTime, success, fee,
    signers: keys.flatMap((key) => typeof key !== "string" && key.signer ? [key.pubkey] : []),
    programs, transfers: success ? transfers : [], balances, evidence: success ? evidence : evidence.filter((item) => item.kind !== "transfer"),
    unresolvedInstructions, checkedAt: new Date().toISOString(), ai: null,
  };
}

export async function getAddressHistory(address: string, network: Network, limit = 12): Promise<HistoryItem[]> {
  const items = await rpc<{ signature: string; slot: number; blockTime: number | null; err: unknown }[]>(network, "getSignaturesForAddress", [address, { commitment: "finalized", limit: Math.min(limit, 20) }]);
  return items.map((item) => ({ signature: item.signature, slot: item.slot, blockTime: item.blockTime, failed: item.err !== null }));
}

export async function traceNextHops(signature: string, network: Network): Promise<TraceResult> {
  const root = await investigate(signature, network);
  const targets = [...new Map(root.transfers.map((transfer) => [transfer.destination, { account: transfer.destination, mint: transfer.mint }])).values()].slice(0, 4);
  const historyResults = await Promise.allSettled(targets.map((target) => getAddressHistory(target.account, network, 20)));
  const candidates = new Map<string, HistoryItem>();
  historyResults.forEach((outcome) => {
    if (outcome.status !== "fulfilled") return;
    outcome.value.filter((item) => !item.failed && item.slot > root.slot &&
      (root.blockTime === null || item.blockTime === null || item.blockTime <= root.blockTime + 7200))
      .forEach((item) => candidates.set(item.signature, item));
  });
  const nearby = [...candidates.values()].sort((a, b) => a.slot - b.slot).slice(0, 6);
  const transactionResults = await Promise.allSettled(nearby.map((item) => investigate(item.signature, network)));
  const hops: TraceResult["hops"] = [];
  transactionResults.forEach((outcome) => {
    if (outcome.status !== "fulfilled" || !outcome.value.success) return;
    const tx = outcome.value;
    tx.transfers.forEach((transfer) => {
      const target = targets.find((item) => item.account === transfer.source && item.mint === transfer.mint);
      if (!target) return;
      hops.push({ fromAccount: transfer.source, toAccount: transfer.destination, mint: transfer.mint,
        raw: transfer.raw, decimals: transfer.decimals, signature: tx.signature, slot: tx.slot, blockTime: tx.blockTime });
    });
  });
  return {
    hops: hops.slice(0, 12),
    accountsChecked: historyResults.filter((item) => item.status === "fulfilled").length,
    transactionsChecked: transactionResults.filter((item) => item.status === "fulfilled").length,
    note: "This is a bounded scan of the latest 20 signatures for up to four recipient accounts, followed by at most six nearby transactions within two hours. It may miss activity. Later transfers from an account do not prove the same deposited units moved onward.",
  };
}
