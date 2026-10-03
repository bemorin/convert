import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateBatch, estimateItem, estimateLabel, readAudioFacts, MAX_BATCH_ESTIMATED_OUTPUT_BYTES } from '../lib/estimates.ts';
const MB = 1024 * 1024;
const facts = { duration: 15 * 60, sampleRate: 48000, channels: 2 };

test('A large WAV collection can export MP3 while WAV output is blocked, independently per format', () => {
  const items = [
    { file: { size: 170 * MB }, format: 'wav' as const, facts },
    { file: { size: 4 * MB }, format: 'mp3' as const, facts: { duration: 120, sampleRate: 44100, channels: 2 } },
  ];
  const mp3 = estimateBatch(items, 'mp3');
  const wav = estimateBatch(items, 'wav');
  assert.equal(mp3.ready, true);
  assert.equal(mp3.allowed, true);
  assert.ok(mp3.expectedBytes < 50 * MB);
  assert.equal(wav.ready, true);
  assert.equal(wav.allowed, false);
  assert.match(wav.reason ?? '', /WAV ZIP/);
});

test('Known original-format sizes are exact and bypass duration metadata', () => {
  const item = { file: {size: 100 * MB}, format: 'mp3' as const };
  assert.equal(estimateItem(item, 'mp3')?.confidence, 'exact');
  assert.equal(estimateBatch([item], 'mp3').allowed, true);
  assert.equal(estimateBatch([item], 'wav').allowed, false);
});

test('Cached output bytes override estimates and can enable an otherwise uncertain format', () => {
  const item = { file: {size: 7 * MB}, format: 'mp3' as const, completed: { flac: {size: 19 * MB} } };
  const result = estimateBatch([item], 'flac');
  assert.equal(result.ready, true);
  assert.equal(result.allowed, true);
  assert.equal(result.confidence, 'exact');
});

test('FLAC reports a content-dependent range instead of a fake exact value', () => {
  const item = { file: {size: 80 * MB}, format: 'wav' as const, facts: { duration: 200, sampleRate: 48000, channels: 2 } };
  const result = estimateBatch([item], 'flac');
  assert.equal(result.ready, true);
  assert.equal(result.confidence, 'range');
  assert.ok(result.upperBytes > result.lowerBytes);
  assert.match(estimateLabel(result), /^≈ .+–.+/);
});

test('An unknown duration disables only conversions that cannot be sized safely', () => {
  const item = { file: {size: 3 * MB}, format: 'flac' as const };
  assert.equal(estimateBatch([item], 'flac').allowed, true);
  assert.equal(estimateBatch([item], 'mp3').ready, false);
  assert.equal(estimateBatch([item], 'wav').allowed, false);
});

test('MP3 at 320 kbps uses duration, not a constant source-size multiplier', () => {
  const item = { file: {size: 180 * MB}, format: 'wav' as const, facts: { duration: 300, channels: 2, sampleRate: 48000 } };
  const mp3 = estimateItem(item, 'mp3')!;
  assert.ok(mp3.expectedBytes > 11 * MB && mp3.expectedBytes < 13 * MB);
  assert.ok(mp3.upperBytes <= MAX_BATCH_ESTIMATED_OUTPUT_BYTES);
});

test('Reads WAV sample rate, channels and duration from the header', async () => {
  const b = new Uint8Array(44);
  const v = new DataView(b.buffer);
  for (const [at,str] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']] as const) for(let i=0;i<str.length;i++) b[at+i]=str.charCodeAt(i);
  v.setUint32(4, 36+48000*2*2, true);
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,2,true);
  v.setUint32(24,48000,true); v.setUint32(28,192000,true); v.setUint16(32,4,true); v.setUint16(34,16,true);
  v.setUint32(40,192000,true);
  // .size=192044 from a Blob composed of mostly padding, no whole decode.
  const file = new File([b, new Uint8Array(192000)], 'a.wav');
  const result = await readAudioFacts(file, 'wav');
  assert.equal(result.sampleRate, 48000);
  assert.equal(result.channels, 2);
  assert.equal(result.duration, 1);
});

test('Reads FLAC STREAMINFO properties without decoding the whole audio', async () => {
  const b = new Uint8Array(42);
  b.set([102,76,97,67, 128,0,0,34]);
  const rate=48000, channels=2, samples=480000;
  b[18] = rate>>12; b[19] = rate>>4 & 255;
  b[20] = (rate & 15)<<4 | (channels-1)<<1 | 0;
  b[21] = samples/2**32 & 15; b[22] = samples>>>24; b[23] = samples>>>16 &255;
  b[24] = samples>>>8 &255; b[25]=samples &255;
  const result = await readAudioFacts(new File([b], 'a.flac'), 'flac');
  assert.equal(result.sampleRate, rate);
  assert.equal(result.channels, channels);
  assert.equal(result.duration, 10);
});
