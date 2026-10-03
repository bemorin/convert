import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectAudio,
  otherFormats,
  bytesLabel,
  timeLabel,
  targetCopy,
  downloadName,
  peaksFromBuffer,
} from "../lib/audio.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

test("sniffs WAV bytes instead of trusting the filename", async () => {
  const file = new File([bytes("RIFF\0\0\0\0WAVEfmt ")], "not-really.mp3", { type: "audio/mpeg" });
  assert.equal(await inspectAudio(file), "wav");
});

test("sniffs FLAC and MP3 signatures", async () => {
  assert.equal(await inspectAudio(new File([bytes("fLaC....")], "audio.flac")), "flac");
  assert.equal(await inspectAudio(new File([bytes("ID3....")], "audio.mp3")), "mp3");
  assert.equal(await inspectAudio(new File([Uint8Array.from([0xff, 0xfb, 0x90, 0x64])], "audio.mp3")), "mp3");
});

test("rejects empty and unsupported files", async () => {
  await assert.rejects(inspectAudio(new File([], "empty.wav")), /empty/);
  await assert.rejects(inspectAudio(new File([bytes("GIF89a")], "fake.wav")), /supported/);
});

test("suggests exactly the other two formats", () => {
  assert.deepEqual(otherFormats("wav"), ["mp3", "flac"]);
  assert.deepEqual(otherFormats("mp3"), ["wav", "flac"]);
  assert.deepEqual(otherFormats("flac"), ["wav", "mp3"]);
});

test("has readable labels and stable filenames", () => {
  assert.equal(bytesLabel(1024), "1.0 KB");
  assert.equal(bytesLabel(10 * 1024 * 1024), "10.0 MB");
  assert.equal(timeLabel(126.6), "2:06");
  assert.equal(downloadName("field.recording.wav", "mp3"), "field.recording.mp3");
});

test("does not promise regained quality when transcoding from MP3", () => {
  assert.match(targetCopy("mp3", "flac").detail, /Cannot restore/);
  assert.match(targetCopy("mp3", "wav").detail, /Cannot restore/);
});

test("waveform bins come from samples, not random values", () => {
  const mockBuffer = {
    length: 8,
    numberOfChannels: 1,
    getChannelData: () => Float32Array.from([0, 0, 0, 0, 1, 1, 1, 1]),
  } as unknown as AudioBuffer;
  const result = peaksFromBuffer(mockBuffer, 2);
  assert.equal(result.length, 2);
  assert.ok(result[0] < result[1]);
  assert.equal(result[1], 1);
});
