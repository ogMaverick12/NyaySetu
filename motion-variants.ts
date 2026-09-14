import type { Variants, Transition } from "framer-motion";

/**
 * NyaySetu Shared Motion Variants
 * Strict compliance with 03-UIUX-BRIEF.md:
 * - 150–250ms, ease-out, subtle fade/slide (no springy or bouncy transitions)
 * - Clause-card reveal: gentle upward fade with a short stagger across cards
 * - Risk-flag appearance: a brief settle, not a blink or loop
 * - Full prefers-reduced-motion compatibility
 */

export const standardTransition: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1], // ease-out
};

export const slowTransition: Transition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: standardTransition,
  },
  exit: {
    opacity: 0,
    transition: standardTransition,
  },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: standardTransition,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: standardTransition,
  },
};

export const clauseContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const clauseCardReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: slowTransition,
  },
};

export const riskFlagReveal: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: standardTransition,
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: slowTransition,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: standardTransition,
  },
};

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
};
