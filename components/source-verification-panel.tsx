"use client";
import { useState, type FormEvent } from "react";
import type { EvidenceEdge, ResearchArtifact } from "@/lib/research-outcome";
import { sourceUrl, duplicateSources, verificationIsCurrent, type SourceVerification, type SourceVerdict } from "@/lib/source-verification";

const input = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#0c1b13] px-3 py-2 text-sm text-white outline-none focus:border-emerald-200/60";
const labels = { ORIGIN_CHECKED: "Origin inspected by reviewer", QUESTIONABLE: "Questionable or disputed", UNREACHABLE: "Unable to inspect" };
type Props = { topicId: string; participantId: string; artifacts: ResearchArtifact[]; edges: EvidenceEdge[]; events: SourceVerification[]; loading: boolean; error: string; onRefresh: () => Promise<void> };
export function SourceVerificationPanel({ topicId, participantId, artifacts, edges, events, loading, error, onRefresh }: Props) {
  const sources = artifacts.filter(a => a.artifact_type === "SOURCE" || a.artifact_type === "EVIDENCE");
  const [selected, setSelected] = useState("");
  const source = sources.find(a => a.id === selected) ?? sources[0];
  const [selectedEdge, setSelectedEdge] = useState("");
  const sourceEdges = edges.filter(e => e.evidence_artifact_id === source?.id);
  const edge = sourceEdges.find(e => e.id === selectedEdge);
  const [verdict, setVerdict] = useState<SourceVerdict>("QUESTIONABLE");
  const [publisher, setPublisher] = useState("");
  const [date, setDate] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [rationale, setRationale] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const own = source?.created_by_participant_id === participantId;
  const currentEvents = source ? events.filter(e => e.source_artifact_id === source.id) : [];
  const inspected = sources.filter(a => events.some(e => e.verdict === "ORIGIN_CHECKED" && !e.edge_id && verificationIsCurrent(e,a,edges))).length;
  const linkedChecked = edges.filter(edge => events.some(e => e.edge_id === edge.id && e.quote_match === true && e.verdict === "ORIGIN_CHECKED" && sources.some(a => verificationIsCurrent(e,a,edges)))).length;
  const originalUrl = url || sourceUrl(source?.provenance?.source_url) || "";
  function reset() { setSelectedEdge(""); setPublisher(""); setDate(""); setUrl(""); setExcerpt(""); setRationale(""); setAttested(false); setVerdict("QUESTIONABLE"); setMessage(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source || own || busy || loading || error) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/topics/" + encodeURIComponent(topicId) + "/source-verification", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({sourceId:source.id,edgeId:edge?.id ?? "",verdict,publisher,publicationDate:date,originalUrl,excerpt:edge ? excerpt : "",rationale,attested}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.verification) throw new Error(result?.error || "Unable to save verification.");
      reset(); await onRefresh();
      setMessage("Assessment saved. This is a human attestation, not independent automated retrieval.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save verification."); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 min-w-0 rounded-2xl border border-emerald-300/20 bg-[#12241a] p-4 sm:p-6" aria-labelledby="source-verification-heading">
    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-200/75">SOURCE VERIFICATION ENGINE</p>
    <h3 id="source-verification-heading" className="mt-1 text-xl font-semibold">Inspect original sources</h3>
    <p className="mt-2 text-sm leading-6 text-white/60">A separate human researcher can examine the original publication, document its origin and compare a linked quotation with an excerpt they personally inspected. An origin check does not establish the truth of a claim.</p>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
      <span className="rounded-lg border border-white/10 px-3 py-2">{inspected}/{sources.length} sources with an origin-check record</span>
      <span className="rounded-lg border border-white/10 px-3 py-2">{linkedChecked}/{edges.length} passages with a matching recorded excerpt</span>
      <button type="button" onClick={() => void onRefresh()} disabled={loading || busy} className="min-h-10 rounded-lg border border-white/15 px-3 text-emerald-200 disabled:opacity-50">Refresh verification history</button>
    </div>
    {loading && <p role="status" className="mt-3 text-xs">Loading verification history…</p>}
    {error && <p role="alert" className="mt-3 text-xs text-amber-100">{error} Verification status is unavailable.</p>}
    {!source ? <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">Add a Source or Evidence artifact in Research Materials first.</p> : <>
      <label className="mt-5 block text-xs font-semibold">Source to assess
        <select className={input} value={source.id} disabled={busy} onChange={e => {setSelected(e.target.value);reset();}}>
          {sources.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </label>
      <div className="mt-3 space-y-2 rounded-xl border border-white/10 p-3 text-xs text-white/65">
        <a href={"#research-artifact-"+source.id} className="text-emerald-200 underline">Inspect saved artifact</a>
        {sourceUrl(source.provenance?.source_url) && <a href={sourceUrl(source.provenance?.source_url)!} target="_blank" rel="noopener noreferrer" className="block break-all text-emerald-200 underline">Open recorded reference ↗</a>}
        {source.provenance?.generated && <p className="text-amber-100">AI-generated material — never presume an AI reference is authentic.</p>}
        {duplicateSources(source, artifacts).length > 0 && <p className="text-amber-100">Potential duplicate URL: {duplicateSources(source,artifacts).map(a=>a.title).join(", ")}. These records are not independent corroboration.</p>}
        {own && <p className="text-amber-100">You authored this source. Invite a different human participant to assess it.</p>}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
        <fieldset disabled={busy || own || loading || Boolean(error)} className="space-y-3 disabled:opacity-60">
          <label className="block text-xs">Assessment scope
            <select className={input} value={edge?.id ?? ""} onChange={e=>{setSelectedEdge(e.target.value);setExcerpt("");setAttested(false);}}>
              <option value="">Publication origin only</option>
              {sourceEdges.map(e=><option key={e.id} value={e.id}>{e.relation}: {e.passage.slice(0,80)}</option>)}
            </select>
          </label>
          {edge && <blockquote className="break-words rounded-lg border border-white/10 p-3 text-xs text-white/65">{edge.passage}<p className="mt-2">Locator: {edge.locator || "not recorded"}</p></blockquote>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">Original publication or reference URL<input className={input} type="url" required maxLength={2048} value={originalUrl} onChange={e=>setUrl(e.target.value)} /></label>
            <label className="block text-xs">Publisher or responsible institution<input className={input} maxLength={200} required={verdict==="ORIGIN_CHECKED"} value={publisher} onChange={e=>setPublisher(e.target.value)} /></label>
            <label className="block text-xs">Publication date (if known)<input className={input} maxLength={100} value={date} onChange={e=>setDate(e.target.value)} /></label>
            <label className="block text-xs">Reviewer assessment<select className={input} value={verdict} onChange={e=>{setVerdict(e.target.value as SourceVerdict);setAttested(false);}}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          {edge && <label className="block text-xs">Excerpt copied from the original publication (up to 8,000 characters)<textarea className={input} rows={4} maxLength={8000} required={verdict==="ORIGIN_CHECKED"} value={excerpt} onChange={e=>{setExcerpt(e.target.value);setAttested(false);}} /></label>}
          <label className="block text-xs">Explain the origin, credibility, limitations or reason it could not be inspected (40–3,000 characters)<textarea className={input} rows={4} required minLength={40} maxLength={3000} value={rationale} onChange={e=>setRationale(e.target.value)} /></label>
          {verdict==="ORIGIN_CHECKED" && <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={attested} required onChange={e=>setAttested(e.target.checked)} className="mt-1 accent-emerald-300"/>I personally inspected the original reference and accurately transcribed any submitted excerpt.</label>}
          <button type="submit" disabled={rationale.trim().length<40 || (verdict==="ORIGIN_CHECKED" && !attested)} className="min-h-11 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-[#0b1710] disabled:opacity-45">{busy?"Saving…":"Record source assessment"}</button>
        </fieldset>
      </form>
      <h4 className="mt-5 text-sm font-semibold">Assessment history</h4>
      {currentEvents.length === 0 && <p className="mt-2 text-xs text-white/50">No source assessment recorded.</p>}
      <div className="mt-3 space-y-2">{currentEvents.map(e=><article key={e.id} className="min-w-0 rounded-lg border border-white/10 p-3 text-xs text-white/70">
        <p className="font-semibold text-emerald-200">{labels[e.verdict]} · {verificationIsCurrent(e,source,edges)?"Current snapshot":"Historical snapshot — material changed"}</p>
        <p className="mt-1">{new Date(e.created_at).toLocaleString()} · Reviewer: {e.reviewer_id ?? "deleted account"}</p>
        <p className="mt-1 break-words">{e.publisher || "Publisher not recorded"} · {e.publication_date || "Date not recorded"}</p>
        <a className="mt-1 block break-all underline" href={sourceUrl(e.original_url) ?? undefined} target="_blank" rel="noopener noreferrer">Original reference ↗</a>
        <p className="mt-2 whitespace-pre-wrap break-words">{e.rationale}</p>
        {e.edge_id && <details className="mt-2"><summary>Passage check: {e.quote_match === null?"not checked":e.quote_match?"matches submitted excerpt":"does not match submitted excerpt"}</summary><p className="mt-2 break-words">Saved passage: {e.snapshot.passage}</p><p className="mt-2 whitespace-pre-wrap break-words">Submitted excerpt: {e.original_excerpt}</p></details>}
      </article>)}</div>
    </>}
    {message && <p role="status" className="mt-4 text-xs text-amber-100">{message}</p>}
  </section>;
}
