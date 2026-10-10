"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

export function WordParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !parent || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const particles: Particle[] = [];
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let lastTime = 0;

    const buildParticles = () => {
      const sample = document.createElement("canvas");
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sample.width = Math.max(1, Math.floor(width));
      sample.height = Math.max(1, Math.floor(height));
      const maxTextWidth = Math.min(width * 0.76, 860);
      const fontSize = Math.max(34, Math.min(width * 0.115, 112, maxTextWidth / 5.15));
      sampleContext.clearRect(0, 0, sample.width, sample.height);
      sampleContext.fillStyle = "#ffffff";
      sampleContext.textAlign = "center";
      sampleContext.textBaseline = "middle";
      sampleContext.font = `800 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
      sampleContext.fillText("CONVERGE", width / 2, height * (width < 640 ? 0.82 : 0.78), maxTextWidth);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      particles.length = 0;
      const step = width < 640 ? 5 : 5;
      for (let y = 0; y < sample.height; y += step) {
        for (let x = 0; x < sample.width; x += step) {
          if (pixels[(y * sample.width + x) * 4 + 3] > 100 && Math.random() > 0.12) {
            const jitterX = (Math.random() - 0.5) * 1.8;
            const jitterY = (Math.random() - 0.5) * 1.8;
            const homeX = x + jitterX;
            const homeY = y + jitterY;
            particles.push({
              x: homeX + (Math.random() - 0.5) * 8,
              y: homeY + (Math.random() - 0.5) * 8,
              homeX,
              homeY,
              vx: 0,
              vy: 0,
              radius: Math.random() * 0.7 + 0.65,
              alpha: Math.random() * 0.36 + 0.35,
            });
          }
        }
      }
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      buildParticles();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer || reducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height;
    };
    const onPointerLeave = () => { pointer.active = false; };

    const draw = (time: number) => {
      const delta = lastTime ? Math.min((time - lastTime) / 16.67, 2) : 1;
      lastTime = time;
      context.clearRect(0, 0, width, height);
      const forceRadius = width < 640 ? 65 : 100;
      for (const particle of particles) {
        if (pointer.active) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (distance < forceRadius) {
            const force = (1 - distance / forceRadius) * 2.9;
            particle.vx += (dx / distance) * force * delta;
            particle.vy += (dy / distance) * force * delta;
          }
        }
        if (!reducedMotion) {
          particle.vx += (particle.homeX - particle.x) * 0.018 * delta;
          particle.vy += (particle.homeY - particle.y) * 0.018 * delta;
          particle.vx *= Math.pow(0.86, delta);
          particle.vy *= Math.pow(0.86, delta);
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
        } else {
          particle.x = particle.homeX;
          particle.y = particle.homeY;
        }
        const displacement = Math.min(1, Math.hypot(particle.x - particle.homeX, particle.y - particle.homeY) / 70);
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(164, 237, 193, ${particle.alpha * (1 - displacement * 0.42)})`;
        context.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="word-particles" aria-hidden="true" />;
}
