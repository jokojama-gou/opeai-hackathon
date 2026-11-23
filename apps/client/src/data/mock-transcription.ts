// Handwritten fictional conversations. No audio, ASR, or network requests.
export const mockSamples = [
  {
    id: "meeting", title: "ハッカソンの打ち合わせ", duration: "00:48", category: "アイデアを形にする",
    lines: [
      { time: "00:00", speaker: "話者1", text: "発表では、会話を録音してから文字起こしを見るところまで見せたいね。" },
      { time: "00:09", speaker: "話者2", text: "うん。まずはブラウザで動くモックを用意しよう。ログインなしで試せるといいな。" },
      { time: "00:20", speaker: "話者1", text: "私はデモ用の会話を準備するね。要約から元の発言に戻れるようにしよう。" },
      { time: "00:32", speaker: "話者2", text: "じゃあ私は画面を確認する。明日の15時に、もう一度動かしてみよう。" },
    ],
    summary: [
      { title: "ブラウザで体験できるデモに", body: "ログインなしで録音から文字起こしまで試せるモックを用意する。", source: 1 },
      { title: "振り返りにも、手がかりを", body: "要約から元の発言へ戻れるようにする。", source: 2 },
      { title: "次回の確認", body: "「明日の15時」にもう一度動作を確認する予定。日付は未確定。", source: 3 },
    ],
    todos: [
      { title: "デモ用の会話を準備する", detail: "話者1が担当すると発言", source: 2 },
      { title: "ブラウザで画面を確認する", detail: "話者2が担当すると発言", source: 3 },
    ],
  },
  {
    id: "weekend", title: "週末の小さな計画", duration: "00:35", category: "日々の会話を残す",
    lines: [
      { time: "00:00", speaker: "話者1", text: "週末、駅前の新しいカフェに行かない？" },
      { time: "00:07", speaker: "話者2", text: "いいね。土曜の午後はどうかな。まだ予定を確認していないけど。" },
      { time: "00:18", speaker: "話者1", text: "じゃあ私がお店の営業時間を調べるね。時間はあとで決めよう。" },
      { time: "00:27", speaker: "話者2", text: "ありがとう。私は土曜の予定を確認して連絡するね。" },
    ],
    summary: [
      { title: "新しいカフェへ", body: "駅前のカフェへ行く話。土曜の午後は候補で、日時はまだ決まっていない。", source: 1 },
      { title: "調べてから決める", body: "営業時間とそれぞれの予定を確認してから、時間を決める。", source: 2 },
    ],
    todos: [
      { title: "カフェの営業時間を調べる", detail: "話者1が担当すると発言", source: 2 },
      { title: "土曜の予定を確認して連絡する", detail: "話者2が担当すると発言", source: 3 },
    ],
  },
] as const;
