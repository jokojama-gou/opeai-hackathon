# Voicemarkの2分PV

2026-09-15 / pv-r001 / 主担当による制作と自己確認。

## 依頼・対象版・範囲

- ユーザー依頼：アプリのシチュエーションを一つ想定し、途中でメタ的に止まってアプリ紹介が入る動画。追加指定は2分、名称Voicemark。横長のコンセプトPVを制作。
- 対象HEAD `5cccd9d`。最初の読取では追跡差分なし、再開時には他作業の `apps/client/src/data/asr-settings.ts` が変更済み。制作中に `App.tsx`、`useLiveWorkspace.ts`、`LiveApp.tsx`、`SetlogScreens.tsx` も他作業で変更された。すべて保持し、この依頼では編集していない。
- K：アプリ実装Kの担当追加はなし。発表用の説明素材としてK02/K05/K09/K10に関連するM01〜M06/M15、U02/U06/U17を参照。製品AC/C/Aの合格を主張する作業ではない。
- 変更先：`hackathon-pitch/output/voicemark-pv-v1/`、発表作業メモ、本履歴、WORKFLOWの最新結果。契約・製品fixture変更なし。動画の人工台本と画面は `story.json` pv-r001。

## 成果

- [動画と編集素材](../../hackathon-pitch/output/voicemark-pv-v1/README.md)。友達3人の鎌倉旅行相談→30秒で停止→人物がカメラに語りかける→記録/許可範囲の2入力統合/整理/AI/出典→98秒で会話再開→Voicemark。
- MP4はH.264/AAC、1920×1080、24fps、2880フレーム、120.000秒、19,496,513 bytes。1280×720合成フレームから1080pへ拡大。
- 内蔵画像生成の4枚にカメラ移動、コード生成のUIアニメーション、Windows日本語合成音声23区間、自作合成BGM/効果音。画像プロンプト・音声生成スクリプト・台本・動画レンダラーを同梱。
- 映像内にCONCEPT FILMと画面のコンセプト表示を入れた。人物が連続動作する生成動画や、実アプリの操作録画とは区別する。

## 確認・証拠

- 成功：`python render.py --preview`。16場面を出力し、場面一覧とエンコード後のAI画面を目視確認。日本語の切れ・重なり、場面順、停止/再開を確認。
- 成功：`python render.py --render`。120秒を書き出し。
- 成功：`python render.py --check`。[検査結果](../../hackathon-pitch/output/voicemark-pv-v1/checks/verification.json)。解像度/fps/尺、15地点のフレーム読取、FFmpeg全編デコード（終了0、エラー出力なし）。
- 成功：[音声検査](../../hackathon-pitch/output/voicemark-pv-v1/checks/audio.json)。全23区間が割当時間内。44.1kHzステレオ、120秒、正規化ピーク約0.426、クリップなし。
- 環境要因と復旧：制限内のWindows音声出力は失敗/停止したため、同じローカル合成を承認された通常権限で実行し成功。外部への音声送信や実音声の処理はなし。
- 成功：`npm run verify:docs` は文書/Skillの2対象ともPASS（118文書、1217ローカル参照、6 Skills）。`git diff --check` も今回の変更範囲で終了0。
- 未実行：独立レビュー、実スマホ/会場の再生・音声試聴、製品実API/実録音の動作。対象外：アプリ改名実装、コミット/push、公開/配布/提出。

## 残る範囲

この版は生成静止画を使ったモーションPV。人物の連続動作とリップシンクを伴う映像への置換は未実施。未接続のRunwayを一度提案したが、接続確認がなかったため使用せず、ローカルで完成できる2分のMP4を作った。アプリ実装状況や性能をこのPVで検証済みにしない。
