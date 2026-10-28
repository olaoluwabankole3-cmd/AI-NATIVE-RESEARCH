import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

export default function PlatformPage() {
  return (
    <MarketingPageShell
      kicker="The platform"
      title={<>One shared space for <em>better thinking.</em></>}
      description="Converge brings people, specialist AI perspectives and research context together, so important questions can move beyond scattered conversations into work teams can build on."
    >
      <section className="marketing-band">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">More than a chat window</p>
            <h2 className="marketing-section-heading">Keep the thinking connected to the <em>work.</em></h2>
            <p>Useful work rarely happens in one message. Questions lead to investigation; investigation brings different perspectives; those perspectives need to be tested, organised and carried forward.</p>
            <p>Converge is designed to keep that context together. A research topic can become a shared space where people and specialist AI participants contribute, challenge assumptions and preserve useful outputs for the next step.</p>
            <ul className="marketing-check-list">
              <li><span>✓</span><span>Bring the question, context and relevant people into one room.</span></li>
              <li><span>✓</span><span>Invite specialist AI perspectives where they can add value.</span></li>
              <li><span>✓</span><span>Keep useful research outputs connected to the work that produced them.</span></li>
            </ul>
          </div>
          <div className="marketing-diagram" aria-label="Illustration of a question being worked on by people and AI specialists">
            <div className="marketing-diagram__top"><span>CONVERGE WORKSPACE</span><span className="marketing-diagram__status">Shared context</span></div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 23 }}><div className="marketing-diagram__node"><strong>The question</strong><small>What are we trying to understand?</small></div></div>
            <div className="marketing-diagram__line" style={{ margin: "0 auto" }} />
            <div className="marketing-diagram__branch">
              <div className="marketing-diagram__node"><strong>Human perspective</strong><small>Experience, goals and context</small></div>
              <div className="marketing-diagram__node"><strong>AI specialist</strong><small>Research, analysis or critique</small></div>
            </div>
            <div className="marketing-diagram__line" />
            <div className="marketing-diagram__node"><strong>Evidence and useful outputs</strong><small>Keep findings and next questions connected.</small></div>
            <div className="marketing-diagram__outcome">The value is not just a response. It is context a team can continue to work with.</div>
          </div>
        </div>
      </section>

      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">What comes together</p>
          <h2 className="marketing-section-heading">Three parts. <em>One continuous process.</em></h2>
          <div className="marketing-grid marketing-grid--3">
            <article className="marketing-feature"><span className="marketing-feature__number">01 / PEOPLE</span><div className="marketing-feature__symbol">↗</div><h3>Human collaboration</h3><p>People bring the lived experience, context, questions and judgement that make a shared investigation meaningful.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">02 / SPECIALISTS</span><div className="marketing-feature__symbol">✳</div><h3>Purposeful AI</h3><p>Specialist agents can approach a question from different angles instead of forcing every task through one generic assistant.</p><Link href="/ai-research">Meet the AI approach <span>→</span></Link></article>
            <article className="marketing-feature"><span className="marketing-feature__number">03 / CONTEXT</span><div className="marketing-feature__symbol">≋</div><h3>Research that carries forward</h3><p>Useful findings, sources and synthesis can remain connected to the question and conversation they came from.</p></article>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-band__inner">
          <div className="marketing-callout">
            <p className="marketing-eyebrow">A connected ecosystem</p>
            <h2>One foundation, with experiences shaped around different kinds of work.</h2>
            <p>The main Converge platform focuses on collaborative thinking and research. Converge Medical Intelligence is a dedicated healthcare workspace built around patient requests and hospital operational coordination.</p>
            <div className="marketing-actions"><Link href="/ai-research" className="marketing-button marketing-button--primary">Explore AI research <span>↗</span></Link><Link href="/medical-intelligence" className="marketing-text-link">See Medical Intelligence <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
