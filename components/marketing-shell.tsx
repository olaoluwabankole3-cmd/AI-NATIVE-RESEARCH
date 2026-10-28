import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing-header";

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer__top">
        <div className="marketing-footer__brand">
          <Link href="/" className="marketing-wordmark">
            <span className="marketing-wordmark__mark" aria-hidden="true"><i /><i /><i /></span>
            <span>converge<span className="marketing-wordmark__dot">.</span></span>
          </Link>
          <p>Bring people, knowledge and specialist AI into the same room.</p>
        </div>
        <div className="marketing-footer__links">
          <div><span className="marketing-footer__label">Explore</span><Link href="/platform">Platform</Link><Link href="/ai-research">AI research</Link><Link href="/how-it-works">How it works</Link></div>
          <div><span className="marketing-footer__label">Who it’s for</span><Link href="/for-organizations">Organisations</Link><Link href="/medical-intelligence">Medical Intelligence</Link><Link href="/about">About Converge</Link></div>
          <div><span className="marketing-footer__label">Get started</span><Link href="/contact">Contact</Link><Link href="/sign-up">Create an account</Link><Link href="/sign-in">Sign in</Link></div>
        </div>
      </div>
      <div className="marketing-footer__bottom">
        <span>© {new Date().getFullYear()} Converge</span>
        <span>Thoughtful collaboration. Clearer outcomes.</span>
      </div>
    </footer>
  );
}

export function MarketingPageShell({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="marketing-site">
      <MarketingHeader />
      <section className="marketing-page-hero">
        <div className="marketing-page-hero__eyebrow"><span />{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <div className="marketing-page-content">{children}</div>
      <section className="marketing-bottom-cta">
        <div>
          <p className="marketing-eyebrow">Build with Converge</p>
          <h2>Make room for a better way to think and work.</h2>
          <p>Explore what we are building and join us as the platform takes shape.</p>
        </div>
        <div className="marketing-bottom-cta__actions">
          <Link href="/sign-up" className="marketing-button marketing-button--primary">Join Converge <span>↗</span></Link>
          <Link href="/contact" className="marketing-text-link">Talk to the team <span>→</span></Link>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
