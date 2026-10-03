/** Browser-memory and UX budgets in one place. Changes require cross-browser tests. */
const MiB = 1024 * 1024;

export const MAX_BYTES = 200 * MiB; // One input
export const WAVEFORM_MAX_BYTES = 48 * MiB; // Avoid decoding very large previews
export const MAX_QUEUE_FILES = 24;
export const MAX_QUEUE_BYTES = 450 * MiB; // All original inputs in the collection
export const MAX_BATCH_ESTIMATED_OUTPUT_BYTES = 200 * MiB; // Actual ZIP output safety cap
