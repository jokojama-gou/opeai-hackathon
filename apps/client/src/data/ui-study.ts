/** UI検討専用 / ui-study-20260913. K01 schema・API enumではない。人工文字だけを使用。 */
export const studyIdentity = { version: 'ui-study-20260913', viewer: 'ui-self', at: '2026-09-13T12:00:00Z' } as const;

export const studyCases = [
  { id: 'duplicate', label: '通常・重複', note: '対応する発言は出典2件。片側の発言と別時点の反復を保持。', acceptance: 'AC05/06/07' },
  { id: 'conflict', label: '原文の相違', note: '土曜と日曜を併記。決定扱いせず、両方の原文へ。', acceptance: 'AC06/07' },
  { id: 'unknown', label: '話者・順序・時刻不明', note: '話者と順序は別の不明状態。位置不明の発言を時系列へ挿入しない。', acceptance: 'AC06/07' },
  { id: 'pending', label: '相手の共有回答待ち', note: '自分の記録行→U03。会話ID、相手の本文/日時/派生タイトルなし。', acceptance: 'AC03/04' },
  { id: 'alignment', label: '確認待ち：時間対応', note: 'needs_confirmation / alignment_unresolved。本文なし→U04。', acceptance: 'AC16' },
  { id: 'attribution', label: '確認待ち：人物', note: 'needs_confirmation / attribution_disputed。本文なし→U04。話者不明とは別。', acceptance: 'AC04/16' },
  { id: 'scope', label: '確認待ち：範囲変更', note: 'needs_confirmation / scope_changed。継続許可があっても再確認。', acceptance: 'AC16/18' },
  { id: 'confirmation-expired', label: '確認期限切れ', note: '音声期限に到達して再確認不可の例。個人記録へ戻る。', acceptance: 'AC03/16' },
  { id: 'audio-expired', label: '音声だけ期限切れ', note: '有効な文字を保持し、音声再生を無効化。', acceptance: 'AC07/13' },
  { id: 'text-expired', label: '文字の期限切れ', note: '本人期限410相当の表示例。対象の本文・タイトル・派生・出典なし。', acceptance: 'AC13' },
  { id: 'revoked', label: '共有を利用不可', note: '権限外/不存在404相当の共通表示。期限や取消の理由を推測しない。', acceptance: 'AC10/13' },
  { id: 'offline', label: '通信・権限確認不可', note: '取得済みの共有本文と出典も即座に伏せる。自分の端末内状態だけ残す。', acceptance: 'AC10/15' },
  { id: 'revision-stale', label: '出典の版が更新', note: '409相当。旧版本文も伏せる。再取得未接続のため開き直しても旧版へ戻さない。', acceptance: 'AC08 / §15.2' },
  { id: 'loading', label: '読込中', note: '未取得を空の成功にせず待機表示。', acceptance: 'AC15' },
  { id: 'failed', label: '読込失敗', note: '再試行は未接続と明示。成功ケースへ自動復帰しない。', acceptance: 'AC14/15' },
  { id: 'empty', label: '空', note: 'U01は初回の空。U06は表示データ0件の見本で、正式な統合状態の定義ではない。', acceptance: 'U01 / AC15（表示）' },
  { id: 'modules-loading', label: '整理・候補を生成中', note: '機能別に待機表示。利用可能な本文・出典は読める。', acceptance: 'U06' },
  { id: 'modules-failed', label: '整理・候補の失敗', note: '整理は再試行可の例、ToDoは上限超過で再試行不可。本文は読める。', acceptance: 'U06 / §15.3' },
] as const;
export type StudyCase = typeof studyCases[number]['id'];
export type SourceMode = 'ready' | 'loading' | 'failed' | 'missing' | 'stale';
export type Evidence = { sourceId: string; version: number; start: number; end: number };
export type StudySource = {
  id: string; version: number; provider: 'self' | 'peer'; text: string;
  startMs: number | null; endMs: number | null; audioExpiresAt: string; textExpiresAt: string;
};
export type StudyUtterance = {
  id: string; speaker: string | null; time: string | null; order: 'known' | 'unknown';
  conflict: boolean; refs: Evidence[];
};
export type StudyRecord = {
  id: string; kind: 'personal' | 'shared'; title: string; date?: string; partner?: string;
  state: string; tone: 'neutral' | 'warning' | 'positive';
};
type ReadableConversation = {
  kind: 'readable'; title: string; partner: string; utterances: StudyUtterance[];
  moduleState: 'ready' | 'loading' | 'failed';
};
type BlockedConversation = { kind: 'blocked'; heading: string; message: string; action: 'confirm' | 'personal' | 'retry' | 'back' };
export type StudyConversation = ReadableConversation | BlockedConversation | { kind: 'loading' } | { kind: 'failed' } | { kind: 'empty' };

const convId = 'ui-conversation-1';
const recordingId = 'ui-recording-self';
const source = (id: string, provider: StudySource['provider'], text: string, startMs: number | null): StudySource => ({
  id, version: 1, provider, text, startMs, endMs: startMs === null ? null : startMs + 2400,
  audioExpiresAt: '2026-09-19T05:10:00Z', textExpiresAt: '2026-10-12T05:10:00Z',
});
const ref = (s: StudySource): Evidence => ({ sourceId: s.id, version: s.version, start: 0, end: Array.from(s.text).length });

function material(caseId: StudyCase) {
  const conflict = caseId === 'conflict';
  const sources = [
    source('ui-a1', 'self', conflict ? '展示は土曜にしよう。' : '週末、展示を見に行こう。', 18000),
    source('ui-b1', 'peer', conflict ? '展示は日曜にしよう。' : '週末、展示を見に行こう。', 21000),
    source('ui-a2', 'self', '会場はまだ決めていない。', 26000),
    source('ui-b3', 'peer', 'いいね。', 34000),
    source('ui-a4', 'self', 'いいね。', 46000),
    source('ui-b5', 'peer', '帰りにカフェにも寄りたい🌿。', null),
  ].map((s) => caseId === 'audio-expired' ? { ...s, audioExpiresAt: studyIdentity.at } : s);
  const utterances: StudyUtterance[] = [
    { id: 'ui-line-1', speaker: null, time: '00:18', order: 'known', conflict, refs: sources.slice(0, 2).map(ref) },
    { id: 'ui-line-2', speaker: null, time: '00:26', order: 'known', conflict: false, refs: [ref(sources[2])] },
    { id: 'ui-line-3', speaker: null, time: '00:31', order: 'known', conflict: false, refs: [ref(sources[3])] },
    { id: 'ui-line-4', speaker: null, time: '00:46', order: 'known', conflict: false, refs: [ref(sources[4])] },
  ];
  if (caseId === 'unknown') {
    // 話者の確認と記録提供者は独立。Bの入力にも本人の発言が含まれる人工例。
    utterances.push({ id: 'ui-line-5', speaker: 'あなた（確認済み）', time: null, order: 'unknown', conflict: false, refs: [ref(sources[5])] });
  }
  return { sources, utterances };
}

const blocked: Partial<Record<StudyCase, BlockedConversation>> = {
  pending: { kind: 'blocked', heading: '相手の回答を待っています', message: '共有はまだ成立していません。自分の記録から確認できます。', action: 'personal' },
  alignment: { kind: 'blocked', heading: '範囲を確認し直してください', message: '2つの記録の時間対応を確認できませんでした。自分の記録で、同じ会話の範囲を確認してください。', action: 'confirm' },
  attribution: { kind: 'blocked', heading: '参加した人を確認し直してください', message: '人物の確認内容が一致していません。確認が揃うまで会話の本文は表示できません。', action: 'confirm' },
  scope: { kind: 'blocked', heading: '共有する範囲が変わりました', message: '訂正後の共有範囲を、それぞれ確認してください。継続共有の許可があっても再確認が必要です。', action: 'confirm' },
  'confirmation-expired': { kind: 'blocked', heading: '確認の期限が過ぎました', message: '音声の保存期限が過ぎているため、この記録では範囲の再確認を申請できません。自分の記録に戻れます。', action: 'personal' },
  'text-expired': { kind: 'blocked', heading: '文字の保存期限が過ぎました', message: 'この記録を使った会話本文・整理・出典は表示できません。', action: 'back' },
  revoked: { kind: 'blocked', heading: 'この会話を利用できません', message: '記録一覧に戻ってください。', action: 'back' },
  offline: { kind: 'blocked', heading: '接続を確認してください', message: '閲覧できる範囲を確認できないため、共有の本文と出典を表示していません。', action: 'retry' },
  'revision-stale': { kind: 'blocked', heading: '内容が更新されました', message: '出典の版が変わっています。現在の根拠を確認し直すまで、以前の会話本文・整理・原文は表示していません。', action: 'retry' },
};

/** 取得境界も人工専用。ネットワーク・永続化・成功fallbackを持たない。 */
export const studyRepository = {
  conversationId: convId,
  recordingId,
  conversation(caseId: StudyCase): StudyConversation {
    const withheld = blocked[caseId];
    if (withheld) return withheld;
    if (caseId === 'loading') return { kind: 'loading' };
    if (caseId === 'failed') return { kind: 'failed' };
    if (caseId === 'empty') return { kind: 'empty' };
    return {
      kind: 'readable', title: '週末の展示の相談', partner: '葵さん', utterances: material(caseId).utterances,
      moduleState: caseId === 'modules-loading' ? 'loading' : caseId === 'modules-failed' ? 'failed' : 'ready',
    };
  },
  records(caseId: StudyCase): StudyRecord[] {
    if (['empty', 'loading', 'failed'].includes(caseId)) return [];
    const own: StudyRecord = { id: 'ui-recording-local', kind: 'personal', title: '9月12日 18:30の会話', date: '9月12日 · 18:30', state: '端末に保存済み · 未送信', tone: 'neutral' };
    if (caseId === 'pending') return [{ ...own, id: recordingId, title: '9月12日 14:10の会話', date: '9月12日 · 14:10', state: '葵さんの共有回答待ち', tone: 'warning' }];
    const c = this.conversation(caseId);
    const shared: StudyRecord = c.kind === 'readable'
      ? { id: convId, kind: 'shared', title: c.title, date: '9月12日 · 14:10', partner: c.partner, state: caseId === 'conflict' ? '相違あり' : '共有中 · 本文を確認できます', tone: caseId === 'conflict' ? 'warning' : 'positive' }
      : { id: convId, kind: 'shared', title: c.kind === 'blocked' ? c.heading : '共有会話', state: '本文を表示していません', tone: 'warning' };
    return [own, shared];
  },
  sources(caseId: StudyCase, lineId: string): StudySource[] {
    const c = this.conversation(caseId);
    if (c.kind !== 'readable') return [];
    const line = c.utterances.find((l) => l.id === lineId);
    if (!line) return [];
    return line.refs.map((r) => material(caseId).sources.find((s) => s.id === r.sourceId && s.version === r.version)!).filter(Boolean);
  },
  quote(caseId: StudyCase, line: StudyUtterance): string {
    const texts = this.sources(caseId, line.id).map((s) => {
      const r = line.refs.find((x) => x.sourceId === s.id)!;
      return Array.from(s.text).slice(r.start, r.end).join('');
    });
    return [...new Set(texts)].join(' / ');
  },
};

export function audioAvailability(s: StudySource): { available: boolean; label: string } {
  if (Date.parse(s.audioExpiresAt) <= Date.parse(studyIdentity.at)) return { available: false, label: '音声の保存期限が過ぎました' };
  if (s.startMs === null || s.endMs === null) return { available: false, label: '音声の位置を確認できないため再生できません' };
  if (s.endMs <= s.startMs) return { available: false, label: '再生できる範囲がありません' };
  return { available: true, label: '原音を再生' };
}

export function sourceTime(s: StudySource): string {
  const format = (n: number) => `${String(Math.floor(n / 60000)).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')}`;
  return s.startMs === null || s.endMs === null ? '時刻不明' : `${format(s.startMs)}–${format(s.endMs)}（推定）`;
}
