import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getTopicCommunityAccess } from "@/lib/community-access";
import { createHash } from "node:crypto";
import { buildResearchOutcomeMarkdown } from "@/lib/research-outcome";
import { verificationAppendix } from "@/lib/source-verification";
import { canonical, eligibleFindings, type OutcomeRecord, type OutcomeSections, type OutcomeVersion } from "@/lib/outcome-approval";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}
function field(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}
async function authorized(topicId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: respond({ error: "Sign in before reviewing research." }, 401) };
  const admin = await createCommunityAdminClient();
  if (!admin) return { error: respond({ error: "Research review storage is unavailable." }, 503) };
  const access = await getTopicCommunityAccess(admin, topicId, user.id);
  if (access.error) return { error: respond({ error: "Could not check community permissions." }, 503) };
  if (!access.topic || !access.community) return { error: respond({ error: "Research topic not found." }, 404) };
  if (!access.canParticipate) return { error: respond({ error: "Only approved, unbanned community members may review research." }, 403) };
  if (access.topic.type !== "RESEARCH") return { error: respond({ error: "Reviews are only available for research topics." }, 409) };
  const { data: participant, error: participantError } = await admin.from("topic_participants")
    .select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN")
    .eq("user_id", user.id).maybeSingle();
  if (participantError) return { error: respond({ error: "Could not check research participation." }, 503) };
  if (!participant) return { error: respond({ error: "Open the research topic as a participant before reviewing." }, 403) };
  return { admin, user, participant };
}



const versionFields = "id,topic_id,version_no,submitted_by,created_at,digest,sections,snapshot,report";
const decisionFields = "id,topic_id,version_id,reviewer_id,verdict,rationale,created_at";
export async function GET(request:Request,{params}:Params) {
  const {id:topicId}=await params;
  if(!uuid.test(topicId))return respond({error:"Invalid research topic."},400);
  const context=await authorized(topicId);
  if(context.error)return context.error;
  const {admin,user}=context;
  const id=new URL(request.url).searchParams.get("version");
  if(id) {
    if(!uuid.test(id))return respond({error:"Invalid version."},400);
    const [version,decisions]=await Promise.all([
      admin!.from("research_outcome_versions").select(versionFields).eq("topic_id",topicId).eq("id",id).maybeSingle(),
      admin!.from("research_outcome_decisions").select(decisionFields).eq("topic_id",topicId).eq("version_id",id).order("created_at").limit(501)
    ]);
    if(version.error||decisions.error||!decisions.data||decisions.data.length>500)return respond({error:"Version or complete decision history unavailable."},503);
    if(!version.data)return respond({error:"Version not found."},404);
    const frozen=version.data as OutcomeVersion;
    const expected=createHash("sha256").update(canonical({snapshot:frozen.snapshot,sections:frozen.sections,report:frozen.report})).digest("hex");
    if(expected!==frozen.digest)return respond({error:"Stored version integrity check failed."},503);
    const {snapshot: _snapshot, ...publicVersion}=frozen;
    return respond({version:publicVersion,decisions:decisions.data,viewerId:user!.id});
  }
  const [versions,record]=await Promise.all([
    admin!.from("research_outcome_versions").select("id,topic_id,version_no,submitted_by,created_at,digest").eq("topic_id",topicId).order("version_no",{ascending:false}).limit(101),
    admin!.rpc("capture_research_outcome_record",{p_topic_id:topicId})
  ]);
  if(versions.error||record.error||!record.data||!versions.data||versions.data.length>100)return respond({error:"Outcome history or complete research record unavailable."},503);
  const snapshot=record.data as OutcomeRecord;
  if(!bounded(snapshot))return respond({error:"Research record exceeds the current snapshot limit."},409);
  return respond({versions:versions.data,viewerId:user!.id,eligible:eligibleFindings(snapshot).map(a=>({id:a.id,title:a.title}))});
}
function bounded(r:OutcomeRecord) {
  return !!r?.topic && [r.artifacts,r.edges,r.reviews,r.verifications].every(a=>Array.isArray(a)&&a.length<=500) && Buffer.byteLength(JSON.stringify(r),"utf8")<=2000000;
}
export async function POST(request:Request,{params}:Params) {
  const {id:topicId}=await params;
  if(!uuid.test(topicId))return respond({error:"Invalid research topic."},400);
  if(request.headers.get("origin")!==new URL(request.url).origin)return respond({error:"Invalid request origin."},403);
  const context=await authorized(topicId);
  if(context.error)return context.error;
  const {admin,user}=context;
  const p=await request.json().catch(()=>null);
  if(!p||typeof p!=="object"||Array.isArray(p))return respond({error:"Invalid outcome request."},400);
  if(p.action==="submit") {
    const methodology=field(p.methodology,6000),limitations=field(p.limitations,6000),recommendations=field(p.recommendations,6000),openQuestions=field(p.openQuestions,6000);
    const findingIds=Array.isArray(p.findingIds)?p.findingIds:[];
    if(![methodology,limitations,recommendations,openQuestions].every(s=>s.length>=10&&s.length<=6000)||!findingIds.length||findingIds.length>50||!findingIds.every((id:unknown)=>typeof id==="string"&&uuid.test(id))||new Set(findingIds).size!==findingIds.length)
      return respond({error:"Select reviewed findings and complete all four sections (10–6000 characters each)."},400);
    const record=await admin!.rpc("capture_research_outcome_record",{p_topic_id:topicId});
    if(record.error||!record.data)return respond({error:"Could not capture a consistent research record."},503);
    const snapshot=record.data as OutcomeRecord;
    if(!bounded(snapshot))return respond({error:"Research record exceeds the current snapshot limit."},409);
    const eligible=eligibleFindings(snapshot);
    if(!findingIds.every((id:string)=>eligible.some(a=>a.id===id)))return respond({error:"A selected finding no longer has current supporting evidence and an independent supported review. Refresh and reconsider."},409);
    const sections:OutcomeSections={methodology,limitations,recommendations,openQuestions,findingIds};
    const selected=snapshot.artifacts.filter(a=>findingIds.includes(a.id));
    const report=["# Submitted research outcome","", "## Methodology",methodology,"","## Findings proposed for approval",...selected.flatMap(a=>["","### "+a.title,"Artifact ID: "+a.id,a.content]),"","## Limitations and disagreements",limitations,"","## Recommendations",recommendations,"","## Open questions",openQuestions,"","## Frozen investigation record (includes unapproved claims and AI material)",buildResearchOutcomeMarkdown({topicId,title:snapshot.topic.title,question:snapshot.topic.body,artifacts:snapshot.artifacts,edges:snapshot.edges,reviews:snapshot.reviews,origin:new URL(request.url).origin}),verificationAppendix(topicId,snapshot.artifacts,snapshot.edges,snapshot.verifications,false)].join("\n");
    if(Buffer.byteLength(report,"utf8")>3000000)return respond({error:"Report exceeds the current storage limit."},409);
    const digest=createHash("sha256").update(canonical({snapshot,sections,report})).digest("hex");
    const last=await admin!.from("research_outcome_versions").select("version_no").eq("topic_id",topicId).order("version_no",{ascending:false}).limit(1).maybeSingle();
    if(last.error)return respond({error:"Could not allocate the next version."},503);
    const versionNo=(last.data?.version_no??0)+1;
    if(versionNo>100)return respond({error:"Version limit reached."},409);
    const {data,error}=await admin!.from("research_outcome_versions").insert({topic_id:topicId,version_no:versionNo,submitted_by:user!.id,digest,sections,snapshot,report}).select("id,version_no").single();
    if(error?.code==="23505")return respond({error:"Another researcher submitted a version. Refresh and retry."},409);
    if(error||!data)return respond({error:"Could not freeze the outcome."},503);
    return respond({version:data},201);
  }
  if(p.action==="review") {
    const versionId=field(p.versionId,64),digest=field(p.digest,64),verdict=field(p.verdict,30),rationale=field(p.rationale,3000);
    if(!uuid.test(versionId)||!/^[a-f0-9]{64}$/.test(digest)||!["APPROVED","CHANGES_REQUESTED"].includes(verdict)||rationale.length<40||rationale.length>3000||p.attested!==true)return respond({error:"Read the frozen version and record an attested verdict with 40–3000 characters of reasoning."},400);
    const {data:version,error:readError}=await admin!.from("research_outcome_versions").select(versionFields).eq("topic_id",topicId).eq("id",versionId).maybeSingle();
    if(readError)return respond({error:"Could not read frozen version."},503);
    if(!version)return respond({error:"Version not found."},404);
    if(!version.submitted_by||version.submitted_by===user!.id)return respond({error:"A different human participant must review this version."},403);
    const expected=createHash("sha256").update(canonical({snapshot:version.snapshot,sections:version.sections,report:version.report})).digest("hex");
    if(expected!==version.digest||digest!==expected)return respond({error:"Version integrity mismatch. Reopen the report."},409);
    const {data,error}=await admin!.from("research_outcome_decisions").insert({topic_id:topicId,version_id:versionId,reviewer_id:user!.id,verdict,rationale}).select(decisionFields).single();
    if(error?.code==="23505")return respond({error:"You already reviewed this version. Submit a new version for revisions."},409);
    if(error||!data)return respond({error:"Could not record the decision."},503);
    return respond({decision:data},201);
  }
  return respond({error:"Unsupported outcome action."},400);
}
