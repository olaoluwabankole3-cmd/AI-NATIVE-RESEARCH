"use client";

import { useEffect, useMemo, useState } from "react";

const phrases = [
  {
    label: "Think beyond what you know.",
    lines: [
      { text: "Think beyond", highlight: false },
      { text: "what you know.", highlight: true },
    ],
  },
  {
    label: "One question can change how we see everything.",
    lines: [
      { text: "One question can", highlight: false },
      { text: "change how we see", highlight: true },
      { text: "everything.", highlight: true },
    ],
  },
  {
    label: "A meeting place for minds, ideas, and possibilities.",
    lines: [
      { text: "A meeting place for", highlight: false },
      { text: "minds, ideas, and", highlight: true },
      { text: "possibilities.", highlight: true },
    ],
  },
];

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function RotatingHeadline() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(18);
  const phrase = phrases[active];
  const characters = useMemo(
    () => phrase.lines.flatMap((line, lineIndex) =>
      [...line.text].map((character) => ({ character, highlight: line.highlight, lineIndex }))
    ),
    [phrase]
  );

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setProgress(0);
      setActive((current) => (current + 1) % phrases.length);
    }, 5000);
    return () => window.clearInterval(rotation);
  }, []);

  useEffect(() => {
    if (progress >= 18) return;
    const animation = window.setInterval(() => {
      setProgress((current) => Math.min(18, current + 1));
    }, 32);
    return () => window.clearInterval(animation);
  }, [active, progress]);

  let characterIndex = 0;

  return (
    <h1 className="hero-title mt-7 rotating-headline" aria-label={phrase.label} aria-live="polite">
      {phrase.lines.map((line, lineIndex) => {
        return (
          <span
            className={line.highlight ? "title-highlight rotating-headline__line" : "rotating-headline__line"}
            key={phrase.label + line.text}
          >
            {[...line.text].map((character) => {
              const index = characterIndex++;
              const isRevealed = index < Math.floor((progress / 18) * characters.length);
              const substitute = alphabet[(index * 7 + progress * 11 + active * 13) % alphabet.length];
              return (
                <span className="rotating-headline__char" aria-hidden="true" key={index}>
                  {progress >= 18 || isRevealed || character === " " ? character : substitute}
                </span>
              );
            })}
            {lineIndex === phrase.lines.length - 1 && (
              <span className="title-spark" aria-hidden="true">✳</span>
            )}
            {lineIndex < phrase.lines.length - 1 && <br />}
          </span>
        );
      })}
    </h1>
  );
}
