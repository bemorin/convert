"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/** Bar heights of the resting waveform, from 0 to 1. */
const ENVELOPE = [0.2, 0.34, 0.56, 0.78, 0.6, 1, 0.72, 0.88, 0.5, 0.32, 0.18];

/**
 * The Convert mark, large: a waveform. At rest a slow wave runs through it; when files are
 * dragged over the page the bars rise and beat faster, as if the sound were already playing.
 */
export function WaveMark({ active = false }: { active?: boolean }) {
  const reduceMotion = useReducedMotion();
  // The page's AnimatePresence skips first-render animations, so the wave starts right after mount.
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(true), []);
  const still = reduceMotion || !started;
  return (
    <motion.div
      aria-hidden="true"
      className={`wave-mark ${active ? "is-active" : ""}`}
      animate={reduceMotion ? undefined : { y: active ? -4 : 0, scale: active ? 1.06 : 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
    >
      <span className="wave-bars">
        {ENVELOPE.map((height, index) => {
          const level = active ? 0.5 + height * 0.5 : height;
          return (
            <motion.span
              key={index}
              className="wave-bar"
              style={{ opacity: 0.38 + height * 0.62 }}
              initial={{ height: `${height * 100}%` }}
              animate={
                still
                  ? { height: `${height * 100}%` }
                  : { height: [`${level * 58}%`, `${level * 100}%`, `${level * 58}%`] }
              }
              transition={
                still
                  ? { duration: 0 }
                  : {
                      duration: active ? 0.62 : 1.9,
                      delay: index * (active ? 0.045 : 0.12),
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
          );
        })}
      </span>
      <motion.span
        className="wave-glow"
        initial={false}
        animate={reduceMotion ? undefined : { opacity: active ? 0.5 : 0.14, scale: active ? 1.4 : 1 }}
      />
    </motion.div>
  );
}
