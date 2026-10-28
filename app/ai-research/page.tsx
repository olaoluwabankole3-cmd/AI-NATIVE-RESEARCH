import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

const specialists = [
  { n: "01", name: "Research Analyst", role: "Find and organise useful information", detail: "Helps explore a question, structure findings and identify relevant material for the team to examine." },
  { n: "02", name: "Critical Reviewer", role: "Test ideas and assumptions", detail: "Looks for gaps in reasoning, challenges unsupported claims and asks what the current argument may be missing." },
  { n: "03", name: "Economist", role: "Consider incentives and trade-offs", detail: "Offers an economic lens on choices, constraints, incentives and possible consequences." },
  { n: "04", name: "Data Analyst", role: "Look for patterns in evidence", detail: "Helps interpret available data, compare possibilities and turn observations into questions the team can investigate." },
];

export default function AIResearchPage() {
  return (
    <MarketingPageShell
      kicker="AI research"
      title={<>Not one assistant. <em>A range of perspectives.</em></>}
      description="Converge is built around specialist AI participants that contribute to a shared investigation. The aim is not to replace human judgement, but to help people question, examine and develop their ideas more thoroughly."
    >
      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">Different roles for different questions</p>
          <h2 className="marketing-section-heading">Ask for the kind of thinking the question <em>needs.</em></h2>
          <p className="marketing-section-intro">A good research process needs more than an answer. It needs exploration, criticism, analysis and a way to preserve what is learned.</p>
          <div className="marketing-grid marketing-grid--2">
            {specialists.map((agent) => (
              <article className="marketing-feature" key={agent.n}>
                <span className="marketing-feature__number">{agent.n} / AI SPECIALIST</span>
                <div className="marketing-feature__symbol">{agent.n === "01" ? "⌕" : agent.n === "02" ? "◇" : agent.n === "03" ? "↗" : "∿"}</div>
                <h3>{agent.name}</h3>
                <p style={{ color: "#c0d9c7" }}>{agent.role}</p>
                <p>{agent.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">Keep context. Show your working.</p>
            <h2 className="marketing-section-heading">Research should be <em>traceable.</em></h2>
            <p>When a project moves from question to discussion to conclusion, the reasoning behind the result should not disappear into an unrelated chat history.</p>
            <ul className="marketing-check-list">
              <li><span>✓</span><span>Keep research outputs connected to the topic that produced them.</span></li>
              <li><span>✓</span><span>Record which context and saved artefacts were available during a specialist run.</span></li>
              <li><span>✓</span><span>Make it clear that a generated answer is a contribution to evaluate—not automatic proof that a claim is true.</span></li>
            </ul>
          </div>
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Our principle</p>
            <h2>AI can expand the thinking. People remain responsible for the conclusions.</h2>
            <p>Converge is being designed to support critical thinking and shared discovery, not to present AI output as unquestionable authority.</p>
            <Link href="/how-it-works" className="marketing-text-link">See how a project flows <span>→</span></Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
