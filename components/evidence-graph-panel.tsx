"use client";
import { useMemo, useState } from "react";
import { claimGraph, type GraphNode, type GraphRelation } from "@/lib/evidence-graph";
import { reviewSnapshotIsCurrent, type EvidenceEdge, type ResearchArtifact, type ReviewEvent } from "@/lib/research-outcome";
import { verificationIsCurrent, sourceUrl, duplicateSources, type SourceVerification } from "@/lib/source-verification";

type Props = { topicId:string; artifacts:ResearchArtifact[]; edges:EvidenceEdge[]; reviews:ReviewEvent[]; verifications:SourceVerification[]; reviewUnavailable:boolean; verificationUnavailable:boolean };
const styles: Record<GraphRelation,{label:string;color:string;border:string}> = {
  SUPPORTS:{label:"Supports",color:"#86efac",border:"border-emerald-300/45"},
  CONTRADICTS:{label:"Contradicts",color:"#fda4af",border:"border-rose-300/45"},
  CONTEXT:{label:"Context",color:"#93c5fd",border:"border-blue-300/45"},
  ASSOCIATION:{label:"Association only",color:"#cbd5e1",border:"border-white/20"},
  REVIEW:{label:"Human review",color:"#c4b5fd",border:"border-violet-300/45"},
  DECISION:{label:"Recorded decision",color:"#fcd34d",border:"border-amber-300/45"},
  SYNTHESIS:{label:"Human synthesis",color:"#67e8f9",border:"border-cyan-300/45"},
};
const pageSize=6;
export function EvidenceGraphPanel({topicId,artifacts,edges,reviews,verifications,reviewUnavailable,verificationUnavailable}:Props) {
  const claims=artifacts.filter(a=>a.topic_id===topicId && a.artifact_type==="CLAIM");
  const [claimId,setClaimId]=useState("");
  const [filter,setFilter]=useState<"ALL"|GraphRelation>("ALL");
  const [selected,setSelected]=useState("claim");
  const [ePage,setEPage]=useState(0),[oPage,setOPage]=useState(0);
  const claim=claims.find(a=>a.id===claimId)??claims[0];
  const graph=useMemo(()=>claimGraph(topicId,claim?.id??"",artifacts,edges,reviews,verifications),[topicId,claim?.id,artifacts,edges,reviews,verifications]);
  const evidence=graph.evidence.filter(n=>filter==="ALL"||n.relation===filter);
  const outcomes=graph.outcomes.filter(n=>filter==="ALL"||n.relation===filter);
  const ep=Math.min(ePage,Math.max(0,Math.ceil(evidence.length/pageSize)-1));
  const op=Math.min(oPage,Math.max(0,Math.ceil(outcomes.length/pageSize)-1));
  const left=evidence.slice(ep*pageSize,(ep+1)*pageSize),right=outcomes.slice(op*pageSize,(op+1)*pageSize);
  const node=[...left,...right].find(n=>n.id===selected);
  const rows=Math.max(1,left.length,right.length);
  const height=Math.max(220,rows*92+48);
  const middle=height/2;
  const y=(i:number,count:number)=>middle+(i-(count-1)/2)*92;
  function badge(n:GraphNode) {
    if (n.review) return reviewUnavailable?"Review history unavailable":reviewSnapshotIsCurrent(n.review,artifacts,edges)?"Current review snapshot":"Historical review";
    if (!n.artifact || !["SOURCE","EVIDENCE"].includes(n.artifact.artifact_type)) return "Explicit recorded link";
    if (verificationUnavailable) return "Verification history unavailable";
    const active=n.verifications.filter(v=>verificationIsCurrent(v,n.artifact!,edges));
    if (active.some(v=>v.verdict!=="ORIGIN_CHECKED" || v.quote_match===false)) return "Concerns recorded";
    if (active.some(v=>v.verdict==="ORIGIN_CHECKED" && v.edge_id===n.edge?.id && v.quote_match===true)) return "Reviewer excerpt matched";
    if (active.some(v=>v.verdict==="ORIGIN_CHECKED" && !v.edge_id)) return "Origin inspected by reviewer";
    return n.verifications.length?"Historical checks only":"Not yet assessed";
  }
  function renderNode(n:GraphNode,i:number,count:number,side:"left"|"right") {
    const style=styles[n.relation];
    return <button key={n.id} type="button" aria-pressed={selected===n.id} onClick={()=>setSelected(n.id)}
      className={"absolute flex h-[76px] w-[30%] min-w-0 flex-col justify-center rounded-xl border bg-[#11251c] px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-200 "+style.border+(selected===n.id?" ring-2 ring-emerald-200/70":"")}
      style={{top:y(i,count)-38,left:side==="left"?"1%":"69%"}}>
      <span className="truncate text-[10px] font-semibold uppercase tracking-wide" style={{color:style.color}}>{style.label}</span>
      <span className="mt-1 truncate text-xs font-semibold text-white">{n.title}</span>
      <span className="mt-1 truncate text-[10px] text-white/55">{badge(n)}</span>
    </button>;
  }
  function pager(label:string,total:number,page:number,setPage:(n:number)=>void) {
    return <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
      <span>{label}: {total? page*pageSize+1:0}–{Math.min(total,(page+1)*pageSize)} of {total}</span>
      <button type="button" disabled={page===0} onClick={()=>{setPage(page-1);setSelected("claim");}} className="min-h-9 rounded-lg border border-white/15 px-2 disabled:opacity-30">Previous</button>
      <button type="button" disabled={(page+1)*pageSize>=total} onClick={()=>{setPage(page+1);setSelected("claim");}} className="min-h-9 rounded-lg border border-white/15 px-2 disabled:opacity-30">Next</button>
    </div>;
  }
  return <section aria-labelledby="evidence-graph-heading" className="mt-5 min-w-0 rounded-2xl border border-emerald-300/20 bg-[#12241a] p-4 sm:p-6">
    <p className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-200/75">RESEARCH INTELLIGENCE</p>
    <h3 id="evidence-graph-heading" className="mt-1 text-xl font-semibold">Explore the evidence graph</h3>
    <p className="mt-2 text-sm leading-6 text-white/60">Select a claim, then inspect its recorded evidence, counterevidence, independent reviews and linked decisions. Connections are not proof. AI context is never treated as a citation.</p>
    {(reviewUnavailable||verificationUnavailable)&&<p role="status" className="mt-3 rounded-lg border border-amber-200/20 p-3 text-xs text-amber-100">Some review or verification records are unavailable. This graph may be incomplete; do not infer absence of evidence or approval.</p>}
    {!claim?<p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">Add a Claim in Research Materials to start exploring the graph.</p>:<>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-white/70">Claim under investigation<select className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#0c1b13] px-3 text-sm text-white" value={claim.id} onChange={e=>{setClaimId(e.target.value);setSelected("claim");setEPage(0);setOPage(0);}}>
          {claims.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
        <label className="text-xs font-semibold text-white/70">Relationship filter<select className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#0c1b13] px-3 text-sm text-white" value={filter} onChange={e=>{setFilter(e.target.value as "ALL"|GraphRelation);setEPage(0);setOPage(0);setSelected("claim");}}>
          <option value="ALL">All relationships</option>{Object.entries(styles).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/65">
        {(["SUPPORTS","CONTRADICTS","CONTEXT","ASSOCIATION"] as GraphRelation[]).map(r=><span key={r} className="rounded-lg border border-white/10 px-2 py-1" style={{color:styles[r].color}}>{graph.evidence.filter(n=>n.relation===r).length} {styles[r].label}</span>)}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-[#091810] p-2">
        <p className="px-2 py-2 text-[11px] text-white/50">Select a node for its full record. Scroll horizontally on small screens.</p>
        <div tabIndex={0} role="region" aria-label="Scrollable evidence network" className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-emerald-200">
          <div className="relative min-w-[680px] w-full" style={{height}}>
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={"0 0 1000 "+height} preserveAspectRatio="none">
              {[...left.map((n,i)=>({n,from:310,to:355,sy:y(i,left.length),ty:middle})),...right.map((n,i)=>({n,from:645,to:690,sy:middle,ty:y(i,right.length)}))].map(({n,from,to,sy,ty})=><path key={n.id} d={"M "+from+" "+sy+" C "+(from+25)+" "+sy+" "+(to-25)+" "+ty+" "+to+" "+ty} fill="none" stroke={styles[n.relation].color} strokeWidth={selected===n.id?3:1.6} strokeDasharray={n.relation==="ASSOCIATION"?"5 4":undefined} opacity={selected===n.id?1:.65}/>)}
            </svg>
            <button type="button" aria-pressed={!node} onClick={()=>setSelected("claim")} className={"absolute left-[35.5%] w-[29%] h-[92px] rounded-xl border border-emerald-200/65 bg-[#183c2b] px-3 text-left "+(!node?"ring-2 ring-emerald-200/70":"")} style={{top:middle-46}}>
              <span className="block text-[10px] uppercase tracking-wide text-emerald-200">Claim</span><span className="mt-1 block truncate font-semibold">{claim.title}</span><span className="mt-1 block text-[10px] text-white/60">Under investigation</span>
            </button>
            {left.map((n,i)=>renderNode(n,i,left.length,"left"))}{right.map((n,i)=>renderNode(n,i,right.length,"right"))}
            {!left.length&&<p className="absolute left-[1%] w-[30%] text-center text-xs text-white/45" style={{top:middle-8}}>No matching evidence links</p>}
            {!right.length&&<p className="absolute left-[69%] w-[30%] text-center text-xs text-white/45" style={{top:middle-8}}>No matching reviews or outcomes</p>}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-2 pb-2">{pager("Evidence",evidence.length,ep,setEPage)}{pager("Reviews & outcomes",outcomes.length,op,setOPage)}</div>
      </div>
      <div aria-live="polite" className="mt-4 min-w-0 rounded-xl border border-white/10 bg-black/10 p-4">
        <p className="text-[10px] uppercase tracking-wide text-emerald-200">{node?styles[node.relation].label:"Selected claim"}</p>
        <h4 className="mt-1 break-words font-semibold">{node?.title??claim.title}</h4>
        {node?.review?<><p className="mt-2 text-xs text-white/55">{badge(node)} · {new Date(node.review.created_at).toLocaleString()}</p><p className="mt-2 break-words whitespace-pre-wrap text-sm text-white/75">{node.review.rationale}</p><p className="mt-2 text-xs break-all text-white/55">Reviewer: {node.review.reviewer_id??"deleted account"}</p></>:<>
          {node?.edge&&<><blockquote className="mt-3 border-l-2 border-emerald-200/40 pl-3 text-sm break-words whitespace-pre-wrap text-white/75">{node.edge.passage}</blockquote><p className="mt-2 text-xs text-white/55">Locator: {node.edge.locator||"not recorded"}</p>{node.edge.note&&<p className="mt-2 text-xs break-words">{node.edge.note}</p>}</>}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/70">{(node?.artifact??claim).content}</p>
          <a className="mt-3 inline-block text-xs text-emerald-200 underline" href={"#research-artifact-"+(node?.artifact??claim).id}>Open saved material</a>
          {sourceUrl(node?.artifact?.provenance?.source_url)&&<a className="ml-3 inline-block text-xs text-emerald-200 underline" href={sourceUrl(node?.artifact?.provenance?.source_url)!} target="_blank" rel="noopener noreferrer">Open original reference ↗</a>}
          {node?.artifact&&duplicateSources(node.artifact,artifacts).length>0&&<p className="mt-2 text-xs text-amber-100">Potential duplicate source URL; not independent corroboration.</p>}
          {node&&["SUPPORTS","CONTRADICTS","CONTEXT","ASSOCIATION"].includes(node.relation)&&<div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs font-semibold">{badge(node)}</p>
            {node.verifications.map(v=><details key={v.id} className="mt-2 rounded-lg border border-white/10 p-2 text-xs">
              <summary className="cursor-pointer break-words">{v.verdict.replaceAll("_"," ")} · {node.artifact&&verificationIsCurrent(v,node.artifact,edges)?"Current":"Historical"}</summary>
              <p className="mt-2 break-words">{v.rationale}</p><p className="mt-1 break-all text-white/55">{v.reviewer_id??"deleted account"} · {v.created_at}</p>
              {v.edge_id&&<p className="mt-1">Submitted excerpt comparison: {v.quote_match===true?"matched":v.quote_match===false?"not matched":"not checked"}</p>}
              {sourceUrl(v.original_url)&&<a className="mt-2 block text-emerald-200 underline" href={sourceUrl(v.original_url)!} target="_blank" rel="noopener noreferrer">Reviewer reference ↗</a>}
            </details>)}</div>}
        </>}
      </div>
    </>}
  </section>;
}
