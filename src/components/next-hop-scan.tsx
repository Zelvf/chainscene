"use client";

import { useState } from "react";
import { ArrowRight, CircleAlert, GitBranch, LoaderCircle, Play } from "lucide-react";
import type { Investigation, TraceResult } from "@/lib/types";

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-6)}`;
function amount(raw: string, decimals: number | null) {
  if (decimals === null) return `${raw} raw units`;
  const value = raw.padStart(decimals + 1, "0");
  const integer = decimals ? value.slice(0, -decimals) : value;
  const fraction = decimals ? value.slice(-decimals).replace(/0+$/, "") : "";
  return `${BigInt(integer).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function NextHopScan({ result, onInvestigate }: { result: Investigation; onInvestigate: (signature: string) => void }) {
  const [scan, setScan] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true); setError(null); setScan(null);
    try {
      const response = await fetch("/api/trace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature: result.signature, network: result.network }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The scan failed.");
      setScan(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The scan failed."); }
    finally { setLoading(false); }
  }

  return <div className="next-scan"><div className="next-scan-head"><div><span className="section-kicker">04 / BOUNDED FOLLOW-UP</span><h3>What happened next?</h3><p>Search nearby finalized activity from accounts that received value in this transaction.</p></div><button disabled={loading || result.transfers.length === 0} onClick={() => void start()}>{loading ? <LoaderCircle className="spin" size={16} /> : <GitBranch size={16} />}{loading ? "SCANNING" : "SCAN NEXT HOPS"}</button></div>
    {error && <div className="scan-error"><CircleAlert size={16} />{error}</div>}
    {scan && <><div className="scan-summary"><strong>{scan.hops.length}</strong> possible continuation{scan.hops.length === 1 ? "" : "s"} found <span>· {scan.accountsChecked} accounts · {scan.transactionsChecked} transactions checked</span></div>{scan.hops.length ? <div className="hop-list">{scan.hops.map((hop, index) => <button key={`${hop.signature}-${index}`} onClick={() => onInvestigate(hop.signature)}><span className="hop-index">{String(index + 1).padStart(2, "0")}</span><span className="hop-main"><strong>{amount(hop.raw, hop.decimals)} {hop.mint ? short(hop.mint) : "SOL"}</strong><small>{short(hop.fromAccount)} <ArrowRight size={12} /> {short(hop.toAccount)}</small><em>Later transaction: {short(hop.signature)} · Slot {hop.slot.toLocaleString()}</em></span><Play size={16} /></button>)}</div> : <p className="scan-empty">No later outgoing transfer was found within the scan limit.</p>}<p className="scan-note"><CircleAlert size={14} />{scan.note}</p></>}
  </div>;
}
