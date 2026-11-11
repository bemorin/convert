"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Check, Command,
  FileAudio2, Files, Plus, RefreshCw,
  Upload, X,
} from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import {
  bytesLabel, downloadName, inspectAudio, otherFormats, targetCopy,
  type AudioFormat,
} from "@/lib/audio";
import {
  formatQueueCount, planAddition, uniqueExportNames,
} from "@/lib/queue";
import { convertFile, getRuntime, saveBlob } from "@/lib/convert";
import type { BatchStage, Job, QueueItem, ReadyArchive } from "@/lib/studio-types";
import { estimateBatch, estimateItem, estimateLabel, readAudioFacts, MAX_BATCH_ESTIMATED_OUTPUT_BYTES, shortSize } from "@/lib/estimates";
import { batchFraction } from "@/lib/batch-progress";
import { CollectionPanel } from "./collection-panel";
import { StackMark } from "./stack-mark";
import { Waveform } from "./waveform";
import { useAudioPreview } from "./use-audio-preview";

type RuntimeStatus = "idle" | "loading" | "ready" | "error";
const INITIAL_POINTER = 500;
const ACCEPT = ".wav,.mp3,.flac,audio/wav,audio/x-wav,audio/mpeg,audio/flac";

export function AudioStudio() {
  const picker = useRef<HTMLInputElement>(null);
  const idSequence = useRef(0);
  const incomingSequence = useRef<Promise<void>>(Promise.resolve());
  const operationLock = useRef(false);
  const outputCache = useRef(new Map<string, Blob>());
  const knownFiles = useRef<File[]>([]);
  const collectionEpoch = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("idle");
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [readyArchive, setReadyArchive] = useState<ReadyArchive | null>(null);
  const [batchStage, setBatchStage] = useState<BatchStage>("converting");
  const [batchCompletedIds, setBatchCompletedIds] = useState<ReadonlySet<number>>(() => new Set());
  const selected = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  const preview = useAudioPreview(selected?.file ?? null);
  const reduceMotion = useReducedMotion();

  const pointerX = useMotionValue(INITIAL_POINTER);
  const pointerY = useMotionValue(300);
  const smoothX = useSpring(pointerX, { stiffness: 125, damping: 22, mass: 0.6 });
  const smoothY = useSpring(pointerY, { stiffness: 125, damping: 22, mass: 0.6 });
  const spotlight = useMotionTemplate`radial-gradient(570px circle at ${smoothX}px ${smoothY}px, var(--hover-glow), transparent 73%)`;

  const updateItem = (id: number, patch: Partial<QueueItem>) => {
    setItems((old) => old.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const clearAll = useCallback(() => {
    if (operationLock.current) return;
    outputCache.current.clear();
    knownFiles.current = [];
    collectionEpoch.current += 1;
    setItems([]);
    setReadyArchive(null);
    setActiveId(null);
    setError(null);
    setAnnouncement("Collection cleared.");
    if (picker.current) picker.current.value = "";
  }, []);

  // Serialized ingestion means two near-simultaneous drops cannot bypass size or duplicate checks.
  const ingestFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const epoch = collectionEpoch.current;
    incomingSequence.current = incomingSequence.current.catch(() => {}).then(async () => {
      // First validate actual file bytes; never trust extensions or MIME alone.
      const inspected = await Promise.allSettled(files.map(async (file) => ({
        file, format: await inspectAudio(file),
      })));
      const valid: { file: File; format: AudioFormat }[] = [];
      const rejected: string[] = [];
      inspected.forEach((result, index) => {
        if (result.status === "fulfilled") valid.push(result.value);
        else rejected.push(`${files[index].name}: ${result.reason instanceof Error ? result.reason.message : "Unsupported audio"}`);
      });
      // The ref is updated synchronously and ingestion is serialized: rapid drops
      // cannot race a React state updater or accidentally admit duplicate files.
      if (epoch !== collectionEpoch.current) return;
      const plan = planAddition(knownFiles.current, valid.map((entry) => entry.file));
      rejected.push(...plan.rejected);
      const accepted = new Set(plan.accepted);
      const added: QueueItem[] = valid.filter(({ file }) => accepted.has(file)).map(({ file, format }) => ({
        id: ++idSequence.current,
        file, format, completed: {}, converting: null, progress: 0, error: null,
      }));
      knownFiles.current.push(...plan.accepted);
      setItems((old) => [...old, ...added]);
      setActiveId((old) => old ?? added[0]?.id ?? null);
      if (rejected.length) setError(rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? ` · +${rejected.length - 3} more` : ""));
      else setError(null);
      if (added.length) {
        // Resolve metadata independently and progressively for every file,
        // without blocking drag-and-drop or preventing conversions.
        void (async () => {
          // Bound metadata concurrency: fast for a batch without opening 24 decoders.
          const pending = [...added];
          const worker = async () => {
            while (pending.length && epoch === collectionEpoch.current) {
              const entry = pending.shift()!;
              try {
                const facts = await readAudioFacts(entry.file, entry.format);
                if (epoch !== collectionEpoch.current) return;
                updateItem(entry.id, { facts });
              } catch (cause) {
                // An uninspectable duration should never prevent individual conversion.
                console.info("Could not estimate audio output size:", entry.file.name, cause);
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(4, added.length) }, worker));
        })();
        setReadyArchive(null);
        setAnnouncement(`${added.length} audio file${added.length === 1 ? "" : "s"} added.`);
        setRuntimeStatus("loading");
        void getRuntime().then(() => setRuntimeStatus("ready")).catch(() => setRuntimeStatus("error"));
      }
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not add the files.");
    });
  }, []);

  // Desktop dragging covers the entire page, including waveform, buttons and playlist.
  // The overlay is visual only: the window listener owns drop processing.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0 || !event.relatedTarget) {
        depth = 0;
        setDragging(false);
      }
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      ingestFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [ingestFiles]);

  useEffect(() => {
    const onKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        picker.current?.click();
      }
      if (event.key === "Escape") setDragging(false);
      if (event.code === "Space" && selected && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target;
        const editing = target instanceof HTMLElement && Boolean(target.closest("button, input, textarea, select, [contenteditable]"));
        if (!editing) {
          event.preventDefault();
          void preview.toggle();
        }
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData?.files.length) return;
      event.preventDefault();
      ingestFiles(Array.from(event.clipboardData.files));
    };
    window.addEventListener("keydown", onKeyboard);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyboard);
      window.removeEventListener("paste", onPaste);
    };
  }, [selected, preview.toggle, ingestFiles]);

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    ingestFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const removeItem = (id: number) => {
    if (operationLock.current && (!job || job.kind === "batch" || job.id === id)) return;
    setReadyArchive(null);
    const removed = items.find((item) => item.id === id);
    if (removed) knownFiles.current = knownFiles.current.filter((file) => file !== removed.file);
    setItems((old) => old.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(items.find((item) => item.id !== id)?.id ?? null);
    for (const format of ["wav", "mp3", "flac"]) outputCache.current.delete(`${id}:${format}`);
    setAnnouncement("File removed from the collection.");
  };

  const ensureConverted = async (item: QueueItem, target: AudioFormat, notify: (fraction: number) => void): Promise<Blob> => {
    // Already matching? Include the original bytes, do not recompress.
    if (item.format === target) { notify(1); return item.file; }
    const key = `${item.id}:${target}`;
    const cached = outputCache.current.get(key);
    if (cached) { notify(1); return cached; }
    updateItem(item.id, { converting: target, progress: 0, error: null });
    try {
      const blob = await convertFile(item.file, item.format, target, (fraction) => {
        notify(fraction);
        updateItem(item.id, { progress: fraction });
      });
      outputCache.current.set(key, blob);
      setItems((old) => old.map((entry) => entry.id === item.id
        ? { ...entry, completed: { ...entry.completed, [target]: blob } }
        : entry));
      return blob;
    } finally {
      updateItem(item.id, { converting: null, progress: 0 });
    }
  };

  const exportAs = async (item: QueueItem, target: AudioFormat) => {
    if (operationLock.current) return;
    operationLock.current = true;
    setJob({ id: item.id, target, kind: "single" });
    setProgress(0);
    setError(null);
    try {
      const blob = await ensureConverted(item, target, setProgress);
      const filename = downloadName(item.file.name, target);
      saveBlob(blob, filename);
      setAnnouncement(`${filename} is ready and downloading.`);
      setRuntimeStatus("ready");
    } catch (cause) {
      console.error("Bemorin audio conversion error:", cause);
      const message = cause instanceof Error ? cause.message : String(cause);
      updateItem(item.id, { error: message });
      setError(`${item.file.name}: ${message}`);
      setRuntimeStatus("error");
    } finally {
      operationLock.current = false;
      setJob(null);
      setProgress(0);
    }
  };

  const batchExport = async (target: AudioFormat) => {
    if (operationLock.current || items.length < 2) return;
    const snapshot = [...items];
    const plan = estimateBatch(snapshot, target);
    if (!plan.allowed) {
      setError(plan.reason ?? "Output size is not yet available; wait for analysis or export files individually.");
      return;
    }
    operationLock.current = true;
    setReadyArchive(null);
    setError(null);
    setProgress(0);
    setBatchStage("converting");
    setBatchCompletedIds(new Set());
    const names = uniqueExportNames(snapshot.map((item) => item.file), target);
    let currentBatchItem: QueueItem | null = null;
    let actualBytes = 0;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let index = 0; index < snapshot.length; index++) {
        const item = snapshot[index];
        currentBatchItem = item;
        setJob({ id: item.id, target, kind: "batch", index: index + 1, total: snapshot.length });
        setAnnouncement(`Batch conversion ${index + 1} of ${snapshot.length}.`);
        const blob = await ensureConverted(item, target, (value) => {
          setProgress(batchFraction(index, snapshot.length, value));
        });
        actualBytes += blob.size + 4096;
        // A conservative FLAC range is still only an estimate. Enforce the
        // cap against real output, before building a potentially massive ZIP.
        if (actualBytes > MAX_BATCH_ESTIMATED_OUTPUT_BYTES) {
          throw new Error(`Actual ${target.toUpperCase()} files exceed the ${shortSize(MAX_BATCH_ESTIMATED_OUTPUT_BYTES)} ZIP budget. Your completed individual conversions remain available.`);
        }
        zip.file(names[index], blob, { binary: true });
        setBatchCompletedIds((completed) => new Set([...completed, item.id]));
        setProgress(batchFraction(index + 1, snapshot.length));
      }
      // ZIP STORE: sources are already compressed or uncompressed as requested.
      // Do not waste CPU recompressing MP3/FLAC or silently changing WAV bytes.
      setJob({ id: snapshot[snapshot.length - 1].id, target, kind: "batch", index: snapshot.length, total: snapshot.length });
      setAnnouncement("Packaging your files into one ZIP.");
      setBatchStage("packaging");
      setProgress(0);
      const archive = await zip.generateAsync(
        { type: "blob", compression: "STORE", streamFiles: true },
        ({ percent }) => setProgress(Math.max(0, Math.min(1, percent / 100))),
      );
      const zipName = `bemorin-${target}-${snapshot.length}-files.zip`;
      setReadyArchive({ name: zipName, blob: archive, fileCount: snapshot.length, format: target });
      saveBlob(archive, zipName);
      setAnnouncement(`Your ${target.toUpperCase()} ZIP is ready. Use Download prepared ZIP if your browser blocked the automatic download.`);
      setRuntimeStatus("ready");
    } catch (cause) {
      console.error("Bemorin batch conversion error:", cause);
      const message = cause instanceof Error ? cause.message : String(cause);
      if (currentBatchItem) updateItem(currentBatchItem.id, { error: message });
      setError(`Batch export failed: ${message}`);
      setRuntimeStatus("error");
    } finally {
      operationLock.current = false;
      setJob(null);
      setProgress(0);
      setBatchCompletedIds(new Set());
    }
  };

  const targets = selected ? otherFormats(selected.format) : null;
  const statusText = job
    ? job.kind === "batch" ? (batchStage === "packaging" ? "PACKAGING ZIP" : `BATCH ${job.index}/${job.total}`) : `CONVERTING · ${Math.round(progress * 100)}%`
    : runtimeStatus === "loading" && items.length ? "PREPARING ENGINE"
      : items.length ? `${formatQueueCount(items.length)} · READY` : "WAV · MP3 · FLAC";
  const batchPlans = {
    mp3: estimateBatch(items, "mp3"),
    wav: estimateBatch(items, "wav"),
    flac: estimateBatch(items, "flac"),
  };

  return (
    <main className="app-shell">
      <input
        ref={picker}
        className="visually-hidden"
        type="file"
        multiple
        accept={ACCEPT}
        aria-label="Choose one or several WAV, MP3 or FLAC audio files"
        onChange={choose}
      />
      <div className="workspace">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Convert">
            <Logo size={28} className="brand-logo" />
            <span className="brand-name">Convert</span>
          </a>
          <div className="topbar-actions">
            {items.length > 0 && (
              <motion.button type="button" className="top-add" onClick={() => picker.current?.click()}
                whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: .96 }}
                title="Add more audio files (Ctrl/⌘ + O)"><Plus size={14} /> <span>Add files</span></motion.button>
            )}
            <div className="topbar-right"><span className="topbar-led" /><span>{statusText}</span></div>
            <ThemeToggle />
          </div>
        </header>

        <motion.section
          className={`drop-frame ${dragging ? "dragging" : ""} ${selected ? "has-file" : ""} ${items.length > 1 ? "has-queue" : ""}`}
          aria-label="Audio converter workspace. Drop files anywhere on the page to add them."
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            pointerX.set(event.clientX - rect.left);
            pointerY.set(event.clientY - rect.top);
          }}
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.993 }}
          animate={{ opacity: 1, scale: dragging && !reduceMotion ? 1.001 : 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 25 }}
        >
          <motion.div className="hover-spotlight" style={{ background: spotlight }} aria-hidden="true" />
          <motion.div className="drag-halo" aria-hidden="true" initial={false}
            animate={{ opacity: dragging ? 1 : 0, scale: dragging ? 1 : .96 }}
            transition={{ duration: reduceMotion ? 0 : .22 }} />
          <AnimatePresence mode="wait" initial={false}>
            {!selected ? (
              <motion.div className="empty-state" key="empty"
                initial={reduceMotion ? false : { opacity: 0, filter: "blur(5px)", y: 9 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: dragging ? -5 : 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, filter: "blur(5px)", y: -8 }}
                transition={{ duration: reduceMotion ? 0 : .32 }}>
                <StackMark active={dragging} />
                <motion.div className="empty-copy" animate={reduceMotion ? undefined : { y: dragging ? -2 : 0 }}>
                  <h1>{dragging ? "Let them go." : "Drop audio here."}</h1>
                  <p>{dragging ? "Every file joins your collection." : "One track or a whole collection. Zero friction."}</p>
                </motion.div>
                <motion.button type="button" className="browse-button" onClick={() => picker.current?.click()}
                  whileHover={reduceMotion ? undefined : { y: -2, scale: 1.025 }}
                  whileTap={reduceMotion ? undefined : { scale: .965 }}>
                  <Upload size={14} strokeWidth={1.9} /> Select audio <span className="button-shortcut"><Command size={11} /> O</span>
                </motion.button>
                <div className="paste-copy"><span className="paste-or">or</span> drop multiple files · paste from clipboard</div>
              </motion.div>
            ) : (
              <motion.div className={`loaded-state ${items.length > 1 ? "multi-state" : ""}`} key="loaded"
                initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(7px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -9, filter: "blur(6px)" }}
                transition={{ duration: reduceMotion ? 0 : .42, ease: [.22, 1, .36, 1] }}>
                <div className="studio-grid">
                  <div className="focus-panel">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={selected.id} initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                        transition={{ duration: reduceMotion ? 0 : .19 }}>
                        <div className="loaded-heading">
                          <div className="file-badge"><FileAudio2 size={17} strokeWidth={1.45} /></div>
                          <div className="file-title-group">
                            <div className="file-kicker">{items.length > 1 ? `TRACK ${items.findIndex(item => item.id === selected.id) + 1} / ${items.length}` : "FILE RECEIVED"} <span className="file-kicker-check">✓</span></div>
                            <h1 title={selected.file.name}>{selected.file.name}</h1>
                            <div className="file-meta"><span>{selected.format.toUpperCase()}</span><i /><span>{bytesLabel(selected.file.size)}</span>{preview.duration > 0 && <><i /><span>{Math.floor(preview.duration / 60)}:{String(Math.floor(preview.duration % 60)).padStart(2, "0")}</span></>}</div>
                          </div>
                          <motion.button className="replace-button" type="button" aria-label="Remove selected file"
                            title="Remove selected file" onClick={() => removeItem(selected.id)}
                            disabled={job?.id === selected.id} whileHover={reduceMotion ? undefined : { rotate: 90 }}><X size={17} /></motion.button>
                        </div>
                        <Waveform peaks={preview.peaks} duration={preview.duration} currentTime={preview.currentTime}
                          playing={preview.playing} playable={preview.playable} message={preview.waveformMessage}
                          onToggle={() => { void preview.toggle(); }} onSeek={preview.seek} readTime={preview.readTime} />
                        <div className="export-heading"><span>EXPORT AS</span><span>CHOOSE A FORMAT <ArrowRight size={13} /></span></div>
                        <div className="export-grid">
                          {targets?.map((target, index) => {
                            const convertingThis = job?.id === selected.id && job.target === target;
                            const done = Boolean(selected.completed[target]);
                            const copy = targetCopy(selected.format, target);
                            return (
                              <motion.button type="button" key={target} title={copy.detail}
                                className={`export-button ${index === 0 ? "export-primary" : "export-secondary"} ${done ? "export-done" : ""}`}
                                onClick={() => { void exportAs(selected, target); }} disabled={Boolean(job)}
                                whileHover={reduceMotion || job ? undefined : { y: -3 }}
                                whileTap={reduceMotion || job ? undefined : { scale: .982 }}
                                transition={{ type: "spring", stiffness: 340, damping: 24 }}>
                                <span className="export-inner">
                                  <span className="export-name">{done ? <Check size={17} /> : convertingThis ? <RefreshCw className="spin" size={17} /> : <ArrowDownToLine size={17} />}<strong>{target.toUpperCase()}</strong></span>
                                  <span className="export-arrow"><ArrowRight size={16} /></span>
                                </span>
                                <span className="export-sub">{convertingThis ? `Converting · ${Math.round(progress * 100)}%` : done ? "Download again" : copy.sub}</span>
                                <span className="export-estimate">{estimateLabel(estimateItem(selected, target))}</span>
                                {convertingThis && <motion.span className="export-progress" style={{ scaleX: selected.progress, transformOrigin: "left" }} />}
                              </motion.button>
                            );
                          })}
                        </div>
                        <div className="export-footnote">
                          <span>{job ? "Conversion in progress · You can still drop more files." : "Converted on your device. Never uploaded."}</span>
                          <span>{job ? `${Math.round(progress * 100)}%` : runtimeStatus === "loading" ? "WARMING UP" : runtimeStatus === "error" ? "RETRIES ON EXPORT" : "READY"}</span>
                        </div>
                        {selected.error && <p className="track-error" role="alert">{selected.error}</p>}
                      </motion.div>
                    </AnimatePresence>
                    {items.length === 1 && (
                      <motion.button type="button" className="another-file" onClick={() => picker.current?.click()}
                        whileHover={reduceMotion ? undefined : { x: 2 }}>
                        <Plus size={14} /> Add more audio files <ArrowRight size={13} />
                      </motion.button>
                    )}
                  </div>
                  {items.length > 1 && (
                    <CollectionPanel
                      items={items}
                      selectedId={selected.id}
                      job={job}
                      batchStage={batchStage}
                      batchCompletedIds={batchCompletedIds}
                      progress={progress}
                      batchPlans={batchPlans}
                      readyArchive={readyArchive}
                      reduceMotion={reduceMotion}
                      onAdd={() => picker.current?.click()}
                      onSelect={setActiveId}
                      onRemove={removeItem}
                      onExport={batchExport}
                      onDownloadPrepared={() => readyArchive && saveBlob(readyArchive.blob, readyArchive.name)}
                      onClear={clearAll}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <AnimatePresence>
          {error && (
            <motion.div role="alert" className="error-notice" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              <span>{error}</span>
              <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>
        <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
        <footer className="bottom-bar">
          <div className="footer-brand">
            <Logo size={18} />
            <span><b>Convert</b> By <a href="https://bemorin.com" target="_blank" rel="noopener noreferrer">Ben Morin</a></span>
          </div>
          <nav className="footer-links" aria-label="About this app">
            <a href="https://github.com/bemorin/convert" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" /></a>
            <a href="/licenses">Licenses</a>
          </nav>
        </footer>
      </div>
      <AnimatePresence>
        {dragging && (
          <motion.div className="global-drop-overlay" role="presentation" aria-hidden="true"
            initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : .16 }}>
            <motion.div className="global-drop-content" initial={reduceMotion ? false : { y: 12, scale: .97 }}
              animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .97 }} transition={{ type: "spring", stiffness: 270, damping: 24 }}>
              <StackMark active />
              <Files size={20} strokeWidth={1.45} />
              <strong>{items.length ? "Add to your collection" : "Drop your audio"}</strong>
              <span>WAV · MP3 · FLAC · MULTIPLE FILES</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
