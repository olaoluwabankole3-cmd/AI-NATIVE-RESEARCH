"use client";

import Link from "next/link";

const medicalUrl = "https://converge-medical-space.vercel.app/";

function WorkspaceMark({ kind }: { kind: "research" | "medical" }) {
  if (kind === "medical") {
    return (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 7v34M7 24h34" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M14 12c4.4 0 7.1 2.4 10 7 2.9-4.6 5.6-7 10-7M14 36c4.4 0 7.1-2.4 10-7 2.9 4.6 5.6 7 10 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M9 12 24 24 39 12M24 24l15 12M24 24 9 36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="12" r="4" fill="currentColor" />
      <circle cx="39" cy="12" r="4" fill="currentColor" />
      <circle cx="9" cy="36" r="4" fill="currentColor" />
      <circle cx="39" cy="36" r="4" fill="currentColor" />
      <circle cx="24" cy="24" r="5.5" fill="#EAB58E" stroke="#16221A" strokeWidth="2" />
    </svg>
  );
}

export default function WorkspacesPage() {
  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <header className="border-b border-white/[0.08] bg-[#0b1110]/90">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/communities" aria-label="Converge home" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[11px] border border-emerald-200/25 bg-[#15231b] text-emerald-200">
              <WorkspaceMark kind="research" />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.055em]">converge<span className="text-emerald-300">.</span></span>
          </Link>
          <Link href="/communities" className="rounded-full border border-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/65 transition hover:border-white/20 hover:text-white">
            Back to Converge
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">THE CONVERGE PLATFORM</p>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.075em]">
            One platform.<br /><span className="text-emerald-200">Different kinds of work.</span>
          </h1>
          <p className="mt-5 max-w-[650px] text-[14px] leading-7 text-white/55 sm:text-[15px]">
            Choose the Converge workspace that fits what you are here to do. Each workspace has its own focused tools, while the wider platform continues to grow around them.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2">
          <article className="group relative flex min-h-[330px] flex-col overflow-hidden rounded-[24px] border border-emerald-200/20 bg-[radial-gradient(ellipse_at_90%_0%,rgba(164,237,193,0.11),transparent_43%),linear-gradient(145deg,#121d16,#0e1511)] p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-200/35 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-[58px] place-items-center rounded-[17px] border border-emerald-200/20 bg-emerald-200/[0.07] p-3.5 text-emerald-200">
                <WorkspaceMark kind="research" />
              </span>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100">Available now</span>
            </div>
            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">Research & community</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.05em] sm:text-[30px]">Think together.</h2>
            <p className="mt-3 max-w-[480px] text-[13px] leading-7 text-white/55">
              Bring questions into communities, collaborate with people and specialist AI agents, and keep research context connected to the conversation.
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
              <Link href="/communities" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-200 px-5 text-[12px] font-bold text-[#0b1710] transition hover:bg-emerald-100">
                Open research & community <span aria-hidden="true">↗</span>
              </Link>
              <span className="text-[10px] text-white/35">Stays inside Converge</span>
            </div>
          </article>

          <article className="group relative flex min-h-[330px] flex-col overflow-hidden rounded-[24px] border border-emerald-200/15 bg-[radial-gradient(ellipse_at_90%_0%,rgba(104,169,121,0.13),transparent_45%),linear-gradient(145deg,#121b16,#0e1511)] p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-200/35 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-[58px] place-items-center rounded-[17px] border border-emerald-200/20 bg-emerald-200/[0.07] p-3.5 text-emerald-200">
                <WorkspaceMark kind="medical" />
              </span>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100">Dedicated workspace</span>
            </div>
            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">Medical intelligence</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.05em] sm:text-[30px]">Coordinate care.</h2>
            <p className="mt-3 max-w-[480px] text-[13px] leading-7 text-white/55">
              Connect patient requests, hospital review, appointment updates, staff handovers and operational insight in a governed care workspace.
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
              <a href={medicalUrl} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-200/[0.07] px-5 text-[12px] font-bold text-emerald-100 transition hover:border-emerald-200/45 hover:bg-emerald-200/[0.12]">
                Open Medical Intelligence <span aria-hidden="true">↗</span>
              </a>
              <span className="text-[10px] text-white/35">Opens a dedicated app</span>
            </div>
          </article>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-white/[0.08] pt-5 text-[11px] leading-6 text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>Converge is the platform. Each workspace is designed around its own users, permissions and workflows.</span>
          <Link href="/communities" className="inline-flex w-fit items-center gap-2 font-semibold text-emerald-200 transition hover:text-emerald-100">Return to research spaces <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </main>
  );
}
