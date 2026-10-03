/** File-count-based batch progress, separate from ZIP packaging progress.
 * FFmpeg reports fractional progress per file; some files can be reused byte-for-byte.
 */
export function batchFraction(completedFiles: number, totalFiles: number, currentFraction = 0): number {
  if (!Number.isFinite(totalFiles) || totalFiles <= 0) return 0;
  const completed = Math.max(0, Math.min(totalFiles, completedFiles));
  const current = Math.max(0, Math.min(1, Number.isFinite(currentFraction) ? currentFraction : 0));
  return Math.min(1, (completed + (completed === totalFiles ? 0 : current)) / totalFiles);
}
