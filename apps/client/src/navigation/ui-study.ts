import type { Evidence, StudyRecord, StudySource } from '../data/ui-study';

/** 検討モック内の操作先。公開navigation契約ではない。 */
export type StudyDestination = {
  screen: 'U02' | 'U03' | 'U04' | 'U06' | 'U08' | 'U09' | 'U10' | 'U12' | 'U13' | 'U14' | 'U15' | 'U07指摘';
  intent: string;
  recordingId?: string; conversationId?: string; lineId?: string; sourceId?: string; sourceVersion?: number;
  evidence?: Evidence;
};
export function recordDestination(row: StudyRecord): StudyDestination {
  return row.kind === 'personal'
    ? { screen: 'U03', recordingId: row.id, intent: '自分の記録を開く' }
    : { screen: 'U06', conversationId: row.id, intent: '共有会話を開く' };
}
export function sourceDestination(s: StudySource, conversationId: string, evidence: Evidence): StudyDestination {
  return { screen: s.provider === 'self' ? 'U08' : 'U07指摘', intent: s.provider === 'self' ? '文字を訂正' : '気になる点を伝える', conversationId, sourceId: s.id, sourceVersion: s.version, evidence };
}
