"use client";

import { MotionConfig } from "framer-motion";
import React from "react";

/**
 * Honours `prefers-reduced-motion` for every Framer Motion animation in the app.
 *
 * globals.css already disables a handful of CSS animations (cursor glow, aurora,
 * scroll indicator, liquid glass), but the bulk of the motion here is
 * JS-driven through Framer Motion and was unaffected by those rules.
 *
 * `reducedMotion="user"` keeps opacity/colour transitions while dropping
 * transform-based movement, which is what WCAG 2.3.3 actually asks for.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
