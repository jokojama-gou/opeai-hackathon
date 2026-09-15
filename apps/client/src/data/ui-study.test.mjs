import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyCases, studyIdentity, studyRepository as repo, audioAvailability, sourceTime } from './ui-study.ts';
import { recordDestination, sourceDestination } from '../navigation/ui-study.ts';

// UI検討用データの不変条件。正式K01契約・サーバー認可・実音声のテストではない。
test('全表示ケースの出典ID・版・Unicode code point範囲が一致する', () => {
  let unicodeChecked = false;
  for (const { id } of studyCases) {
    const c = repo.conversation(id);
    if (c.kind !== 'readable') continue;
    for (const line of c.utterances) {
      const sources = repo.sources(id, line.id);
      assert.equal(sources.length, line.refs.length);
      for (const r of line.refs) {
        const source = sources.find((s) => s.id === r.sourceId);
        assert.equal(source.version, r.version);
        assert.ok(r.start >= 0 && r.end > r.start && r.end <= Array.from(source.text).length);
        assert.ok(repo.quote(id, line).includes(Array.from(source.text).slice(r.start, r.end).join('')));
        unicodeChecked ||= source.text.length > Array.from(source.text).length;
      }
    }
  }
  assert.ok(unicodeChecked);
});
test('duplicateは出典2件・片側発言・別時点の同文反復を残す', () => {
  const c = repo.conversation('duplicate');
  assert.equal(c.utterances[0].refs.length, 2);
  assert.equal(c.utterances[1].refs.length, 1);
  const repeats = c.utterances.filter((l) => repo.quote('duplicate', l) === 'いいね。');
  assert.equal(repeats.length, 2);
  assert.notEqual(repeats[0].time, repeats[1].time);
  assert.notEqual(repeats[0].refs[0].sourceId, repeats[1].refs[0].sourceId);
});
test('conflictは土曜と日曜を消さない', () => {
  const line = repo.conversation('conflict').utterances[0];
  assert.equal(line.conflict, true);
  assert.match(repo.quote('conflict', line), /土曜.*日曜/);
  assert.equal(repo.sources('conflict', line.id).length, 2);
});
test('話者不明と順序不明を独立させ、時刻nullを0へ変換しない', () => {
  const c = repo.conversation('unknown');
  assert.ok(c.utterances.some((l) => l.order === 'known' && l.speaker === null));
  const line = c.utterances.find((l) => l.order === 'unknown');
  assert.equal(line.speaker, 'あなた（確認済み）');
  const source = repo.sources('unknown', line.id)[0];
  assert.equal(source.provider, 'peer');
  assert.equal(source.startMs, null);
  assert.equal(sourceTime(source), '時刻不明');
  assert.equal(audioAvailability(source).available, false);
});
test('共有未成立は個人行→U03。会話ID・相手本文を渡さない', () => {
  const rows = repo.records('pending');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'personal');
  const target = recordDestination(rows[0]);
  assert.equal(target.screen, 'U03');
  assert.ok(target.recordingId);
  assert.equal(target.conversationId, undefined);
  assert.equal(repo.conversation('pending').kind, 'blocked');
  assert.deepEqual(repo.sources('pending', 'ui-line-1'), []);
});
test('共有行と独立した端末内個人行の宛先は別', () => {
  const [personal, shared] = repo.records('duplicate');
  assert.equal(recordDestination(shared).screen, 'U06');
  assert.equal(recordDestination(personal).screen, 'U03');
  assert.notEqual(personal.id, repo.recordingId);
});
test('確認待ち3理由と確認期限切れの操作を分ける', () => {
  for (const id of ['alignment', 'attribution', 'scope']) {
    assert.equal(repo.conversation(id).action, 'confirm');
    assert.deepEqual(repo.sources(id, 'ui-line-1'), []);
  }
  assert.equal(repo.conversation('confirmation-expired').action, 'personal');
});
test('音声期限到達時は文字が有効でも原音を再生できない', () => {
  const c = repo.conversation('audio-expired');
  assert.equal(c.kind, 'readable');
  for (const source of repo.sources('audio-expired', c.utterances[0].id)) {
    assert.equal(source.audioExpiresAt, studyIdentity.at);
    assert.ok(Date.parse(source.textExpiresAt) > Date.parse(studyIdentity.at));
    assert.equal(audioAvailability(source).label, '音声の保存期限が過ぎました');
    assert.ok(source.text);
  }
});
test('期限・共有失効・通信断・旧版では本文/出典/派生タイトルを伏せる', () => {
  for (const id of ['text-expired', 'revoked', 'offline', 'revision-stale']) {
    const c = repo.conversation(id);
    assert.equal(c.kind, 'blocked');
    assert.equal(c.utterances, undefined);
    assert.equal(c.title, undefined);
    assert.equal(c.partner, undefined);
    assert.deepEqual(repo.sources(id, 'ui-line-1'), []);
    const row = repo.records(id).find((r) => r.kind === 'shared');
    assert.equal(row.date, undefined);
    assert.equal(row.partner, undefined);
    assert.doesNotMatch(JSON.stringify({ c, row }), /展示|土曜|日曜|いいね/);
  }
  assert.notEqual(repo.conversation('text-expired').heading, repo.conversation('revoked').heading);
});
test('空・読込・失敗は別状態。機能失敗でも有効本文を残す', () => {
  for (const id of ['empty', 'loading', 'failed']) assert.equal(repo.conversation(id).kind, id);
  for (const id of ['modules-loading', 'modules-failed']) {
    assert.equal(repo.conversation(id).kind, 'readable');
    assert.ok(repo.conversation(id).utterances.length);
  }
});
test('自己入力はU08、他者入力は指摘。どちらも元出典の版/範囲を保つ', () => {
  const line = repo.conversation('duplicate').utterances[0];
  const [own, peer] = repo.sources('duplicate', line.id);
  const correction = sourceDestination(own, repo.conversationId, line.refs[0]);
  const issue = sourceDestination(peer, repo.conversationId, line.refs[1]);
  assert.equal(correction.screen, 'U08');
  assert.equal(issue.screen, 'U07指摘');
  assert.deepEqual(correction.evidence, line.refs[0]);
  assert.deepEqual(issue.evidence, line.refs[1]);
});
