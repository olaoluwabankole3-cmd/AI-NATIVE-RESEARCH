"use client";

export function RotatingHeadline() {
  return (
    <h1 className="hero-title mt-7">
      <span className="rotating-headline__line">
        <span>Think beyond</span>{" "}
        <span className="title-highlight">what you know.</span>
        <span className="title-spark" aria-hidden="true">✳</span>
      </span>
    </h1>
  );
}
