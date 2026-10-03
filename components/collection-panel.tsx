"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, AudioLines, Check, Plus, Trash2, X } from "lucide-react";
import { bytesLabel, type AudioFormat } from "@/lib/audio";
import { estimateLabel, shortSize, MAX_BATCH_ESTIMATED_OUTPUT_BYTES, type estimateBatch } from "@/lib/estimates";
import { MAX_QUEUE_FILES } from "@/lib/queue";
import type { BatchStage, Job, QueueItem, ReadyArchive } from "@/lib/studio-types";

type Props = {
  items: readonly QueueItem[];
  selectedId: number;
  job: Job | null;
  batchStage: BatchStage;
  batchCompletedIds: ReadonlySet<number>;
  progress: number;
  batchPlans: Record<AudioFormat, ReturnType<typeof estimateBatch>>;
  readyArchive: ReadyArchive | null;
  reduceMotion: boolean | null;
  onAdd: () => void;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
  onExport: (format: AudioFormat) => void | Promise<void>;
  onDownloadPrepared: () => void;
  onClear: () => void;
};

/** Pure collection presentation; conversion, caching and queue concurrency live in AudioStudio. */
export function CollectionPanel({
  items, selectedId, job, batchStage, batchCompletedIds, progress,
  batchPlans, readyArchive, reduceMotion, onAdd, onSelect, onRemove,
  onExport, onDownloadPrepared, onClear,
}: Props) {
  return (
    <aside className="queue-panel" aria-label="Audio file collection">
        <div className="queue-heading">
          <div><span className="eyebrow">YOUR COLLECTION</span><h2>{items.length} files <span>/ {MAX_QUEUE_FILES} max</span></h2></div>
          <motion.button className="queue-add" aria-label="Add audio files" title="Add audio files"
            onClick={() => onAdd()} whileHover={reduceMotion ? undefined : { rotate: 90 }}><Plus size={16} /></motion.button>
        </div>
        {job?.kind === "batch" && (
          <div className="batch-live" role="region" aria-label="Batch export progress">
            <div className="batch-live-top">
              <span className="batch-live-icon" aria-hidden="true"><AudioLines size={16} /></span>
              <div className="batch-live-copy">
                <strong>{batchStage === "packaging" ? "Preparing your download" : `Converting to ${job.target.toUpperCase()}`}</strong>
                <span>{batchStage === "packaging"
                  ? `${job.total} tracks converted · Creating ZIP`
                  : `Track ${job.index} of ${job.total} · ${Math.round(progress * 100)}% complete`}</span>
              </div>
              <span className="batch-live-value" aria-hidden="true">{Math.round(progress * 100)}%</span>
            </div>
            <div className="batch-live-rail" role="progressbar"
              aria-label={batchStage === "packaging" ? "ZIP packaging" : "Collection conversion"}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <motion.div className="batch-live-fill" initial={false}
                animate={{ scaleX: progress }} transition={{ duration: reduceMotion ? 0 : .18, ease: "easeOut" }} />
            </div>
            <span className="batch-live-foot">You can add more tracks while this export finishes.</span>
          </div>
        )}
        <div className="queue-list" role="list" aria-label="Tracks in your collection">
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <motion.div key={item.id} role="listitem" layout={reduceMotion ? false : true}
                initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}>
                <div className={`queue-entry ${selectedId === item.id ? "is-active" : ""} ${item.converting ? "is-converting" : ""}`}>
                  <button className="queue-select" type="button" onClick={() => onSelect(item.id)}
                    aria-current={selectedId === item.id ? "true" : undefined}
                    title={`Preview ${item.file.name}`}>
                    <span className="queue-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="queue-text"><span className="queue-filename" title={item.file.name}>{item.file.name}</span>
                      <span className="queue-meta">{item.format.toUpperCase()} · {bytesLabel(item.file.size)}
                        {job?.kind === "batch" && batchStage === "converting" && job.id === item.id
                          ? ` · ${item.converting ? Math.round(item.progress * 100) : 0}%`
                          : item.error ? " · ERROR" : ""}
                      </span></span>
                    {job?.kind === "batch" && batchCompletedIds.has(item.id)
                      ? <Check className="queue-check" size={13} aria-label="Included in export" />
                      : job?.kind !== "batch" && Object.keys(item.completed).length > 0 && <Check className="queue-check" size={12} aria-label="Converted" />}
                  </button>
                  <button className="queue-remove" type="button" title={`Remove ${item.file.name}`}
                    aria-label={`Remove ${item.file.name}`} disabled={job?.kind === "batch" || job?.id === item.id}
                    onClick={() => onRemove(item.id)}><X size={13} /></button>
                </div>
                {job?.kind === "batch" && batchStage === "converting" && job.id === item.id && (
                  <div className="queue-item-rail" role="progressbar" aria-label={`Converting ${item.file.name}`}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress * 100)}>
                    <motion.span className="queue-item-fill" initial={false}
                      animate={{ scaleX: item.converting ? item.progress : 0 }}
                      transition={{ duration: reduceMotion ? 0 : .17 }} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="batch-area">
          <span className="eyebrow">DOWNLOAD COLLECTION · ZIP</span>
          <div className="batch-grid">
            {(["mp3", "wav", "flac"] as AudioFormat[]).map((target) => {
              const plan = batchPlans[target];
              return (
                <motion.button key={target} className="batch-button" disabled={Boolean(job) || !plan.allowed}
                  aria-label={`Download collection as ${target.toUpperCase()} ZIP. ${estimateLabel(plan)}${plan.reason ? `. ${plan.reason}` : ""}`}
                  title={plan.reason ?? `Download all as ${target.toUpperCase()} in one ZIP`}
                  onClick={() => { void onExport(target); }} whileHover={reduceMotion || job ? undefined : { y: -2 }}
                  whileTap={reduceMotion || job ? undefined : { scale: .97 }}>
                  <span className="batch-format"><ArrowDownToLine size={12} /> {target.toUpperCase()}</span>
                  <span className="batch-size">{estimateLabel(plan)}</span>
                </motion.button>
              );
            })}
          </div>
          <p>{job?.kind === "batch" ? (batchStage === "packaging" ? "Packaging ZIP · Please keep this tab open." : `Track ${job.index}/${job.total} · ${Math.round(progress * 100)}% overall`) :
            Object.values(batchPlans).every((plan) => !plan.ready)
              ? "Analyzing file sizes. Matching originals can be exported immediately."
              : `Estimates per format · FLAC size varies with audio · Disabled = over ${shortSize(MAX_BATCH_ESTIMATED_OUTPUT_BYTES)} or unavailable metadata.`}</p>
          {readyArchive && <button className="prepared-zip" type="button" onClick={() => onDownloadPrepared()}>
            <Check size={13} /> Download {readyArchive.fileCount}-file {readyArchive.format.toUpperCase()} ZIP <ArrowDownToLine size={13} />
          </button>}
        </div>
        <button className="clear-queue" type="button" onClick={onClear} disabled={Boolean(job)}><Trash2 size={13} strokeWidth={1.6} aria-hidden="true" /> Clear collection</button>
      </aside>
  );
}
