"use client";

import { motion, useReducedMotion } from "framer-motion";

export function StackMark({ active = false }: { active?: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={`stack-mark ${active ? "is-active" : ""}`}
      animate={reduceMotion ? undefined : { y: active ? -4 : [0, -3, 0] }}
      transition={active ? { type: "spring", stiffness: 240, damping: 18 } : { duration: 5, ease: "easeInOut", repeat: Infinity }}
    >
      {[0, 1, 2].map((layer) => (
        <motion.svg
          key={layer}
          viewBox="0 0 100 56"
          className={`stack-layer stack-layer-${layer}`}
          fill="none"
          initial={false}
          animate={
            reduceMotion
              ? undefined
              : { y: active ? (layer - 1) * 12 : (layer - 1) * 7, scale: active ? 1.08 : 1, opacity: active ? 1 : 0.82 - layer * 0.2 }
          }
          transition={{ type: "spring", stiffness: 200, damping: 19, delay: layer * 0.035 }}
        >
          <path d="M50 2.5 97 28 50 53.5 3 28 50 2.5Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
        </motion.svg>
      ))}
      <motion.span
        className="stack-glow"
        initial={false}
        animate={reduceMotion ? undefined : { opacity: active ? 0.36 : 0.1, scale: active ? 1.4 : 1 }}
      />
    </motion.div>
  );
}
