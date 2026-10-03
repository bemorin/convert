"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { timeLabel } from "@/lib/audio";

type Props = {
  peaks: number[] | null;
  duration: number;
  currentTime: number;
  playing: boolean;
  playable: boolean;
  message: string | null;
  onToggle: () => void;
  onSeek: (fraction: number) => void;
  readTime: () => number;
};

export function Waveform({ peaks, duration, currentTime, playing, playable, message, onToggle, onSeek, readTime }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const reduceMotion = useReducedMotion();
  const fraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const actualWidth = Math.round(width * ratio);
    const actualHeight = Math.round(height * ratio);
    if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
      canvas.width = actualWidth;
      canvas.height = actualHeight;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!peaks) return;
    const theme = getComputedStyle(document.documentElement);
    const animatedFraction = duration > 0 ? Math.min(1, Math.max(0, readTime() / duration)) : 0;
    const inactive = theme.getPropertyValue("--wave-rest").trim() || "#999";
    const active = theme.getPropertyValue("--wave-active").trim() || "#fff";
    const barCount = Math.min(peaks.length, Math.max(28, Math.floor(width / 5.1)));
    const pitch = width / barCount;
    const barWidth = Math.max(1.5, Math.min(3.1, pitch * 0.55));
    const middle = height / 2;
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor((i / barCount) * peaks.length);
      const end = Math.max(start + 1, Math.floor(((i + 1) / barCount) * peaks.length));
      const value = Math.max(...peaks.slice(start, end));
      const h = Math.max(3, value * (height - 13));
      const x = i * pitch + (pitch - barWidth) / 2;
      ctx.fillStyle = (i + 0.5) / barCount <= animatedFraction ? active : inactive;
      ctx.beginPath();
      ctx.roundRect(x, middle - h / 2, barWidth, h, Math.min(1.55, barWidth / 2));
      ctx.fill();
    }
    if (hoverRef.current !== null) {
      const x = Math.min(width - 1, Math.max(1, hoverRef.current * width));
      ctx.strokeStyle = theme.getPropertyValue("--wave-cursor").trim() || "#aaa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 3);
      ctx.lineTo(x, height - 3);
      ctx.stroke();
    }
  }, [duration, peaks, readTime]);

  drawRef.current = draw;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(canvas);
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => drawRef.current();
    theme.addEventListener("change", onTheme);
    drawRef.current();
    return () => {
      observer.disconnect();
      theme.removeEventListener("change", onTheme);
    };
  }, []);

  useEffect(() => { draw(); }, [draw, fraction]);

  // Keep the playback playhead smooth without rerendering the React tree 60 times/sec.
  useEffect(() => {
    if (!playing || !peaks || reduceMotion) return;
    let frame = 0;
    const tick = () => {
      drawRef.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, peaks, reduceMotion]);

  return (
    <motion.div
      className="preview-card"
      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.09, duration: 0.48, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="preview-topline">
        <span className="eyebrow"><span className={`signal-dot ${playing ? "is-playing" : ""}`} /> {playing ? "NOW PLAYING" : "AUDIO PREVIEW"}</span>
        <span className="eyebrow preview-time">{timeLabel(duration)}</span>
      </div>
      <div className="preview-main">
        <motion.button
          className="play-button"
          type="button"
          onClick={onToggle}
          disabled={!playable}
          aria-label={playing ? "Pause audio preview" : "Play audio preview"}
          title={playable ? "Play / pause" : "Preview not available for this codec in your browser"}
          whileHover={reduceMotion ? undefined : { scale: 1.075 }}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        >
          {playing ? <Pause size={17} fill="currentColor" strokeWidth={1.8} /> : <Play size={17} fill="currentColor" strokeWidth={1.8} />}
        </motion.button>
        <div
          className={`waveform-frame ${peaks ? "has-peaks" : ""}`}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            hoverRef.current = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
            drawRef.current();
          }}
          onPointerLeave={() => {
            hoverRef.current = null;
            drawRef.current();
          }}
        >
          <canvas ref={canvasRef} className="waveform-canvas" aria-hidden="true" />
          {!peaks && (
            <div className="waveform-placeholder" aria-live="polite">
              {message ?? <><span className="waveform-loading" /> Reading waveform…</>}
            </div>
          )}
          {peaks && (
            <input
              type="range"
              className="waveform-seek"
              min={0}
              max={1000}
              value={Math.round(fraction * 1000)}
              onChange={(event) => onSeek(Number(event.target.value) / 1000)}
              aria-label="Seek audio preview"
              aria-valuetext={`${timeLabel(currentTime)} of ${timeLabel(duration)}`}
              disabled={!playable || duration <= 0}
            />
          )}
        </div>
      </div>
      <div className="preview-bottomline"><span>{timeLabel(currentTime)}</span><span>{playable ? (playing ? "SPACE · PAUSE" : "SPACE · PLAY") : "PREVIEW UNAVAILABLE"}</span></div>
    </motion.div>
  );
}
