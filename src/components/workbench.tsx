"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleAlert, CircleHelp, Copy, ExternalLink, Fingerprint, GitBranch, KeyRound, Layers3, LoaderCircle, Network, Play, Radar, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { FlowMap } from "./flow-map";
import type { HistoryItem, Investigation, Network as ChainNetwork } from "@/lib/types";

const short = (value: string, left = 6, right = 6) => `${value.slice(0, left)}â€¦${value.slice(-right)}`;
const txUrl = (network: ChainNetwork, signature: string) => `https://explorer.solana.com/tx/${signature}${network === "devnet" ? "?cluster=devnet" : ""}`;
const accountUrl = (network: ChainNetwork, address: string) => `https://explorer.solana.com/address/${address}${network === "devnet" ? "?cluster=devnet" : ""}`;
const EXAMPLE_SIGNATURE = "YFDMimNQJ6p6ZS4uUGKTbBTsLhsnfE2g92gJDZECQxnJCwnu74NEHN4Wak232nYg7dogd5sZRpc1GHMXsznemmb";

function amount(raw: string, decimals: number | null) {
  if (decimals === null) return `${raw} raw`;
  const sign = raw.startsWith("-") ? "âˆ’" : "";
  const digits = raw.replace("-", "").padStart(decimals + 1, "0");
  const integer = decimals ? digits.slice(0, -decimals) : digits;
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, "") : "";
  return `${sign}${BigInt(integer).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
const date = (seconds: number | null) => seconds ? new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Time unavailable";

export function Workbench({ initialSignature, initialNetwork, initialCase }: { initialSignature: string; initialNetwork: ChainNetwork; initialCase: Investigation | null }) {
  const [signature, setSignature] = useState(initialSignature);
  const [network, setNetwork] = useState<ChainNetwork>(initialNetwork);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [result, setResult] = useState<Investigation | null>(initialCase);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<string | null>(initialCase?.transfers[0]?.id || null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(value = signature, chain = network) {
    setLoading(true); setError(null); setResult(null); setAiError(null); setSelectedAddress(null);
    try {
      const response = await fetch("/api/investigate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature: value.trim(), network: chain, apiKey: apiKey.trim() || undefined }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Investigation failed.");
      setResult(body.result); setAiError(body.aiError); setSelectedTransfer(body.result.transfers[0]?.id || null);
      setSignature(value.trim()); setNetwork(chain);
      window.history.replaceState(null, "", `/?signature=${encodeURIComponent(value.trim())}&network=${chain}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Investigation failed."); }
    finally { setLoading(false); }
  }

  async function inspectAddress(address: string) {
    setSelectedAddress(address); setHistory(null); setHistoryError(null); setHistoryLoading(true);
    try {
      const response = await fetch(`/api/history?network=${network}&address=${encodeURIComponent(address)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not fetch history.");
      setHistory(body.items);
    } catch (caught) { setHistoryError(caught instanceof Error ? caught.message : "Could not fetch history."); }
    finally { setHistoryLoading(false); }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(`${location.origin}/?signature=${result.signature}&network=${result.network}`);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  return <div className="site-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar"><Link className="brand" href="/"><span className="brand-symbol"><Activity size={22} strokeWidth={2.6} /></span><span>CHAIN<span>SCENE</span></span><i>/ LAB</i></Link><div className="topbar-right"><span className="live-dot" /><span>ONCHAIN FORENSICS</span><a href="https://github.com/Zelvf/chainscene" target="_blank" rel="noreferrer">SOURCE <ArrowUpRight size={13} /></a></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> INTELLIGENCE FOR THE OPEN LEDGER <span className="eyebrow-index">/ 001</span></div><h1>Every transaction<br />has a <em>story.</em></h1><p>Paste a Solana signature. See the transfers, balance changes, and program calls behind itâ€”then follow the evidence yourself.</p><div className="hero-metrics"><div><strong>01</strong><span>Trace the transaction</span></div><div><strong>02</strong><span>Inspect the evidence</span></div><div><strong>03</strong><span>Follow accounts</span></div></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><div className="core"><Radar size={74} strokeWidth={0.8} /></div><div className="orbit-label label-a">TXN_001 <span>â—</span></div><div className="orbit-label label-b">VERIFIED BLOCK <span>â†—</span></div><div className="orbit-label label-c">FLOW ACTIVE <span>â—‡</span></div></div></section>

      <section className="search-panel" aria-label="Transaction search"><div className="panel-topline"><span><Search size={15} /> NEW INVESTIGATION</span><span className="panel-index">01 / INPUT</span></div><form onSubmit={(event) => { event.preventDefault(); void run(); }}><div className="search-row"><div className="signature-field"><Fingerprint size={21} /><input aria-label="Solana transaction signature" value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Paste a transaction signature..." spellCheck={false} autoComplete="off" /></div><select aria-label="Network" value={network} onChange={(event) => setNetwork(event.target.value as ChainNetwork)}><option value="mainnet">MAINNET</option><option value="devnet">DEVNET</option></select><button className="investigate-btn" disabled={loading || !signature.trim()}>{loading ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={19} />}<span>{loading ? "TRACING" : "INVESTIGATE"}</span></button></div></form><div className="search-footer"><span><ShieldCheck size={15} /> Read-only. No wallet connection required.</span><div><button type="button" onClick={() => { setSignature(EXAMPLE_SIGNATURE); setNetwork("mainnet"); void run(EXAMPLE_SIGNATURE, "mainnet"); }}><Play size={14} /> TRY LIVE EXAMPLE</button><button type="button" onClick={() => setShowKey(!showKey)}><KeyRound size={15} /> {showKey ? "HIDE AI SETTINGS" : "ENABLE AI NARRATIVE"} <ChevronRight size={14} /></button></div></div>{showKey && <div className="key-settings"><div><strong>Bring your own OpenAI key</strong><p>Optional. Used only for this request to write an evidence-linked narrative. It stays in this browser session and is never saved.</p></div><input aria-label="OpenAI API key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></div>}{error && <div className="error-bar"><CircleAlert size={17} />{error}</div>}</section>

      {!result && <section className="prelude"><div className="prelude-heading"><span className="section-kicker">THE PROCESS</span><h2>From signature to signal.</h2></div><div className="steps"><div><span className="step-icon"><Layers3 size={22} /></span><small>01 / DECODE</small><h3>Read the chain</h3><p>Fetch finalized transaction data directly from Solana RPC.</p></div><div><span className="step-icon"><GitBranch size={22} /></span><small>02 / RECONSTRUCT</small><h3>Map the movement</h3><p>Extract committed transfers and exact account balance changes.</p></div><div><span className="step-icon"><Sparkles size={22} /></span><small>03 / EXPLAIN</small><h3>Show the proof</h3><p>AI commentary, when enabled, links claims to inspectable evidence.</p></div></div></section>}

      {result && <section className="case-file" aria-live="polite"><div className="case-heading"><div><span className="section-kicker">CASE FILE / {result.network.toUpperCase()}</span><h2>Transaction decoded<span className="heading-period">.</span></h2><p>Finalized at slot {result.slot.toLocaleString()} Â· {date(result.blockTime)}</p></div><div className="case-actions"><button onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "COPIED" : "COPY LINK"}</button><a href={txUrl(result.network, result.signature)} target="_blank" rel="noreferrer">VIEW ON EXPLORER <ExternalLink size={15} /></a></div></div><div className="case-id"><span>TRANSACTION SIGNATURE</span><code>{result.signature}</code><span className={result.success ? "status success" : "status failed"}>{result.success ? "â— CONFIRMED" : "â— FAILED"}</span></div><div className="stat-grid"><div><span>DECODED TRANSFERS</span><strong>{String(result.transfers.length).padStart(2, "0")}</strong><ArrowUpRight size={18} /></div><div><span>BALANCE CHANGES</span><strong>{String(result.balances.length).padStart(2, "0")}</strong><Activity size={18} /></div><div><span>PROGRAMS TOUCHED</span><strong>{String(result.programs.length).padStart(2, "0")}</strong><Network size={18} /></div><div><span>NETWORK FEE</span><strong>{amount(result.fee, 9)}</strong><small>SOL</small></div></div>
        <div className="workspace-grid"><div className="workspace-primary"><div className="section-head"><div><span className="section-kicker">01 / FLOW MAP</span><h3>Where value moved</h3></div><span className="section-hint">DRAG TO EXPLORE Â· CLICK AN ACCOUNT</span></div><div className="map-wrap"><FlowMap result={result} selectedTransfer={selectedTransfer} onSelectAddress={(address) => void inspectAddress(address)} onSelectTransfer={setSelectedTransfer} /></div><div className="map-legend"><span><i className="legend-dot" /> Parsed transfer instruction</span><span><CircleHelp size={14} /> Account owners shown when RPC provides them</span></div><div className="section-head transfers-head"><div><span className="section-kicker">02 / INSTRUCTION LOG</span><h3>Decoded transfers</h3></div><span className="section-hint">{result.transfers.length} FOUND</span></div><div className="transfer-list">{result.transfers.length ? result.transfers.map((transfer) => <button className={`transfer-row ${selectedTransfer === transfer.id ? "active" : ""}`} key={transfer.id} onClick={() => setSelectedTransfer(transfer.id)}><span className="transfer-mark"><ArrowRight size={18} /></span><span className="transfer-main"><strong>{amount(transfer.raw, transfer.decimals)} <small>{transfer.mint ? short(transfer.mint, 4, 4) : "SOL"}</small></strong><span>{short(transfer.sourceOwner || transfer.source)} <ArrowRight size={12} /> {short(transfer.destinationOwner || transfer.destination)}</span></span><span className="transfer-id">#{transfer.instruction}</span></button>) : <div className="empty-list">No supported transfer instructions were decoded. Check balance changes and the Solana Explorer for the full transaction.</div>}</div><div className="section-head balance-head"><div><span className="section-kicker">03 / ACCOUNT DELTAS</span><h3>Balance changes</h3></div><span className="section-hint">EXACT RAW VALUES FROM RPC</span></div><div className="balance-table">{result.balances.length ? result.balances.map((balance) => <button key={balance.id} onClick={() => void inspectAddress(balance.owner || balance.address)}><span className="balance-address">{short(balance.owner || balance.address)}<small>{balance.mint ? `TOKEN Â· ${short(balance.mint, 4, 4)}` : "SOL"}</small></span><strong className={balance.raw.startsWith("-") ? "negative" : "positive"}>{balance.raw.startsWith("-") ? "" : "+"}{amount(balance.raw, balance.decimals)}</strong><ArrowUpRight size={14} /></button>) : <div className="empty-list">No account balance changes recorded.</div>}</div></div>
          <aside className="workspace-side"><div className="side-card narrative"><span className="section-kicker"><Sparkles size={14} /> {result.ai ? "AI / EVIDENCE BRIEF" : "EVIDENCE BRIEF"}</span><h3>What happened?</h3>{result.ai ? <><p>{result.ai.summary}</p><div className="claims">{result.ai.claims.map((claim, index) => <div key={index}><span>0{index + 1}</span><p>{claim.text}</p><small>PROOF: {claim.evidenceIds.map((id) => <button key={id} onClick={() => { const item = document.getElementById(id) as HTMLDetailsElement | null; if (item) { item.open = true; item.scrollIntoView({ behavior: "smooth", block: "center" }); } }}>{id}</button>)}</small></div>)}</div>{result.ai.limitations.length > 0 && <div className="limit-note"><CircleAlert size={15} />{result.ai.limitations.join(" ")}</div>}<small className="model-note">Generated by {result.ai.model}. Verify every claim below.</small></> : <><p>This {result.success ? "successful" : "failed"} transaction has {result.transfers.length} decoded transfer{result.transfers.length === 1 ? "" : "s"} and {result.balances.length} recorded balance change{result.balances.length === 1 ? "" : "s"}. The execution fee was {amount(result.fee, 9)} SOL.</p><div className="limit-note"><CircleAlert size={15} />A full account history is not inferred from one transaction. Select an account to inspect its recent activity.</div>{aiError && <div className="ai-error">AI: {aiError}</div>}<button className="enable-ai" onClick={() => { setShowKey(true); window.scrollTo({ top: 280, behavior: "smooth" }); }}><Sparkles size={15} /> Enable AI narrative <ArrowRight size={14} /></button></>}</div><div className="side-card evidence-card"><span className="section-kicker"><ShieldCheck size={14} /> VERIFIABLE EVIDENCE</span><h3>Source records</h3><div className="evidence-list">{result.evidence.map((item) => <details key={item.id} id={item.id}><summary><span className="proof-icon">{item.kind === "transfer" ? <ArrowRight size={14} /> : item.kind === "balance" ? <Activity size={14} /> : <Check size={14} />}</span><span><strong>{item.label}</strong><small>{item.id}</small></span><ChevronRight size={14} /></summary><p>{item.detail}</p></details>)}</div><a className="raw-link" href={txUrl(result.network, result.signature)} target="_blank" rel="noreferrer">Inspect raw transaction <ExternalLink size={14} /></a></div><div className="side-card limits-card"><span className="section-kicker">ANALYSIS BOUNDARY</span><p>{result.unresolvedInstructions} instruction{result.unresolvedInstructions === 1 ? "" : "s"} could not be fully decoded. Transfers are derived from parsed instructions; balances are computed from RPC pre/post values. Account ownership and intent are not inferred.</p></div></aside></div>
      </section>}
    </main><footer><div className="footer-brand"><span className="brand-symbol"><Activity size={17} /></span> CHAINSCENE <span>Â© 2026</span></div><span>TRANSPARENT BY DESIGN Â· BUILT ON SOLANA</span><a href="https://solana.com/docs/rpc/http/gettransaction" target="_blank" rel="noreferrer">DATA SOURCE <ArrowUpRight size={13} /></a></footer>
    {selectedAddress && <div className="drawer-backdrop" onMouseDown={() => setSelectedAddress(null)}><aside className="history-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="section-kicker">ACCOUNT / RECENT ACTIVITY</span><h3>Follow the account</h3></div><button aria-label="Close account history" onClick={() => setSelectedAddress(null)}><X size={21} /></button></div><div className="drawer-address"><code>{selectedAddress}</code><a href={accountUrl(network, selectedAddress)} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a></div><p className="drawer-note">Latest 12 finalized transactions referencing this account. Activity here does not prove these transactions are part of the same event.</p>{historyLoading ? <div className="drawer-loading"><LoaderCircle className="spin" size={23} /> Fetching account history...</div> : historyError ? <div className="error-bar"><CircleAlert size={17} />{historyError}</div> : <div className="history-list">{history?.map((item) => <button key={item.signature} onClick={() => { setSelectedAddress(null); void run(item.signature, network); window.scrollTo({ top: 600, behavior: "smooth" }); }}><span className={item.failed ? "history-failed" : "history-ok"}>{item.failed ? "Ã—" : <Check size={15} />}</span><span><strong>{short(item.signature, 9, 9)}</strong><small>{date(item.blockTime)} Â· Slot {item.slot.toLocaleString()}</small></span><Play size={14} /></button>)}{history?.length === 0 && <p>No recent history returned by RPC.</p>}</div>}</aside></div>}
  </div>;
}

