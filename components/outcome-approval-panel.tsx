"use client";
import { useEffect, useState, type FormEvent } from "react";
import { approvedExport, outcomeStatus, type OutcomeVersion, type OutcomeDecision } from "@/lib/outcome-approval";

type Summary=Pick<OutcomeVersion,"id"|"version_no"|"submitted_by"|"created_at"|"digest">;
const input="mt-2 w-full rounded-xl border border-white/15 bg-[#0c1b13] px-3 py-2 text-sm text-white outline-none focus:border-emerald-200/60";
const button="min-h-11 rounded-xl border border-emerald-200/30 px-4 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40";
export function OutcomeApprovalPanel({topicId}:{topicId:string}) {
  const [versions,setVersions]=useState<Summary[]>([]);
  const [eligible,setEligible]=useState<{id:string;title:string}[]>([]);
  const [viewer,setViewer]=useState("");
  const [version,setVersion]=useState<OutcomeVersion|null>(null);
  const [decisions,setDecisions]=useState<OutcomeDecision[]>([]);
  const [findings,setFindings]=useState<string[]>([]);
  const [methodology,setMethodology]=useState(""),[limitations,setLimitations]=useState(""),[recommendations,setRecommendations]=useState(""),[openQuestions,setOpenQuestions]=useState("");
  const [verdict,setVerdict]=useState<OutcomeDecision["verdict"]>("CHANGES_REQUESTED");
  const [rationale,setRationale]=useState(""),[attested,setAttested]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const endpoint="/api/topics/"+encodeURIComponent(topicId)+"/outcome-approval";
  async function load(id?:string) {
    setLoading(true);setError("");setVersion(null);setDecisions([]);setAttested(false);setRationale("");
    try{
      const res=await fetch(endpoint,{cache:"no-store"}),p=await res.json();
      if(!res.ok||!Array.isArray(p.versions)||!Array.isArray(p.eligible))throw Error(p.error||"Outcome record unavailable.");
      setVersions(p.versions);setEligible(p.eligible);setViewer(p.viewerId);
      setFindings(f=>f.filter(i=>p.eligible.some((a:{id:string})=>a.id===i)));
      const selected=id??p.versions[0]?.id;
      if(selected){
        const response=await fetch(endpoint+"?version="+encodeURIComponent(selected),{cache:"no-store"}),detail=await response.json();
        if(!response.ok||!detail.version||!Array.isArray(detail.decisions))throw Error(detail.error||"Frozen version unavailable.");
        setVersion(detail.version);setDecisions(detail.decisions);
      }
    }catch(e){setError(e instanceof Error?e.message:"Outcome record unavailable.");}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[topicId]);
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy||loading||error)return;setBusy(true);setMessage("");
    try{
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",methodology,limitations,recommendations,openQuestions,findingIds:findings})});
      const p=await res.json();if(!res.ok||!p.version)throw Error(p.error||"Could not submit outcome.");
      await load(p.version.id);setMessage("Frozen version submitted for independent review.");
    }catch(e){setMessage(e instanceof Error?e.message:"Submission failed.");}finally{setBusy(false);}
  }
  async function review(event:FormEvent) {
    event.preventDefault();if(!version||busy||loading||error||!attested)return;setBusy(true);setMessage("");
    try{
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review",versionId:version.id,digest:version.digest,verdict,rationale,attested})});
      const p=await res.json();if(!res.ok||!p.decision)throw Error(p.error||"Could not record decision.");
      await load(version.id);setMessage("Review decision recorded for this exact version.");
    }catch(e){setMessage(e instanceof Error?e.message:"Review failed.");}finally{setBusy(false);}
  }
  function download() {
    if(!version||error||loading)return;
    const url=URL.createObjectURL(new Blob([approvedExport(version,decisions)],{type:"text/markdown;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="converge-outcome-v"+version.version_no+"-"+version.id+".md";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  const status=version?outcomeStatus(version,decisions):null;
  const own=!!version&&(!version.submitted_by||version.submitted_by===viewer);
  const already=decisions.some(d=>d.reviewer_id===viewer);
  return <section className="mt-5 min-w-0 rounded-2xl border border-emerald-300/20 bg-[#12241a] p-4 sm:p-6" aria-labelledby="outcome-approval-heading">
    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-200/75">VERSIONED RESEARCH OUTCOMES</p>
    <h3 id="outcome-approval-heading" className="mt-1 text-xl font-semibold">Submit and independently approve an outcome</h3>
    <p className="mt-2 text-sm leading-6 text-white/60">Freeze a reviewed investigation, select supported findings, and record limitations and recommendations. Approval applies only to the exact submitted version. A request for changes requires a new version.</p>
    <button type="button" className={button+" mt-3"} disabled={loading||busy} onClick={()=>void load(version?.id)}>Refresh outcome records</button>
    {loading&&<p role="status" className="mt-3 text-xs text-white/65">Loading outcome records…</p>}
    {error&&<p role="alert" className="mt-3 text-xs text-amber-100">{error}</p>}
    <details className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4" open={versions.length===0?true:undefined}>
      <summary className="cursor-pointer text-sm font-semibold">Prepare a new version</summary>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <fieldset disabled={loading||busy||Boolean(error)} className="space-y-3 disabled:opacity-60">
          <legend className="text-xs font-semibold text-emerald-200">Select proposed findings</legend>
          <p className="text-xs text-white/55">Only claims with explicit supporting passages and a current independent supported review are eligible. Contradictions and other claims remain in the frozen record.</p>
          {!eligible.length&&<p className="rounded-lg border border-amber-200/20 p-3 text-xs text-amber-100">No eligible findings yet. Complete independent claim review first.</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">{eligible.map(a=><label key={a.id} className="flex items-start gap-2 rounded-lg border border-white/10 p-2 text-xs"><input type="checkbox" className="mt-1 accent-emerald-300" checked={findings.includes(a.id)} onChange={e=>setFindings(f=>e.target.checked?[...f,a.id].slice(0,50):f.filter(i=>i!==a.id))}/><span className="break-words">{a.title}</span></label>)}</div>
          {([{label:"Methodology",value:methodology,set:setMethodology},{label:"Limitations and disagreements",value:limitations,set:setLimitations},{label:"Recommendations",value:recommendations,set:setRecommendations},{label:"Open questions",value:openQuestions,set:setOpenQuestions}]).map(f=><label key={f.label} className="block text-xs font-semibold text-white/70">{f.label}<textarea className={input} value={f.value} rows={3} minLength={10} maxLength={6000} required onChange={e=>f.set(e.target.value)}/></label>)}
          <button type="submit" className={button} disabled={!findings.length||[methodology,limitations,recommendations,openQuestions].some(s=>s.trim().length<10)}>Freeze and submit for review</button>
        </fieldset>
      </form>
    </details>
    {versions.length>0&&<div className="mt-5 space-y-3">
      <label className="block text-xs font-semibold text-white/70">Submitted versions<select disabled={loading||busy} className={input} value={version?.id??""} onChange={e=>void load(e.target.value)}><option value="" disabled>Select version</option>{versions.map(v=><option key={v.id} value={v.id}>Version {v.version_no} · {new Date(v.created_at).toLocaleString()}</option>)}</select></label>
      {version&&!error&&<article className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Frozen version {version.version_no}</h4><span className="text-xs font-semibold text-emerald-200">{status?.replaceAll("_"," ")}</span></div>
        <p className="mt-2 text-xs text-white/55">Submitted {new Date(version.created_at).toLocaleString()} · {version.submitted_by??"deleted account"}</p>
        <p className="mt-1 break-all text-[10px] text-white/50">SHA-256: {version.digest}</p>
        <p className="mt-2 text-xs text-white/60">This version is independent of subsequent edits to the live workspace. One independent approval is sufficient in this release unless a reviewer requests changes; this does not represent unanimous agreement or source certification.</p>
        <details className="mt-3 rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-xs font-semibold">Read full frozen report</summary><pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-white/75">{version.report}</pre></details>
        <button className={button+" mt-3"} type="button" onClick={download} disabled={loading||busy}>Download version with review history</button>
        <h5 className="mt-4 text-xs font-semibold">Recorded decisions</h5>
        {decisions.length===0&&<p className="mt-2 text-xs text-white/50">Awaiting independent review.</p>}
        {decisions.map(d=><div key={d.id} className="mt-2 rounded-lg border border-white/10 p-3 text-xs"><p className="font-semibold">{d.verdict.replaceAll("_"," ")}</p><p className="mt-1 break-all text-white/50">{d.reviewer_id??"deleted account"} · {new Date(d.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap break-words">{d.rationale}</p></div>)}
        {own?<p className="mt-3 text-xs text-amber-100">The submitting researcher cannot approve their own version.</p>:already?<p className="mt-3 text-xs text-white/55">Your decision is recorded. Revisions require a new version.</p>:<form onSubmit={review} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <label className="block text-xs">Review verdict<select className={input} value={verdict} onChange={e=>{setVerdict(e.target.value as OutcomeDecision["verdict"]);setAttested(false);}}><option value="CHANGES_REQUESTED">Request changes</option><option value="APPROVED">Approve this frozen version</option></select></label>
          <label className="block text-xs">Review reasoning (40–3,000 characters)<textarea className={input} rows={4} value={rationale} onChange={e=>{setRationale(e.target.value);setAttested(false);}} minLength={40} maxLength={3000} required/></label>
          <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1 accent-emerald-300" required checked={attested} onChange={e=>setAttested(e.target.checked)}/>I read this frozen report, examined the evidence and limitations, and record my own decision for this version.</label>
          <button type="submit" className={button} disabled={busy||loading||!attested||rationale.trim().length<40}>Record independent decision</button>
        </form>}
      </article>}
    </div>}
    {message&&<p role="status" className="mt-3 text-xs text-emerald-100">{message}</p>}
  </section>;
}
