# 録音後の雑音除去・音声保存・後処理ASR（2026-09-15）

## 依頼・対象版・境界

- 人間の判断：ElevenLabs Voice Isolatorを使用する。すぐ表示する文字起こしは維持し、録音後の後処理には雑音除去済み音声を使い、音声データとして保存してよい。追加でSupabaseトークンによる必要な操作を許可。今回は端末保存で成立するためSupabase操作なし。
- 開始HEAD：`946b76d6243239fd8978e8872770ed619defdb02`。開始時にuseLiveWorkspace/LiveApp、WORKFLOWと先行調査記録の未コミット変更あり。途中でリアルタイム方式判断、App/AudioDemoScreen/asr-settings等の並行変更が追加された。これらを保持し、本作業の製品変更はDirectAsrScreenとその音声adapter・保存処理へ限定。
- 関連：K02/K03/K07の端末録音・ASR部分、M01/U02、AC02/13/14/19。独立レビューなし。主担当による実装・自己確認。共有API契約/fixture、2入力統合、録音中のリアルタイム接続は本実装の完了判定に含まない。
- 編集先：`apps/client/src/data/audio-isolation.ts`、`direct-asr.ts`、対応テスト、`platform/audio/direct-device.ts` / `.web.ts`、`storage.ts`、`screens/DirectAsrScreen.tsx`。人工API確認スクリプト、テスト用fake-indexeddbの開発依存、MVP_SPEC/DIRECT_ASR/APP_DEVELOPMENTと本履歴・WORKFLOWを更新。

## 実装

- 通常録音を端末へ保存後、画面が有効ならElevenLabsへ雑音除去を1回送信。即時側の原音ASRはこの完了を待たず実行可能。登録用の声は対象外。背景移行/画面離脱で待機を中止し、復帰だけでは再送しない。
- 受信バイトをMP3/WAV等の実形式として識別し、元録音ID・原音checksum・出力checksum・形式と成否を保存する。React Nativeの組込Blobにはバイナリ生成/arrayBufferの制約があるため、受信はArrayBuffer、native保存はExpo File、Web保存はBlobとする。
- ネイティブはアプリのrecordings配下へ派生音声ファイル、WebはIndexedDBの同録音へdenoisedBlobを保存。原音を残し、除去後の保存成功を確認してから後処理ASRへ渡す。音声は元録音終了から7日、文字は30日。処理で期限を延長しない。
- `direct-asr-v1`へ省略可能なaudioVariantと別denoisedRunスロットを追加。既存runは原音として読み、原音/除去後の結果・比較・試行履歴を分離する。候補IDも入力種別を区別。保存済み除去音声は再利用し、APIへの再送を避ける。
- 失敗時は原音を保持して成否/結果不明を表示。手動再試行あり。保存失敗と通信失敗を分け、削除・期限・所有者/原音checksumの変更・中止に競合した遅着音声を保存しない。再生中表示と停止、原音/除去後の結果切替を追加。

## 確認と証拠

| 確認 | 結果 |
|---|---|
| `npm run verify -- ui contracts tooling docs` | 8/8 PASS。型、UI 11件、契約/データ67件（本変更の12件を含む）、検証入口7件・tooling18件、文書/Skill |
| 雑音除去・保存の人工テスト | API形式、未設定/401/空/非音声、原音保持、2種の結果保存・再読込、再利用、二重送信拒否、取消/timeout/期限/削除競合、声の登録除外、保存失敗、RN Blob制約を確認 |
| 既存キーによる実API | 成功。固定checksumのWindows合成日本語7.522秒のみ使用。利用者のマイク・実録音なし。雑音除去とScribeを各1回の確認を2回実施。最終結果は2026-09-15 03:11:18 UTC、MP3 303,064 bytes、保存バイト一致、文字32字/32区間。認識精度の指標ではない |
| Android/iOS/Web export | Expo/Hermesのローカルexport成功。PWA静的ファイル生成も成功。APK/IPA配布の証拠ではない |
| ブラウザ | 専用localhostの人工fixtureを使い、再読込→録音選択→原音結果→後処理結果の切替、保存音声の「再生中」→停止を確認。console error 0件。画面操作とスクリーンショットは本タスクのツール出力 |

機械証拠はGit除外の `.npm-cache/audio-isolation/verify.log`、`build.log`、`live-result.json` と人工音声ファイル。実API確認は `node --import tsx scripts/check-audio-isolation-live.ts --artificial-only`。入力checksumは先行人工検証と照合して固定し、任意の実録音へ差し替えると拒否する。キー/音声本文はスクリプト出力に含めない。

## 失敗・残件・適用範囲

- npmの公開metadata読取はsandboxの通信拒否EACCESで失敗し、通常実行で取得・テスト依存導入に成功。永続セキュリティ設定は変更していない。
- nativeのBlob制約はインストール済みSDKソースで確認し、バイト列のまま保存する形へ修正後、同制約を模したテストと実APIを再確認。実iPhone/Androidでの録音・ファイル保存・再生は未確認。
- ブラウザ検証の音声/結果は人工fixture。マイク録音・各社CORS・実会話での雑音除去品質・ASR精度向上・長時間/通信断/容量不足の実機挙動は未検証。新たな品質/速度保証はしない。
- 対象画面は「端末直接ASR比較」内。並行追加された別の音声デモ画面と旧共有APIの録音処理は本adapterへ接続していない。録音中のリアルタイム字幕は別作業の採用判断を維持する。
- 本依頼によるcommit/push・公開・EASクラウドビルドは未実行。各K全体やMVP完成とはしない。
