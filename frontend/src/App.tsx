// Even Hand (even-hand) - family, realigned from the prior emerald.
// Off-white canvas, deep navy ink, violet primary. Two-party semantic = violet(buyer)/navy(seller).
// The split bar is the signature motivated animation. Newsreader display + Inter body + IBM Plex Mono
// figures. Zero em-dashes. Real contract data only (no fabricated rows). Amounts in GEN.
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { motion, useReducedMotion } from "framer-motion";
import { Scales, ShieldCheck, FileText, Gavel, Handshake, ArrowRight, ArrowUpRight, Copy } from "@phosphor-icons/react";
import { FluidParticles } from "./FluidParticles";
import {
  createDispute, submitEvidence, adjudicateSplit, release,
  getCase, getCounts, getPoolBalance, listAll, CaseView, CaseRow,
} from "./contractService";
import { CONTRACT_ADDRESS } from "./chain";

type Hex = `0x${string}`;
const STATUS_LABEL = ["awaiting seller", "ready", "ruled", "settled"];
const EXPLORER = "https://studio.genlayer.com";
function shortAddr(a: string): string { return a && a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a || "-"; }
async function copyText(t: string) { try { await navigator.clipboard.writeText(t); } catch { /* clipboard blocked */ } }
function gen(wei: string): string {
  // wei string from contract storage -> GEN, trimmed. Tabular figures handle alignment.
  if (!wei || wei === "0") return "0";
  try { const v = formatEther(BigInt(wei)); return v.length > 10 ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 }) : v; }
  catch { return "0"; }
}

function SplitBar({ share, verdict, big }: { share: number; verdict: string; big?: boolean }) {
  const reduce = useReducedMotion();
  const ruled = !!verdict;
  const buyer = ruled ? Math.max(0, Math.min(100, share)) : 50;
  return (
    <div className={`splitbar ${big ? "big" : ""} ${ruled ? "" : "pending"}`} role="img" aria-label={ruled ? `Buyer ${buyer}%, seller ${100 - buyer}%` : "Awaiting ruling"}>
      <div className="sb-track">
        <motion.div className="sb-buyer" initial={reduce ? false : { width: "50%" }} animate={{ width: `${buyer}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
        <motion.div className="sb-seller" initial={reduce ? false : { width: "50%" }} animate={{ width: `${100 - buyer}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      {big && (<div className="sb-marks">{ruled ? (<><span className="sb-m buyer">buyer {buyer}%</span><span className={`sb-v v-${verdict}`}>{verdict.replace("_", " ").toLowerCase()}</span><span className="sb-m seller">seller {100 - buyer}%</span></>) : (<span className="sb-await">awaiting ruling</span>)}</div>)}
    </div>
  );
}

export function App() {
  const { address, isConnected } = useAccount();
  const acct = address as Hex | undefined;
  const reduce = useReducedMotion();

  const [seller, setSeller] = useState("");
  const [listing, setListing] = useState("");
  const [buyerEvidence, setBuyerEvidence] = useState("");
  const [escrow, setEscrow] = useState("");
  const [sellerEvidence, setSellerEvidence] = useState("");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [counts, setCounts] = useState({ next: 0, ruled: 0, settled: 0 });
  const [pool, setPool] = useState("0");
  const [selId, setSelId] = useState<number | null>(null);
  const [sel, setSel] = useState<CaseView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [netErr, setNetErr] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refreshAll() {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const [c, p, l] = await Promise.all([getCounts(), getPoolBalance(), listAll(50)]);
      setCounts(c); setPool(p); setRows(l);
      if (selId != null) { try { setSel(await getCase(selId)); } catch { /* keep */ } }
      setNetErr(false);
    } catch { setNetErr(true); } finally { setLoading(false); }
  }
  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, 12000);
    const onVis = () => { if (!document.hidden) refreshAll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  async function pick(id: number) { setSelId(id); try { setSel(await getCase(id)); } catch { setSel(null); } }
  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> { setBusy(label); setNote(""); try { return await fn(); } catch (e) { setNote(String((e as Error).message || e).slice(0, 220)); return undefined; } finally { setBusy(null); refreshAll(); } }
  async function onCreate() {
    if (!acct) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(seller.trim())) return setNote("Seller must be a 0x address.");
    if (listing.trim().length < 25) return setNote("Listing terms: at least 25 characters.");
    if (buyerEvidence.trim().length < 25) return setNote("Buyer evidence: at least 25 characters.");
    if (!escrow.trim() || !(Number(escrow) > 0)) return setNote("Escrow amount in GEN is required.");
    const id = await run("Opening the dispute, escrowing funds", () => createDispute(acct, { seller, listing, buyerEvidence, escrowWei: parseEther(escrow) }).then(async (newId) => newId));
    if (id != null) { setSelId(id); setSeller(""); setListing(""); setBuyerEvidence(""); setEscrow(""); setNote(`Dispute #${id} opened. The seller can now answer.`); }
  }
  async function onSubmitEvidence() { if (!acct || selId == null) return; if (sellerEvidence.trim().length < 25) return setNote("Seller evidence: at least 25 characters."); await run("Submitting seller evidence", () => submitEvidence(acct, selId, sellerEvidence)); setSellerEvidence(""); }
  async function onAdjudicate() { if (!acct || selId == null) return; await run("Validators weighing both sides", () => adjudicateSplit(acct, selId)); }
  async function onRelease() { if (!acct || selId == null) return; await run("Releasing the escrow split", () => release(acct, selId)); }

  const settleRate = useMemo(() => counts.ruled > 0 ? Math.round((counts.settled / counts.ruled) * 100) : 0, [counts]);
  const latest = rows[0];

  return (
    <div className="evenhand">
      <header className="nav">
        <div className="brand"><Scales weight="duotone" className="brand-ic" /><span className="wm">Even Hand</span><em className="brand-tag">escrow arbitration · on GenLayer</em></div>
        <div className="nav-r">
          <span className="live"><span className={`live-dot ${netErr ? "err" : ""}`} />{netErr ? "reconnecting" : "studionet live"}</span>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
        </div>
      </header>

      <section className="hero">
        <FluidParticles />
        <div className="hero-l">
          <p className="eyebrow">On-chain escrow arbitration</p>
          <h1>When a deal goes sideways, split it fairly.</h1>
          <p className="lede">Even Hand holds the disputed funds in escrow. Both sides submit their evidence, a panel of GenLayer validators weighs the listing against each claim, and the escrow is split by how much each party is actually owed.</p>
          <div className="cta">
            <a className="btn-primary" href="#desk">Open a dispute <ArrowRight weight="bold" /></a>
            <a className="btn-ghost" href="#how">How it works</a>
          </div>
          <div className="hero-meta">
            <button type="button" className="contract" onClick={() => copyText(CONTRACT_ADDRESS)} aria-label="Copy contract address"><Copy weight="regular" /> {shortAddr(CONTRACT_ADDRESS)}</button>
            <a className="explorer" href={EXPLORER} target="_blank" rel="noreferrer noopener">view on explorer <ArrowUpRight weight="bold" /></a>
          </div>
        </div>
        <div className="hero-r">
          <div className="balance-card">
            <div className="bc-head"><span className="bc-buyer">Buyer</span><span className="bc-seller">Seller</span></div>
            <SplitBar share={latest ? latest.buyerShare : 50} verdict={latest ? latest.verdict : ""} big />
            <p className="bc-note">{latest ? "Live split from the most recent ruling. Funds follow the evidence, not the loudest party." : "No rulings yet. The split bar fills the moment validators rule the first dispute."}</p>
            <p className="bc-cap">read directly from contract storage</p>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="metric"><span className="m-num">{counts.next}</span><span className="m-cap">disputes opened</span></div>
        <div className="metric"><span className="m-num">{counts.ruled}</span><span className="m-cap">adjudicated</span></div>
        <div className="metric"><span className="m-num">{settleRate}%</span><span className="m-cap">of rulings settled</span></div>
        <div className="metric"><span className="m-num">{gen(pool)}</span><span className="m-cap">fee pool (GEN)</span></div>
      </section>

      <section className="how" id="how">
        <h2 className="how-title">Four steps, no single reviewer.</h2>
        <div className="how-grid">
          {[
            { Ic: FileText, t: "Open the dispute", d: "The buyer escrows the disputed amount and files the listing terms plus their account of what went wrong." },
            { Ic: Handshake, t: "Seller answers", d: "The named seller submits their rebuttal and supporting evidence. Both accounts are stored on-chain." },
            { Ic: Gavel, t: "Validators weigh", d: "GenLayer validators read the listing against both sides and agree on the buyer's fair share within a tolerance." },
            { Ic: ShieldCheck, t: "Escrow splits", d: "Funds are released by the ruling. A small fee is charged only to the losing side; an even split charges nothing." },
          ].map((s, i) => (
            <motion.article key={i} className="how-card" initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.5, delay: i * 0.07 }}>
              <s.Ic weight="duotone" className="how-ic" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.article>
          ))}
        </div>
        <p className="prov">Source: on-chain listing and both parties' accounts, judged by GenLayer validators via <code>gl.nondet.exec_prompt</code>, who must agree on the buyer share within 15 points.</p>
      </section>

      <section className="desk" id="desk">
        <div className="desk-main">
          <div className="desk-h"><h2>Dispute ledger</h2><span className="desk-cap">{rows.length} on-chain</span></div>
          {loading ? (
            <div className="skel-wrap">{[0, 1, 2].map((i) => (<div key={i} className="skel" />))}</div>
          ) : rows.length === 0 ? (
            <div className="empty"><Scales weight="duotone" /><h3>No disputes yet.</h3><p>Open the first one to escrow funds on-chain and start a ruling.</p></div>
          ) : (
            <div className="cases">
              {rows.map((r, i) => (
                <motion.button key={r.id} className={`case ${selId === r.id ? "sel" : ""}`} onClick={() => pick(r.id)}
                  initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.45, delay: Math.min(i, 6) * 0.05 }}
                  aria-label={`Dispute ${r.id}, ${(r.verdict || "pending").toLowerCase()}`}>
                  <div className="case-top"><span className="case-id">Dispute {r.id}</span><span className={`tag v-${r.verdict || "none"}`}>{(r.verdict || "pending").replace("_", " ").toLowerCase()}</span></div>
                  <p className="case-listing">{r.listing}</p>
                  <SplitBar share={r.buyerShare} verdict={r.verdict} />
                  <div className="case-meta"><span>{STATUS_LABEL[r.status]}</span><span className="case-escrow">{gen(r.escrow)} GEN</span></div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <aside className="panel">
          {sel && selId != null ? (
            <div className="card">
              <h3>Dispute {selId}</h3>
              <SplitBar share={sel.buyerShare} verdict={sel.verdict} big />
              <div className="kv"><span>escrow</span><code>{gen(sel.escrow)} GEN</code></div>
              <div className="kv"><span>status</span><b>{STATUS_LABEL[sel.status]}</b></div>
              <p className="card-listing">{sel.listing}</p>
              {sel.buyerEvidence && <div className="ev"><span>Buyer</span><p>{sel.buyerEvidence}</p></div>}
              {sel.sellerEvidence && <div className="ev seller"><span>Seller</span><p>{sel.sellerEvidence}</p></div>}
              {sel.rationale && <div className="ev ruling"><span>Ruling</span><p>{sel.rationale}</p></div>}
              {sel.status === 0 && (<><label>Seller evidence</label><textarea value={sellerEvidence} onChange={(e) => setSellerEvidence(e.target.value)} placeholder="The seller's rebuttal and supporting facts." /><button className="btn-primary full" disabled={!isConnected || !!busy} onClick={onSubmitEvidence}>Submit seller evidence</button></>)}
              {sel.status === 1 && <button className="btn-primary full" disabled={!isConnected || !!busy} onClick={onAdjudicate}>Adjudicate the split</button>}
              {sel.status === 2 && <button className="btn-primary full" disabled={!isConnected || !!busy} onClick={onRelease}>Release the escrow</button>}
              {sel.status === 3 && <p className="settled">Settled. Funds released by the ruling.</p>}
              <button type="button" className="deselect" onClick={() => { setSelId(null); setSel(null); }}>Open a new dispute instead</button>
            </div>
          ) : (
            <div className="card">
              <h3>Open a dispute</h3>
              <label>Seller address</label>
              <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x..." />
              <label>Listing terms</label>
              <textarea value={listing} onChange={(e) => setListing(e.target.value)} placeholder="What the listing promised: item, condition, guarantees." />
              <label>Your account (buyer)</label>
              <textarea value={buyerEvidence} onChange={(e) => setBuyerEvidence(e.target.value)} placeholder="What actually happened and why you are owed." />
              <label>Escrow amount (GEN)</label>
              <input value={escrow} onChange={(e) => setEscrow(e.target.value)} placeholder="e.g. 1.5" inputMode="decimal" />
              <button className="btn-primary full" disabled={!isConnected || !!busy} onClick={onCreate}>{isConnected ? "Escrow funds and open" : "Connect a wallet to open"}</button>
              <p className="hint">The amount you enter is escrowed on-chain and split by the ruling.</p>
            </div>
          )}
        </aside>
      </section>

      <footer className="foot">
        <span><Scales weight="duotone" /> Even Hand</span>
        <button type="button" className="contract" onClick={() => copyText(CONTRACT_ADDRESS)} aria-label="Copy contract address"><Copy weight="regular" /> {shortAddr(CONTRACT_ADDRESS)}</button>
        <span>Rulings reproduced by independent GenLayer validators on studionet.</span>
      </footer>

      {(busy || note) && <div className="toast">{busy ? `${busy}...` : note}</div>}
    </div>
  );
}
