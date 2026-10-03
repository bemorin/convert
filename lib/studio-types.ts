import type { AudioFormat, SelectedAudio } from "./audio";
import type { AudioFacts } from "./estimates";

/** Shared domain types; UI components never own encoding or cache state. */
export type QueueItem = SelectedAudio & {
  facts?: AudioFacts;
  completed: Partial<Record<AudioFormat, Blob>>;
  converting: AudioFormat | null;
  progress: number;
  error: string | null;
};
export type Job =
  | { id: number; target: AudioFormat; kind: "single" }
  | { id: number; target: AudioFormat; kind: "batch"; index: number; total: number };
export type BatchStage = "converting" | "packaging";
export type ReadyArchive = { name: string; blob: Blob; fileCount: number; format: AudioFormat };
