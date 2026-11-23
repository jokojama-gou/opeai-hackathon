import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition as step } from './sharing-state.mjs';
const answer = (state, person, value) => step(state, { type: 'answer', person, value });
test('one answer cannot share; once-only approval does not carry forward', () => {
  let s = answer(initialState(), 0, 'once');
  assert.equal(s.shared, false);
  s = answer(s, 1, 'once');
  assert.equal(s.shared, true);
  s = step(s, { type: 'next' });
  assert.equal(s.shared, false);
});
test('one-sided ongoing approval cannot silently combine across conversations', () => {
  let s = answer(answer(initialState(), 0, 'always'), 1, 'once');
  assert.equal(s.trusted, false);
  s = step(s, { type: 'next' });
  s = answer(s, 1, 'always');
  assert.equal(s.shared, false);
  assert.equal(s.trusted, false);
});
test('mutual ongoing approval auto-shares next fixture; revocation preserves past only', () => {
  let s = answer(answer(initialState(), 0, 'always'), 1, 'always');
  s = step(s, { type: 'next' });
  assert.equal(s.shared, true);
  s = step(s, { type: 'revoke' });
  assert.equal(s.shared, true);
  s = step(s, { type: 'next' });
  assert.equal(s.shared, false);
  assert.equal(s.history.every(item => item.shared), true);
  s = answer(s, 0, 'always');
  assert.equal(s.trusted, false);
});
test('decline prevents sharing; withdrawal while waiting requires fresh approval', () => {
  let s = answer(answer(initialState(), 0, 'always'), 1, 'decline');
  s = answer(s, 1, 'always');
  assert.equal(s.shared, false);
  assert.equal(s.trusted, false);
  s = answer(initialState(), 0, 'always');
  s = step(s, { type: 'cancel', person: 0 });
  s = answer(s, 1, 'always');
  assert.equal(s.shared, false);
});
