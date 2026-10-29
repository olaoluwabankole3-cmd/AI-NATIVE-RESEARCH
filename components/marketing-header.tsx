"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/platform", label: "Platform" },
  { href: "/ai-research", label: "AI Research" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-organizations", label: "For organisations" },
  { href: "/medical-intelligence", label: "Medical" },
  { href: "/about", label: "About" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const mobileMenu =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              className="marketing-mobile-menu-backdrop"
              aria-label="Close navigation menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav id="converge-mobile-menu" className="marketing-nav marketing-mobile-menu" aria-label="Mobile navigation">
              {navigation.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`marketing-nav__link ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link href="/contact" className="marketing-nav__cta" onClick={() => setMenuOpen(false)}>
                Talk to us <span aria-hidden="true">↗</span>
              </Link>
            </nav>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="marketing-header">
        <div className="marketing-header__inner">
          <Link href="/" className="marketing-wordmark" aria-label="Converge home" onClick={() => setMenuOpen(false)}>
            <Image
              src="/converge-header-lockup.svg"
              alt="Converge"
              width={218}
              height={51}
              priority
              className="marketing-wordmark__image"
            />
          </Link>
          <button
            type="button"
            className="marketing-menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="converge-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span />
          </button>
          <nav className="marketing-nav marketing-nav--desktop" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`marketing-nav__link ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link href="/contact" className="marketing-nav__cta">
              Talk to us <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>
      {mobileMenu}
    </>
  );
}
