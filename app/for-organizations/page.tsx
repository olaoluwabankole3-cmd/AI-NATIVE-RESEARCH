import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

export default function OrganisationsPage() {
  return (
    <MarketingPageShell
      kicker="For organisations"
      title={<>Give collective knowledge a place to <em>grow.</em></>}
      description="Converge is being built for teams and institutions that need to explore complex questions together, bring different expertise into the same process and retain the knowledge they create."
    >
      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">Where it can help</p>
          <h2 className="marketing-section-heading">Make shared thinking part of the way your team <em>works.</em></h2>
          <div className="marketing-grid marketing-grid--3">
            <article className="marketing-feature"><span className="marketing-feature__number">01 / RESEARCH</span><div className="marketing-feature__symbol">⌕</div><h3>Research groups</h3><p>Explore a question across disciplines, challenge the first answer and keep useful evidence connected to the work.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">02 / LEARNING</span><div className="marketing-feature__symbol">↗</div><h3>Universities and learning communities</h3><p>Create a shared environment where learners and specialists can examine ideas, discuss findings and develop understanding.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">03 / TEAMS</span><div className="marketing-feature__symbol">◎</div><h3>Product and strategy teams</h3><p>Bring questions, analysis and critical review together when teams need to evaluate options or make sense of unfamiliar problems.</p></article>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">A foundation for shared work</p>
            <h2 className="marketing-section-heading">The right people. The right context. <em>The right boundaries.</em></h2>
            <p>Organisational work needs more than collaboration. It needs clarity about who is involved, which workspaces they can access and where the team's knowledge belongs.</p>
            <ul className="marketing-check-list">
              <li><span>✓</span><span>Organise work around topics, communities and dedicated workspaces.</span></li>
              <li><span>✓</span><span>Make specialist AI participation explicit and connected to the work at hand.</span></li>
              <li><span>✓</span><span>Build towards clearer governance as the platform grows, with access based on the relevant workspace and permissions.</span></li>
            </ul>
          </div>
          <div className="marketing-callout">
            <p className="marketing-eyebrow">A connected ecosystem</p>
            <h2>Different work needs different experiences.</h2>
            <p>Converge Medical Intelligence is our healthcare-focused workspace, built around patient requests and hospital operational coordination.</p>
            <Link href="/medical-intelligence" className="marketing-text-link">Explore Medical Intelligence <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Work with us</p>
            <h2>We're building Converge with the needs of real teams in mind.</h2>
            <p>For early access, organisational use or pilot conversations, get in touch and tell us what your team is trying to accomplish.</p>
            <div className="marketing-actions"><Link href="/contact" className="marketing-button marketing-button--primary">Start a conversation <span>↗</span></Link><Link href="/platform" className="marketing-text-link">View the platform <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
