"use client";

import { useEffect, useState } from "react";

const phrases = [
  { label: "Think beyond what you know.", lines: [{ text: "Think beyond", highlight: false }, { text: "what you", highlight: true }, { text: "know.", highlight: true }] },
  { label: "One question can change how we see everything.", lines: [{ text: "One question", highlight: false }, { text: "can change how", highlight: true }, { text: "we see everything.", highlight: true }] },
  { label: "A meeting place for minds, ideas, and possibilities.", lines: [{ text: "A meeting place", highlight: false }, { text: "for minds, ideas,", highlight: true }, { text: "and possibilities.", highlight: true }] },
];

export function RotatingHeadline() {
  const [active, setActive] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const phrase = phrases[active];

  useEffect(() => {
    let swap: number | undefined;
    const rotation = window.setInterval(() => {
      setIsTransitioning(true);
      swap = window.setTimeout(() => {
        setActive((current) => (current + 1) % phrases.length);
        setIsTransitioning(false);
      }, 220);
    }, 5000);
    return () => {
      window.clearInterval(rotation);
      if (swap !== undefined) window.clearTimeout(swap);
    };
  }, []);

  let characterIndex = 0;

  return (
    <h1 className={`hero-title mt-7 rotating-headline${isTransitioning ? " rotating-headline--out" : " rotating-headline--in"}`} aria-label={phrase.label} aria-live="polite">
      {phrase.lines.map((line, lineIndex) => (
        <span className={line.highlight ? "title-highlight rotating-headline__line" : "rotating-headline__line"} key={phrase.label + line.text}>
          {[...line.text].map((character) => {
            const index = characterIndex++;
            return <span className="rotating-headline__char" aria-hidden="true" key={index} style={{ animationDelay: `${Math.min(index * 12, 220)}ms` }}>{character === " " ? "\u00a0" : character}</span>;
          })}
          {lineIndex === phrase.lines.length - 1 && <span className="title-spark" aria-hidden="true">✳</span>}
        </span>
      ))}
    </h1>
  );
}
