"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const orbRef  = useRef<HTMLDivElement>(null);
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let mouseX = -999, mouseY = -999;
    let orbX   = -999, orbY  = -999;
    let ringX  = -999, ringY = -999;
    let rafId: number;
    let isHovering = false;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Instant dot
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX - 3}px, ${mouseY - 3}px)`;
      }
    };

    const onMouseEnterLink = () => {
      isHovering = true;
      if (dotRef.current) {
        dotRef.current.style.width  = "12px";
        dotRef.current.style.height = "12px";
        dotRef.current.style.background = "#D4AB3A";
        dotRef.current.style.transform = `translate(${mouseX - 6}px, ${mouseY - 6}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.width  = "48px";
        ringRef.current.style.height = "48px";
        ringRef.current.style.transform = `translate(${ringX - 24}px, ${ringY - 24}px)`;
        ringRef.current.style.borderColor = "rgba(184,149,42,0.7)";
      }
    };

    const onMouseLeaveLink = () => {
      isHovering = false;
      if (dotRef.current) {
        dotRef.current.style.width  = "6px";
        dotRef.current.style.height = "6px";
        dotRef.current.style.background = "#B8952A";
      }
      if (ringRef.current) {
        ringRef.current.style.width  = "32px";
        ringRef.current.style.height = "32px";
        ringRef.current.style.borderColor = "rgba(184,149,42,0.5)";
      }
    };

    const attachLinkListeners = () => {
      document.querySelectorAll("a, button, [role='button'], input, textarea, select, label").forEach((el) => {
        el.addEventListener("mouseenter", onMouseEnterLink);
        el.addEventListener("mouseleave", onMouseLeaveLink);
      });
    };

    // Observe DOM changes to catch dynamically added links
    const observer = new MutationObserver(attachLinkListeners);
    observer.observe(document.body, { childList: true, subtree: true });
    attachLinkListeners();

    const animate = () => {
      // Orb: very slow lag
      orbX += (mouseX - orbX) * 0.06;
      orbY += (mouseY - orbY) * 0.06;

      // Ring: medium lag
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;

      if (orbRef.current) {
        orbRef.current.style.transform = `translate(${orbX - 240}px, ${orbY - 240}px)`;
      }
      if (ringRef.current) {
        const size = isHovering ? 48 : 32;
        ringRef.current.style.transform = `translate(${ringX - size / 2}px, ${ringY - size / 2}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Large ambient orb — very slow lag */}
      <div ref={orbRef} className="cursor-orb" aria-hidden="true" />
      {/* Precision ring — medium lag */}
      <div ref={ringRef} className="cursor-ring" style={{ transition: "width 0.2s, height 0.2s, border-color 0.2s" }} aria-hidden="true" />
      {/* Instant dot */}
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
