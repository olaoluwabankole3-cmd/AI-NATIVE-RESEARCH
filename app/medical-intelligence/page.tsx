import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing-shell";

export default function MedicalIntelligencePage() {
  return (
    <MarketingPageShell
      kicker="Converge Medical Intelligence"
      title={<>Hospital operations, connected around the <em>patient journey.</em></>}
      description="Converge Medical Intelligence is our healthcare-focused workspace for coordinating patient requests and the operational work that follows—while keeping hospital access and permissions under control."
    >
      <section className="marketing-band marketing-band--soft">
        <div className="marketing-band__inner">
          <p className="marketing-eyebrow">The problem we're working on</p>
          <h2 className="marketing-section-heading">A patient request is only the beginning. <em>The follow-through matters.</em></h2>
          <p className="marketing-section-intro">A request may involve a response, an appointment, a member of staff, a department and a follow-up. When those steps are handled across disconnected tools, it can become difficult to see what is outstanding and who owns the next action.</p>
          <div className="marketing-grid marketing-grid--3">
            <article className="marketing-feature"><span className="marketing-feature__number">01 / PATIENTS</span><div className="marketing-feature__symbol">◎</div><h3>Patient access</h3><p>A patient-facing service directory and request experience designed to connect patient requests with hospital workflows and updates.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">02 / OPERATIONS</span><div className="marketing-feature__symbol">↔</div><h3>Hospital coordination</h3><p>Work queues for appointments, access cases, follow-ups, tasks and exceptions, with staff assignments and operational status.</p></article>
            <article className="marketing-feature"><span className="marketing-feature__number">03 / OVERSIGHT</span><div className="marketing-feature__symbol">⌁</div><h3>Accountability and visibility</h3><p>Role-aware workspaces, notifications, reporting and audit history to help authorised teams understand what has happened and what needs attention.</p></article>
          </div>
        </div>
      </section>

      <section className="marketing-band">
        <div className="marketing-split">
          <div className="marketing-split__copy">
            <p className="marketing-eyebrow">AI with boundaries</p>
            <h2 className="marketing-section-heading">Support operations. <em>Keep people in control.</em></h2>
            <p>Our direction is to use AI to help authorised staff identify operational bottlenecks, prepare next steps and coordinate routine follow-through. AI output is advisory; staff remain responsible for reviewing suggestions and initiating permitted actions.</p>
            <ul className="marketing-check-list">
              <li><span>✓</span><span>Hospital membership and staff roles determine access to operational workspaces.</span></li>
              <li><span>✓</span><span>Patient and hospital data remains subject to separate permissions.</span></li>
              <li><span>✓</span><span>Clinical diagnosis and autonomous treatment are outside the current scope.</span></li>
            </ul>
          </div>
          <div className="marketing-callout">
            <p className="marketing-eyebrow">Where we are</p>
            <h2>A working foundation, moving towards a pilot-ready product.</h2>
            <p>The core workflows are being developed and tested. Live integrations, security validation, hospital review and pilot readiness must be verified before real patient data is used operationally.</p>
            <div className="marketing-actions"><Link href="https://converge-medical-space.vercel.app/" className="marketing-button marketing-button--primary">Open Medical Intelligence <span>↗</span></Link><Link href="/contact" className="marketing-text-link">Discuss a pilot <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
