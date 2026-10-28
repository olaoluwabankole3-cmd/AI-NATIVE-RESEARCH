import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

const steps = [
  { n: "01", title: "Start with a question", text: "Describe the problem, idea or decision the team is trying to understand. Add the context that matters." },
  { n: "02", title: "Bring in perspectives", text: "Work with other people and, where useful, attach specialist AI participants to the topic." },
  { n: "03", title: "Explore and challenge", text: "Compare ideas, investigate evidence, question assumptions and identify what still needs to be understood." },
  { n: "04", title: "Keep what matters", text: "Preserve useful synthesis and research artefacts so the work can continue without starting from zero." },
];

export default function HowItWorksPage() {
  return (
    <MarketingPageShell
      kicker="How it works"
      title={<>From a good question to <em>work you can build on.</em></>}
      description="Converge gives a team a shared place to explore a question, bring in the right perspectives, test the thinking and retain what is useful for the next decision."
    >
      <section className="marketing-band">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">A simple working rhythm</p>
          <h2 className="marketing-section-heading">The process is straightforward. <em>The thinking goes deeper.</em></h2>
          <div className="marketing-steps">
            {steps.map((step) => <article className="marketing-step" key={step.n}><span className="marketing-step__number">{step.n}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="marketing-band marketing-band--soft">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">Designed for shared context</p>
            <h2 className="marketing-section-heading">Less repetition. <em>More continuity.</em></h2>
            <p>Important work gets frustrating when decisions, evidence and background context are scattered across separate tools or lost when a conversation ends.</p>
            <p>Converge is being developed to keep the question, its contributors and the useful research outputs linked. That gives teams a clearer starting point when they return to a problem or bring another person into it.</p>
          </div>
          <div className="marketing-diagram">
            <div className="marketing-diagram__top"><span>THE WORKING CONTEXT</span><span className="marketing-diagram__status">Connected</span></div>
            <div style={{ display: "grid", gap: 11, marginTop: 23 }}>
              <div className="marketing-diagram__node"><strong>Question</strong><small>Purpose, scope and background</small></div>
              <div className="marketing-diagram__node"><strong>Contributors</strong><small>People and selected specialists</small></div>
              <div className="marketing-diagram__node"><strong>Discussion and evidence</strong><small>Perspectives, sources and challenges</small></div>
              <div className="marketing-diagram__node"><strong>Research output</strong><small>Findings that remain linked to context</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-band__inner">
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Start exploring</p>
            <h2>Bring the question you have not been able to solve alone.</h2>
            <p>See how people and specialist AI can contribute different perspectives to a shared investigation.</p>
            <div className="marketing-actions"><Link href="/sign-up" className="marketing-button marketing-button--primary">Join Converge <span>↗</span></Link><Link href="/platform" className="marketing-text-link">Explore the platform <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
