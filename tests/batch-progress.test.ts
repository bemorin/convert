import test from "node:test";
import assert from "node:assert/strict";
import { batchFraction } from "../lib/batch-progress.ts";

test("batch progress follows processed files and current fraction", () => {
  assert.equal(batchFraction(0, 7), 0);
  assert.equal(batchFraction(2, 7, .5), 2.5 / 7);
  assert.equal(batchFraction(7, 7), 1);
});
test("batch progress clamps invalid engine readings safely", () => {
  assert.equal(batchFraction(-1, 7, -.2), 0);
  assert.equal(batchFraction(1, 7, 99), 2 / 7);
  assert.equal(batchFraction(1, 0, .5), 0);
  assert.equal(batchFraction(2, 7, Number.NaN), 2 / 7);
  assert.equal(batchFraction(999, 7), 1);
});
