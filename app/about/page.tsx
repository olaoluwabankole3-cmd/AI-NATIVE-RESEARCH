import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

export default function AboutPage() {
  return (
    <MarketingPageShell
      kicker="About Converge"
      title={<>Better work begins when perspectives <em>meet.</em></>}
      description="Converge is being built around a simple belief: complex questions are easier to work through when people, knowledge and specialised AI perspectives can contribute in one connected space."
    >
      <section className="marketing-band marketing-band--soft">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">Why we're building this</p>
            <h2 className="marketing-section-heading">The goal isn't more software. It's <em>better outcomes.</em></h2>
            <p>People often move between conversations, documents, tools and AI assistants to get one piece of work done. Important context gets repeated, useful findings get separated from the original question, and teams can struggle to continue where someone else left off.</p>
            <p>Converge aims to connect the process: the question, the people involved, the specialist perspectives brought in and the knowledge the work produces.</p>
          </div>
          <div className="marketing-diagram">
            <div className="marketing-diagram__top"><span>OUR NORTH STAR</span><span className="marketing-diagram__status">People-led</span></div>
            <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
              <div className="marketing-diagram__node"><strong>Start with the real problem</strong><small>Understand the question and why it matters.</small></div>
              <div className="marketing-diagram__node"><strong>Bring the right perspectives</strong><small>Combine experience, evidence and specialist analysis.</small></div>
              <div className="marketing-diagram__node"><strong>Keep knowledge useful</strong><small>Preserve context so teams can build on the work.</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">Principles we are building around</p>
          <h2 className="marketing-section-heading">Useful intelligence, <em>responsibly applied.</em></h2>
          <div className="marketing-grid marketing-grid--3">
            <article className="marketing-feature"><span className="marketing-feature__number">01</span><div className="marketing-feature__symbol">◎</div><h3>People stay in the loop</h3><p>AI should help people think, investigate and coordinate. It should not replace accountability or human judgement.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">02</span><div className="marketing-feature__symbol">≋</div><h3>Context has value</h3><p>Answers become more useful when teams can understand the question, sources and earlier work around them.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">03</span><div className="marketing-feature__symbol">⌁</div><h3>Access must be deliberate</h3><p>Different workspaces need appropriate boundaries. A connected platform must not mean everyone can see everything.</p></article>
          </div>
        </div>
      </section>

      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Still being built</p>
            <h2>We're building the foundation carefully—and the next layers with purpose.</h2>
            <p>Converge is an evolving platform. We are focused on the core experience, validating what works and developing the capabilities that make the product genuinely useful.</p>
            <div className="marketing-actions"><Link href="/platform" className="marketing-button marketing-button--primary">Explore the platform <span>↗</span></Link><Link href="/contact" className="marketing-text-link">Talk to us <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
