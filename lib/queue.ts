import { bytesLabel, type AudioFormat } from "./audio.ts";
import { MAX_QUEUE_BYTES, MAX_QUEUE_FILES } from "./limits.ts";
export { MAX_QUEUE_BYTES, MAX_QUEUE_FILES } from "./limits.ts";


type Identity = Pick<File, "name" | "size" | "lastModified">;

export function fileIdentity(file: Identity) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

/** Reject accidental duplicate drops; do not silently exceed browser memory limits. */
export function planAddition<T extends Identity>(existing: readonly T[], incoming: readonly T[]) {
  const seen = new Set(existing.map(fileIdentity));
  let bytes = existing.reduce((total, file) => total + file.size, 0);
  const accepted: T[] = [];
  const rejected: string[] = [];
  for (const file of incoming) {
    if (seen.has(fileIdentity(file))) {
      rejected.push(`${file.name}: already in your collection`);
      continue;
    }
    if (existing.length + accepted.length >= MAX_QUEUE_FILES) {
      rejected.push(`Collection limit reached (${MAX_QUEUE_FILES} files).`);
      break;
    }
    if (bytes + file.size > MAX_QUEUE_BYTES) {
      rejected.push(`${file.name}: collection exceeds the ${bytesLabel(MAX_QUEUE_BYTES)} safety limit`);
      continue;
    }
    seen.add(fileIdentity(file));
    accepted.push(file);
    bytes += file.size;
  }
  return { accepted, rejected };
}

/** ZIP paths must be unique, independent of directory components in source filenames. */
export function uniqueExportNames(files: readonly { name: string }[], target: AudioFormat) {
  const used = new Set<string>();
  return files.map(({ name }) => {
    const safe = name.replace(/\\/g, "/").split("/").pop()!
      .replace(/[\x00-\x1f<>:"|?*]/g, "_")
      .replace(/\.[^.]+$/, "")
      .trim() || "audio";
    let filename = `${safe}.${target}`;
    let index = 2;
    while (used.has(filename.toLowerCase())) filename = `${safe} (${index++}).${target}`;
    used.add(filename.toLowerCase());
    return filename;
  });
}

export function formatQueueCount(count: number) {
  return `${count} FILE${count === 1 ? "" : "S"}`;
}

