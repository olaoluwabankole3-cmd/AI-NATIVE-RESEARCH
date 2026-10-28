import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

export default function ContactPage() {
  return (
    <MarketingPageShell
      kicker="Contact and early access"
      title={<>Let's build something <em>useful together.</em></>}
      description="We are developing Converge with a focus on real problems, clear workflows and practical value. Tell us what you are trying to accomplish and which part of the platform is relevant to you."
    >
      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">Start a conversation</p>
          <h2 className="marketing-section-heading">What would you like to explore?</h2>
          <div className="marketing-grid marketing-grid--3">
            <article className="marketing-feature"><span className="marketing-feature__number">01 / PLATFORM</span><div className="marketing-feature__symbol">✳</div><h3>Converge platform</h3><p>Explore collaborative research, specialist AI perspectives and shared workspaces.</p><Link href="/sign-up">Create an account <span>→</span></Link></article>
            <article className="marketing-feature"><span className="marketing-feature__number">02 / ORGANISATIONS</span><div className="marketing-feature__symbol">◎</div><h3>Organisation or team use</h3><p>Discuss how your group might use Converge to work through questions and preserve shared knowledge.</p><Link href="/for-organizations">Explore organisation use <span>→</span></Link></article>
            <article className="marketing-feature"><span className="marketing-feature__number">03 / HEALTHCARE</span><div className="marketing-feature__symbol">⌁</div><h3>Medical Intelligence</h3><p>Learn about the healthcare workspace and the patient-to-hospital workflows we are developing.</p><Link href="https://converge-medical-space.vercel.app/">Open Medical Intelligence <span>↗</span></Link></article>
          </div>
        </div>
      </section>
      <section className="marketing-band">
        <div className="marketing-band__inner">
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Early collaboration</p>
            <h2>The most useful next step is a real problem to solve.</h2>
            <p>We are especially interested in understanding the work people need to get done, where context gets lost and what would make Converge meaningfully better than the tools they use today.</p>
            <div className="marketing-actions"><Link href="/sign-up" className="marketing-button marketing-button--primary">Join Converge <span>↗</span></Link><Link href="/about" className="marketing-text-link">What we believe <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
