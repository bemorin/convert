"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bytesLabel, peaksFromBuffer, WAVEFORM_MAX_BYTES } from "@/lib/audio";

export function useAudioPreview(file: File | null) {
  const player = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playable, setPlayable] = useState(true);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [waveformMessage, setWaveformMessage] = useState<string | null>(null);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setPlayable(true);
    setPeaks(null);
    setWaveformMessage(null);
    if (!file) return;

    let alive = true;
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    player.current = audio;
    audio.preload = "metadata";
    audio.src = url;
    const onMetadata = () => alive && Number.isFinite(audio.duration) && setDuration(audio.duration);
    const onTime = () => alive && setCurrentTime(audio.currentTime);
    const onEnded = () => alive && setPlaying(false);
    const onError = () => alive && setPlayable(false);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();

    void (async () => {
      if (file.size > WAVEFORM_MAX_BYTES) {
        if (alive) setWaveformMessage(`Waveform skipped for files over ${bytesLabel(WAVEFORM_MAX_BYTES)}. Conversion still works.`);
        return;
      }
      let context: AudioContext | null = null;
      try {
        context = new AudioContext();
        const buffer = await file.arrayBuffer();
        if (!alive) return;
        const decoded = await context.decodeAudioData(buffer);
        if (!alive) return;
        setPeaks(peaksFromBuffer(decoded));
        if (!Number.isFinite(audio.duration)) setDuration(decoded.duration);
      } catch {
        if (alive) setWaveformMessage("Waveform unavailable for this codec in your browser.");
      } finally {
        if (context) await context.close().catch(() => {});
      }
    })();

    return () => {
      alive = false;
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      audio.load();
      if (player.current === audio) player.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const toggle = useCallback(async () => {
    const audio = player.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play(); // Must run in direct response to a user click.
      setPlaying(true);
    } catch {
      setPlaying(false);
      setPlayable(false);
    }
  }, []);

  const readTime = useCallback(() => player.current?.currentTime ?? 0, []);

  const seek = useCallback((fraction: number) => {
    const audio = player.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const next = Math.max(0, Math.min(1, fraction)) * audio.duration;
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  return { duration, currentTime, playing, playable, peaks, waveformMessage, toggle, seek, readTime };
}
