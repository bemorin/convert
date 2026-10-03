import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_QUEUE_BYTES, MAX_QUEUE_FILES, fileIdentity, formatQueueCount, planAddition, uniqueExportNames } from '../lib/queue.ts';

const file = (name: string, size = 1024, lastModified = 1) => ({ name, size, lastModified });

test('Can add several files in one drop while retaining existing files', () => {
  const initial = [file('old.wav')];
  const result = planAddition(initial, [file('one.mp3'), file('two.flac')]);
  assert.deepEqual(result.accepted.map(f => f.name), ['one.mp3', 'two.flac']);
  assert.deepEqual(initial.map(f => f.name), ['old.wav']);
});
test('Repeated selections and duplicate files in the same drop do not multiply queue entries', () => {
  const first = file('same.wav');
  const result = planAddition([first], [first, file('new.wav'), file('new.wav')]);
  assert.deepEqual(result.accepted.map(f => f.name), ['new.wav']);
  assert.equal(result.rejected.length, 2);
  assert.notEqual(fileIdentity(first), fileIdentity(file('same.wav', 1024, 2)));
});
test('Caps collection size and file count', () => {
  assert.equal(planAddition([], Array.from({length: MAX_QUEUE_FILES+1}, (_, i) => file(`${i}.wav`))).accepted.length, MAX_QUEUE_FILES);
  assert.equal(planAddition([], [file('huge.wav', MAX_QUEUE_BYTES+1)]).accepted.length, 0);
  assert.ok(MAX_QUEUE_BYTES > 200 * 1024 * 1024);
});
test('Batch filenames cannot overwrite each other or create paths', () => {
  assert.deepEqual(uniqueExportNames([{name:'a.wav'}, {name:'a.mp3'}, {name:'../../a.flac'}, {name:'b.wav'}], 'flac'), ['a.flac', 'a (2).flac', 'a (3).flac', 'b.flac']);
});
test('Small collection labels are grammatical', () => {
  assert.equal(formatQueueCount(1), '1 FILE');
  assert.equal(formatQueueCount(8), '8 FILES');
});

