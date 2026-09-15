import { useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { audioAvailability, sourceTime, studyCases, studyIdentity, studyRepository } from '../data/ui-study';
import type { SourceMode, StudyCase, StudyRecord, StudyUtterance } from '../data/ui-study';
import { recordDestination, sourceDestination } from '../navigation/ui-study';
import type { StudyDestination } from '../navigation/ui-study';
import { Badge, Button, Copy, Heading, Notice, StudyTheme, palettes } from '../ui/StudyPrimitives';

const srcModes: { id: SourceMode; label: string }[] = [
  { id: 'ready', label: '原文あり' }, { id: 'loading', label: '出典読込中' }, { id: 'failed', label: '出典失敗' },
  { id: 'missing', label: '出典なし' }, { id: 'stale', label: '版が更新' },
];

export default function UiStudy({ onExit }: { onExit: () => void }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 1000;
  const [palette, setPalette] = useState<'blue' | 'green'>('blue');
  const [caseId, setCaseId] = useState<StudyCase>('duplicate');
  const [screen, setScreen] = useState<'U01' | 'U06'>('U01');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('ready');
  const [stub, setStub] = useState<StudyDestination | null>(null);
  const [controls, setControls] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [lastRoute, setLastRoute] = useState<StudyDestination | null>(null);
  const theme = palettes[palette];
  const scenario = studyCases.find((c) => c.id === caseId)!;
  const conversation = studyRepository.conversation(caseId);
  const go = (target: StudyDestination) => {
    setLastRoute(target);
    if (target.screen === 'U06') { setScreen('U06'); setSourceId(null); }
    else setStub(target);
  };
  const close = () => {
    if (stub) setStub(null);
    else if (sourceId) setSourceId(null);
    else setScreen('U01');
  };
  useEffect(() => {
    const listener = Platform.OS === 'android'
      ? BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; })
      : undefined;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (Platform.OS === 'web') window.addEventListener('keydown', escape);
    return () => { listener?.remove(); if (Platform.OS === 'web') window.removeEventListener('keydown', escape); };
  }, [stub, sourceId, screen]);
  const changeCase = (next: StudyCase) => {
    setCaseId(next); setStub(null); setFeedback(''); setSourceMode('ready');
    if (!wide) setControls(false);
    if (next === 'pending') { setScreen('U01'); setSourceId(null); }
  };
  const simulateRetry = () => setFeedback('再試行先は未接続です。取得・処理の成功は返していません。状態の見本は検討パネルで切り替えられます。');

  return <StudyTheme.Provider value={theme}>
    <ScrollView style={s.root} scrollEnabled={!wide} contentContainerStyle={wide ? { height: '100%' } : { flexGrow: 1 }} aria-hidden={sourceId !== null || stub !== null} accessibilityElementsHidden={sourceId !== null || stub !== null} importantForAccessibility={sourceId !== null || stub !== null ? 'no-hide-descendants' : 'auto'}>
      <StatusBar style="dark" />
      <View style={s.masthead}>
        <View style={{ flex: 1, gap: 4 }}><Text style={s.eyebrow}>UI STUDY / 01</Text><Text style={s.studyTitle}>記録から、確かめられる会話へ。</Text></View>
        <Button onPress={onExit}>入口へ戻る</Button>
      </View>
      <View style={s.studyStrip}><Copy small>UI検討用の人工データ · 正式契約に未接続 · 保存／共有／録音／再生／APIは未接続</Copy></View>
      {!wide && <View style={s.mobileControls}><Button onPress={() => setControls(!controls)}>{controls ? '比較パネルを閉じる' : '状態・配色を比較する'}</Button></View>}
      <View style={[s.workspace, !wide && { flexDirection: 'column', gap: 12 }]}>
        {(wide || controls) && <ScrollView nestedScrollEnabled style={[s.controls, !wide && { width: '100%', height: Math.max(350, height - 390) }]} contentContainerStyle={s.controlContent}>
          <Text style={s.eyebrow}>COMPARE</Text><Heading>画面と状態を選ぶ</Heading>
          <Copy small>操作モックです。配色・余白・配置は採用前の案。MVP 2.1時点の状態比較で、最新仕様への適合確認は別途行います。</Copy>
          <View style={s.row}>
            <Button selected={screen === 'U01' && !sourceId} onPress={() => { setScreen('U01'); setSourceId(null); setControls(false); }}>U01 記録</Button>
            <Button disabled={caseId === 'pending'} selected={screen === 'U06' && !sourceId} onPress={() => { setScreen('U06'); setSourceId(null); setControls(false); }}>U06 本文</Button>
          </View>
          <Button disabled={conversation.kind !== 'readable'} onPress={() => { setScreen('U06'); setSourceMode('ready'); setSourceId('ui-line-1'); }}>U07 出典を開く</Button>
          <Copy small>U01直起動は開発用入口だけです。製品の起動先は「今日」U12。</Copy>
          {!wide && <Copy small>{scenario.acceptance} · {scenario.note}</Copy>}
          <View style={s.rule} />
          {studyCases.map((c, i) => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`検討状態 ${c.label}`} accessibilityState={{ selected: caseId === c.id }}
            onPress={() => changeCase(c.id)} style={[s.caseButton, caseId === c.id && { backgroundColor: theme.soft, borderColor: theme.accent }]}>
            <Text style={[s.caseNumber, { color: theme.accent }]}>{String(i + 1).padStart(2, '0')}</Text><Text style={[s.caseLabel, caseId === c.id && { color: theme.accent, fontWeight: '700' }]}>{c.label}</Text>
          </Pressable>)}
        </ScrollView>}
        <View style={[s.phoneColumn, !wide && { width: '100%', flex: 0 }, !wide && controls && { display: 'none' }]}>
          <View style={s.previewCaption}><Text style={s.eyebrow}>{sourceId ? 'U07 / 出典シート' : `${screen} / ${screen === 'U01' ? '記録ホーム' : '会話詳細'}`}</Text><Copy small>{palette === 'blue' ? '案A' : '案B'} · 通常の明色面</Copy></View>
          <View testID="study-preview" style={[s.phone, { height: wide ? Math.min(800, Math.max(340, height - 220)) : Math.max(460, height - 350) }]}>
            {screen === 'U01'
              ? <RecordHome caseId={caseId} go={go} retry={simulateRetry} />
              : <Conversation caseId={caseId} go={go} back={() => setScreen('U01')} retry={simulateRetry} openSource={(id) => { setSourceMode('ready'); setSourceId(id); }} />}
          </View>
          {!!feedback && <View accessibilityLiveRegion="polite" style={s.feedback}><Copy small>{feedback}</Copy></View>}
        </View>
        {wide && <ScrollView style={s.inspector} contentContainerStyle={s.controlContent}>
          <Text style={s.eyebrow}>DESIGN NOTES</Text><Heading>確認するポイント</Heading>
          <Badge>{scenario.acceptance}</Badge><Copy>{scenario.note}</Copy>
          <View style={s.rule} /><Copy small>配色比較 · 状態と導線は同じ</Copy>
          {(Object.keys(palettes) as ('blue' | 'green')[]).map((key) => <Button key={key} selected={palette === key} onPress={() => setPalette(key)}>{palettes[key].name}</Button>)}
          <Heading>Glassの境界</Heading><Copy small>この比較案では主タブ・録音操作面を対象とし、本文・出典は通常面です。本モックは実Glassを使わず、全環境で通常面を表示します。</Copy>
          <Copy small>対応iOS 26以降＋API利用可能時の実Glass、透明度低減、VoiceOver/TalkBackは後段の実機確認。色の違いで機能を変えません。</Copy>
          <Heading>未実装の操作先</Heading><Copy small>保存・訂正・指摘・取消・録音・他タブは、宛先と引数を示す戻れる仮画面です。状態を成功へ変更しません。</Copy>
          <Heading>最後の操作先</Heading><Text selectable style={s.code}>{lastRoute ? JSON.stringify(lastRoute, null, 2) : 'まだ操作していません'}</Text>
          <Copy small>{studyIdentity.version}{'\n'}閲覧者: {studyIdentity.viewer}{'\n'}判定時刻: {studyIdentity.at}</Copy>
        </ScrollView>}
      </View>
      {!wide && <View style={s.mobilePalette}><Button selected={palette === 'blue'} onPress={() => setPalette('blue')}>案A 青</Button><Button selected={palette === 'green'} onPress={() => setPalette('green')}>案B 緑</Button><Copy small>Glass未導入 · 通常面</Copy></View>}
    </ScrollView>
    <Modal visible={sourceId !== null || stub !== null} transparent animationType="none" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={[s.sheetShell, { maxHeight: height - 36 }]} accessibilityViewIsModal>
          {stub ? <ScrollView contentContainerStyle={s.sheetContent}>
            <Text style={s.eyebrow}>開発用 · 遷移確認</Text><Heading>{stub.screen} / {stub.intent}</Heading>
            <Notice title="この操作は未実装です">遷移先と引数の確認用です。保存・共有・取消・録音・再生・訂正・指摘・API処理は実行していません。</Notice>
            <Text selectable style={s.code}>{JSON.stringify(stub, null, 2)}</Text>
            <Button primary onPress={() => setStub(null)}>元の画面へ戻る</Button>
          </ScrollView> : <>
            <View style={s.sheetLab}>
              <Text style={s.eyebrow}>U07 / 人工状態を比較</Text>
              <ScrollView horizontal contentContainerStyle={s.row}>
                {srcModes.map((m) => <Button key={m.id} selected={sourceMode === m.id} onPress={() => { if (m.id === 'stale') changeCase('revision-stale'); setSourceMode(m.id); setFeedback(''); }}>{m.label}</Button>)}
                <Button onPress={() => changeCase('audio-expired')}>音声期限</Button><Button onPress={() => changeCase('text-expired')}>文字期限</Button>
                <Button onPress={() => changeCase('revoked')}>閲覧不可</Button><Button onPress={() => changeCase('offline')}>通信断</Button>
              </ScrollView>
              <Copy small>状態変更は見本の切替です。再生・権限確認は未接続。</Copy>
            </View>
            <SourceSheet caseId={caseId} lineId={sourceId!} mode={sourceMode} close={() => setSourceId(null)} go={go} retry={simulateRetry} />
            {!!feedback && <View accessibilityLiveRegion="polite" style={s.feedback}><Copy small>{feedback}</Copy></View>}
          </>}
        </View>
      </View>
    </Modal>
  </StudyTheme.Provider>;
}

function RecordHome({ caseId, go, retry }: { caseId: StudyCase; go: (d: StudyDestination) => void; retry: () => void }) {
  const [dateFilter, setDateFilter] = useState(false);
  const [partnerFilter, setPartnerFilter] = useState(false);
  const rows = studyRepository.records(caseId);
  const filtered = rows.filter((r) => (!dateFilter || r.date?.includes('9月13日')) && (!partnerFilter || r.partner === '葵さん'));
  const activeFilter = dateFilter || partnerFilter;
  const theme = useContext(StudyTheme);
  return <>
    <View style={s.appHeader}><View style={{ flex: 1 }}><Text style={s.eyebrow}>YOUR RECORDS</Text><Text accessibilityRole="header" style={s.appTitle}>記録</Text></View><Button label="設定を開く" onPress={() => go({ screen: 'U09', intent: '設定を開く' })}>設定</Button></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
      <Copy muted>自分の記録も、一緒にまとめた会話も。</Copy>
      <View style={s.row}>
        <Button label="日付フィルタ 9月13日" selected={dateFilter} onPress={() => setDateFilter(!dateFilter)}>{dateFilter ? '9月13日 ×' : 'すべての日付'}</Button>
        <Button label="確認済み相手フィルタ 葵さん" selected={partnerFilter} onPress={() => setPartnerFilter(!partnerFilter)}>{partnerFilter ? '葵さん ×' : '確認済みの相手'}</Button>
      </View>
      {caseId === 'loading' ? <Loading text="記録を読み込んでいます" /> : caseId === 'failed' ? <ErrorPanel text="記録を読み込めませんでした" retry={retry} /> : <>
        {caseId === 'offline' && <Notice title="接続を確認してください">共有内容は表示していません。自分の端末にある記録の状態は確認できます。</Notice>}
        {filtered.length === 0 ? <View style={s.empty}><Text style={s.emptyMark}>○</Text><Heading>{activeFilter ? '条件に合う記録はありません' : '会話を記録すると、ここから振り返れます'}</Heading>
          {activeFilter ? <Button onPress={() => { setDateFilter(false); setPartnerFilter(false); }}>条件を解除</Button> : <Copy muted>まずは、いつもの会話から。</Copy>}
        </View> : <>
          <Copy small>新しい記録から</Copy>
          {filtered.map((row) => <RecordCard key={row.id} row={row} onPress={() => go(recordDestination(row))} />)}
        </>}
      </>}
    </ScrollView>
    <View style={s.recordAction}><Button primary onPress={() => go({ screen: 'U02', intent: '本人が記録を始める' })}>＋ 記録を始める</Button></View>
    <View style={s.tabs} accessibilityRole="tablist">
      {(['今日', '記録', '保存'] as const).map((name) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: name === '記録' }} onPress={() => name !== '記録' && go({ screen: name === '今日' ? 'U12' : 'U14', intent: `${name}タブを開く` })} style={[s.tab, name === '記録' && { backgroundColor: theme.soft }]}>
        <Text style={[s.tabLabel, { color: name === '記録' ? theme.accent : '#626B73' }]}>{name}</Text>{name === '記録' && <View style={[s.tabDot, { backgroundColor: theme.accent }]} />}
      </Pressable>)}
    </View>
  </>;
}

function RecordCard({ row, onPress }: { row: StudyRecord; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${row.kind === 'personal' ? '自分の記録' : '共有会話'} ${row.title} ${row.state}`} onPress={onPress} style={({ pressed }) => [s.recordCard, pressed && { backgroundColor: '#F6F7F8' }]}>
    <View style={s.rowBetween}><Copy small>{row.kind === 'personal' ? '自分のみ' : row.partner ? `${row.partner}と共有` : '共有会話'}</Copy><Text style={s.arrow}>↗</Text></View>
    <Text style={s.cardTitle}>{row.title}</Text>{row.date && <Copy small>{row.date}</Copy>}
    <Badge tone={row.tone}>{row.state}</Badge>
  </Pressable>;
}

function Conversation({ caseId, go, back, retry, openSource }: { caseId: StudyCase; go: (d: StudyDestination) => void; back: () => void; retry: () => void; openSource: (id: string) => void }) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [uncertainOnly, setUncertainOnly] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const c = studyRepository.conversation(caseId);
  const toLine = (id: string) => { setHighlighted(id); setUncertainOnly(false); requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, (positions.current[id] ?? 0) - 8), animated: false })); };
  return <>
    <View style={s.detailHeader}><Button onPress={back}>‹ 記録</Button><Copy small>会話詳細</Copy><Button label="会話の共有設定を開く" onPress={() => go({ screen: 'U09', conversationId: studyRepository.conversationId, intent: '共有設定を開く' })}>設定</Button></View>
    <ScrollView testID="study-conversation-scroll" ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.body}>
      {c.kind === 'loading' ? <Loading text="会話を読み込んでいます" /> : c.kind === 'failed' ? <ErrorPanel text="会話を読み込めませんでした" retry={retry} /> : c.kind === 'empty' ? <View style={s.empty}><Heading>会話本文はまだありません</Heading><Copy>自分の記録の状態を確認できます。</Copy><Button onPress={() => go({ screen: 'U03', recordingId: studyRepository.recordingId, intent: '自分の記録を確認' })}>自分の記録へ</Button></View> : c.kind === 'blocked' ? <>
        <Notice title={c.heading}>{c.message}</Notice>
        {c.action === 'confirm' && <><Button primary onPress={() => go({ screen: 'U04', conversationId: studyRepository.conversationId, recordingId: studyRepository.recordingId, intent: '自分の入力の範囲を確認し直す' })}>範囲を確認し直す</Button><Button onPress={() => go({ screen: 'U03', recordingId: studyRepository.recordingId, conversationId: studyRepository.conversationId, intent: '持ち寄りをやめる（取消未実行）' })}>持ち寄りをやめる</Button></>}
        {c.action === 'personal' && <Button primary onPress={() => go({ screen: 'U03', recordingId: studyRepository.recordingId, intent: '個人記録へ戻る' })}>自分の記録へ</Button>}
        {c.action === 'retry' && <Button onPress={retry}>{caseId === 'revision-stale' ? '現在の根拠を確認し直す' : '接続を確認し直す'}</Button>}
        {c.action === 'back' && <Button onPress={back}>記録一覧へ戻る</Button>}
      </> : <>
        <View style={s.titleBlock}><Badge tone="positive">葵さんと共有中</Badge><Text accessibilityRole="header" style={s.conversationTitle}>{c.title}</Text><Copy small>9月12日 · 14:10{'\n'}2つの記録からまとめました</Copy></View>
        <View style={s.fold}><Disclosure title="会話の整理" open={summaryOpen} onPress={() => setSummaryOpen(!summaryOpen)} />
          {summaryOpen && <View style={s.foldBody}>
            {c.moduleState === 'loading' ? <Loading text="会話を整理しています" /> : c.moduleState === 'failed' ? <ErrorPanel text="会話を整理できませんでした" retry={retry} /> : <>
              <SummaryItem title="内容" text="展示に行く提案が出ています。" onPress={() => toLine('ui-line-1')} />
              <SummaryItem title="理由" text="確認できた理由はありません" />
              <SummaryItem title="決定" text="確認できた決定はありません" />
              <SummaryItem title="未決定" text="会場はまだ決めていない。" onPress={() => toLine('ui-line-2')} />
            </>}
          </View>}
        </View>
        <View style={s.fold}><Disclosure title="次の行動" open={actionsOpen} onPress={() => setActionsOpen(!actionsOpen)} />
          {actionsOpen && <View style={s.foldBody}>
            {c.moduleState === 'loading' ? <><Loading text="ToDo候補を確認しています" /><Loading text="予定候補を確認しています" /></> : c.moduleState === 'failed' ? <>
              <Notice title="ToDo候補を抽出できませんでした">候補が多いため抽出できませんでした。元の記録を確認してください。</Notice><Button onPress={() => toLine('ui-line-1')}>元の記録を確認</Button><ErrorPanel text="予定候補を確認できませんでした" retry={retry} />
            </> : <><Copy>確認できたToDo候補はありません。</Copy><Button onPress={() => go({ screen: 'U13', conversationId: studyRepository.conversationId, intent: 'ToDoを開く' })}>ToDoを見る</Button><Copy>日時が確定していない予定候補があります。</Copy><Button onPress={() => go({ screen: 'U10', conversationId: studyRepository.conversationId, lineId: 'ui-line-1', intent: '予定候補を確認（未登録）' })}>予定候補を確認</Button></>}
            <Button onPress={() => go({ screen: 'U15', conversationId: studyRepository.conversationId, intent: '確認したいことを開く' })}>確認したいこと</Button>
          </View>}
        </View>
        <View style={s.sectionTitle}><Heading>会話</Heading><Copy small>発言から元の記録へ</Copy></View>
        <View style={s.row}><Button selected={!uncertainOnly} onPress={() => setUncertainOnly(false)}>すべて</Button><Button selected={uncertainOnly} onPress={() => setUncertainOnly(true)}>不明・相違</Button></View>
        <Copy small>話者と記録提供者は別です。時間は目安です。</Copy>
        {(['known', 'unknown'] as const).flatMap((order) => c.utterances.filter((l) => l.order === order && (!uncertainOnly || l.speaker === null || l.conflict || l.order === 'unknown'))).map((line) => <View key={line.id} onLayout={(e) => { positions.current[line.id] = e.nativeEvent.layout.y; }}>
            {line.order === 'unknown' && <View style={s.unorderedHeading}><Heading>位置を確認できない発言</Heading><Copy small>会話内の順序は確定していません。</Copy></View>}
            <Utterance caseId={caseId} line={line} highlighted={highlighted === line.id} openSource={() => openSource(line.id)} save={() => go({ screen: 'U14', conversationId: studyRepository.conversationId, lineId: line.id, evidence: line.refs[0], intent: '発言の保存シート（保存未実行）' })} />
          </View>)}
      </>}
    </ScrollView>
  </>;
}

function Disclosure({ title, open, onPress }: { title: string; open: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={s.disclosure}><Text style={s.disclosureTitle}>{title}</Text><Copy>{open ? '−' : '＋'}</Copy></Pressable>;
}
function SummaryItem({ title, text, onPress }: { title: string; text: string; onPress?: () => void }) {
  return <View style={s.summaryItem}><Copy small>{title}</Copy><Copy>{text}</Copy>{onPress && <Button label={`${title}の根拠へ`} onPress={onPress}>根拠の発言へ ↓</Button>}</View>;
}
function Utterance({ caseId, line, highlighted, openSource, save }: { caseId: StudyCase; line: StudyUtterance; highlighted: boolean; openSource: () => void; save: () => void }) {
  const theme = useContext(StudyTheme);
  return <View style={[s.utterance, highlighted && { borderColor: theme.accent, backgroundColor: theme.soft }]}>
    {highlighted && <Badge>整理の根拠</Badge>}
    <View style={s.rowBetween}><Copy small>{line.speaker ?? '話者不明'}</Copy><Copy small>{line.time ?? '時刻不明'}</Copy></View>
    <Text style={s.quote}>{studyRepository.quote(caseId, line)}</Text>
    {line.conflict && <Badge tone="warning">相違あり · どちらかは未確定</Badge>}
    {line.order === 'unknown' && <Badge tone="warning">順序不明</Badge>}
    <View style={s.row}><Button label={`${studyRepository.quote(caseId, line)}の出典を開く`} onPress={openSource}>元の記録 {line.refs.length}件 ›</Button><Button label="この発言をあとで見る" onPress={save}>あとで見る</Button></View>
  </View>;
}

function SourceSheet({ caseId, lineId, mode, close, go, retry }: { caseId: StudyCase; lineId: string; mode: SourceMode; close: () => void; go: (d: StudyDestination) => void; retry: () => void }) {
  const c = studyRepository.conversation(caseId);
  const line = c.kind === 'readable' ? c.utterances.find((l) => l.id === lineId) : undefined;
  const available = c.kind === 'readable' && line && mode === 'ready';
  const sources = available ? studyRepository.sources(caseId, lineId) : [];
  const [audioNote, setAudioNote] = useState('');
  useEffect(() => setAudioNote(''), [caseId, lineId, mode]);
  return <>
    <View style={s.sourceHeader}><View style={{ flex: 1 }}><Copy small>元の記録を確かめる</Copy><Heading>出典</Heading></View><Button onPress={close}>閉じる</Button></View>
    <ScrollView contentContainerStyle={s.sheetContent}>
      {c.kind !== 'readable' ? <Notice title={c.kind === 'blocked' ? c.heading : '出典を表示できません'}>{c.kind === 'blocked' ? c.message : '元の会話の状態を確認してください。'}</Notice>
        : mode === 'loading' ? <Loading text="出典を読み込んでいます" />
        : mode === 'failed' ? <ErrorPanel text="出典を読み込めませんでした" retry={retry} />
        : mode === 'stale' ? <Notice title="内容が更新されました">出典の版が変わっています。閉じて現在の根拠を確認してください。以前の原文は表示していません。</Notice>
        : mode === 'missing' || !line || sources.length === 0 ? <Notice title="出典を確認できません">原文を取得できていません。出典0件の成功として表示せず、元の会話へ戻れます。</Notice>
        : <>
          <View style={s.selectedQuote}><Copy small>選択した発言</Copy><Text style={s.quote}>{studyRepository.quote(caseId, line)}</Text>{line.conflict && <Badge tone="warning">2つの入力に相違があります</Badge>}</View>
          <Copy small>入力の所有者と、発言した人は別です。原文は音声認識の結果で、正確さを保証するものではありません。</Copy>
          {sources.map((source) => {
            const audio = audioAvailability(source);
            return <View style={s.sourceCard} key={source.id}>
              <View style={s.rowBetween}><Badge>{source.provider === 'self' ? 'A · あなたの入力' : 'B · 葵さんの入力'}</Badge><Copy small>原文 · 版 {source.version}</Copy></View>
              <Text style={s.quote}>{source.text}</Text><Copy small>{sourceTime(source)}</Copy>
              <Button disabled={!audio.available} onPress={() => setAudioNote('原音再生は未接続です。音声の取得・再生は行っていません。')} label={`${source.provider === 'self' ? 'あなた' : '葵さん'}の入力の原音を再生`}>▷ 原音を再生</Button>
              {!audio.available && <Copy>{audio.label}</Copy>}
              <Button primary={source.provider === 'self'} onPress={() => go(sourceDestination(source, studyRepository.conversationId, line.refs.find((r) => r.sourceId === source.id)!))}>{source.provider === 'self' ? '文字を訂正' : '気になる点を伝える'}</Button>
              <Copy small>{source.provider === 'self' ? '元の記録を残して訂正します。自分の入力にも他の人の発言が含まれます。' : '相手の入力は直接変更できません。指摘するだけでは原文は変わりません。'}</Copy>
            </View>;
          })}
          {!!audioNote && <View accessibilityLiveRegion="polite"><Notice title="検討用の操作">{audioNote}</Notice></View>}
          <Copy small>原音は許可範囲内だけ。前後の音声もその範囲を越えません。再生先を変えると前の再生は停止します。</Copy>
        </>}
      <Button onPress={close}>閉じて発言へ戻る</Button>
    </ScrollView>
  </>;
}

function Loading({ text }: { text: string }) {
  return <View accessibilityLiveRegion="polite" style={s.loading}><Badge>読込・処理中</Badge><Copy>{text}</Copy><View style={s.skeleton} /><View style={[s.skeleton, { width: '65%' }]} /></View>;
}
function ErrorPanel({ text, retry }: { text: string; retry: () => void }) {
  return <View style={{ gap: 12 }}><Notice title={text}>時間をおいて、もう一度お試しください。</Notice><Button onPress={retry}>もう一度試す</Button></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEEFEA' },
  masthead: { paddingHorizontal: 30, paddingVertical: 18, flexDirection: 'row', gap: 20, alignItems: 'center', borderBottomWidth: 1, borderColor: '#D9DDD6' },
  eyebrow: { fontSize: 11, lineHeight: 18, fontWeight: '700', letterSpacing: 1.5, color: '#67716A' },
  studyTitle: { fontSize: 22, lineHeight: 32, color: '#24352E', fontWeight: '600' },
  studyStrip: { paddingVertical: 8, paddingHorizontal: 30, backgroundColor: '#F8F8F2' },
  workspace: { flex: 1, flexDirection: 'row', maxWidth: 1320, width: '100%', alignSelf: 'center', gap: 30, padding: 22 },
  controls: { width: 268, flexGrow: 0, flexShrink: 0 },
  controlContent: { gap: 12, paddingBottom: 24 },
  caseButton: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  caseNumber: { fontSize: 11, fontWeight: '600' },
  caseLabel: { flex: 1, fontSize: 14, lineHeight: 21, color: '#35483D' },
  phoneColumn: { flex: 1, maxWidth: 480, alignSelf: 'center', gap: 8 },
  previewCaption: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  phone: { width: '100%', backgroundColor: '#FCFCFA', borderRadius: 26, borderWidth: 1, borderColor: '#D5DCD6', overflow: 'hidden' },
  inspector: { flex: 1, maxWidth: 276 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rule: { height: 1, backgroundColor: '#D8DDD7', marginVertical: 8 },
  appHeader: { padding: 22, paddingBottom: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
  appTitle: { fontSize: 34, lineHeight: 44, color: '#1C2B34', fontWeight: '700' },
  body: { padding: 22, paddingTop: 10, gap: 16, paddingBottom: 32 },
  recordCard: { borderRadius: 18, borderWidth: 1, borderColor: '#E1E5E1', backgroundColor: '#FFF', padding: 18, gap: 10 },
  cardTitle: { fontSize: 20, lineHeight: 30, fontWeight: '600', color: '#23313B' },
  arrow: { fontSize: 21, color: '#536258' },
  recordAction: { padding: 16, paddingBottom: 12, borderTopWidth: 1, borderColor: '#E7E9E3', backgroundColor: '#FCFCFA' },
  tabs: { flexDirection: 'row', padding: 8, gap: 6, borderTopWidth: 1, borderColor: '#E0E5DF', backgroundColor: '#FFFFFF' },
  tab: { flex: 1, minHeight: 54, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12 },
  tabLabel: { fontSize: 15, lineHeight: 24, fontWeight: '600' },
  tabDot: { height: 3, width: 14, borderRadius: 2 },
  empty: { paddingVertical: 32, gap: 18 },
  emptyMark: { fontSize: 48, lineHeight: 56, color: '#A5B2A5' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderColor: '#E4E8E0', gap: 8 },
  titleBlock: { gap: 12, paddingVertical: 12 },
  conversationTitle: { fontSize: 29, lineHeight: 40, color: '#1F2C37', fontWeight: '700' },
  fold: { borderWidth: 1, borderColor: '#DFE5E0', borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF' },
  disclosure: { minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 14 },
  disclosureTitle: { flex: 1, fontSize: 16, lineHeight: 25, color: '#24332C', fontWeight: '600' },
  foldBody: { padding: 16, paddingTop: 0, gap: 16 },
  summaryItem: { gap: 5, paddingTop: 10, borderTopWidth: 1, borderColor: '#EEF0ED' },
  sectionTitle: { gap: 4, marginTop: 10 },
  utterance: { padding: 16, marginBottom: 12, gap: 12, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E5E0' },
  quote: { fontSize: 18, lineHeight: 30, color: '#202F3A' },
  unorderedHeading: { paddingTop: 16, paddingBottom: 14, gap: 8 },
  loading: { gap: 12, paddingVertical: 20 },
  skeleton: { width: '90%', height: 12, backgroundColor: '#E6EAE6', borderRadius: 6 },
  backdrop: { flex: 1, padding: 18, backgroundColor: 'rgba(25,36,31,0.45)', alignItems: 'center', justifyContent: 'center' },
  sheetShell: { width: '100%', maxWidth: 530, backgroundColor: '#FCFCFA', borderRadius: 24, overflow: 'hidden', flexShrink: 1 },
  sheetLab: { padding: 12, gap: 8, backgroundColor: '#EDF0EA', borderBottomWidth: 1, borderColor: '#D3DCD2' },
  sourceHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderColor: '#DFE5DF' },
  sheetContent: { padding: 22, gap: 18 },
  selectedQuote: { padding: 16, backgroundColor: '#EFF2ED', borderRadius: 14, gap: 8 },
  sourceCard: { padding: 18, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE3DC', gap: 12 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 20, color: '#3B5744', backgroundColor: '#F8FAF5', padding: 12 },
  feedback: { padding: 12, backgroundColor: '#FFF6D7', borderRadius: 8 },
  mobileControls: { paddingHorizontal: 12, paddingTop: 8 },
  mobilePalette: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 10, gap: 8, alignItems: 'center' },
});
