# 端末直接ASRと複数結果比較の実装

- 日付：2026-09-15。段階：実装・自己検証。担当：主担当AI。基準HEAD `2d36ff616dc28471f40c00a04945659e8941b7bd` と開始時の未コミット変更。既存のPWA、APK、Expo設定、依存、文書の変更を保持。
- 依頼と採用：各スマホから直接書き起こし、当日用キー配布、手元のキーがある全プロバイダーと別LLM比較。続いて本人提供のElevenLabs/Deepgram/Speechmatics/AssemblyAIを追加。前回の構成判断だけの依頼から、明示的な「すすめて」により実装へ移行した。
- 関連：K02/K03/K07、M01とU02の録音、MVP_SPEC §9.0の直接ASR。AC15の端末基盤の一部。共有・M15・各K全体の受入完了ではない。
- 成果条件：利用可能な各社adapter、録音と独立結果保存、失敗分離、元原文を保持した比較、設定と再現手順、人工検証。契約は `direct-asr-v1`。既存共有APIの契約/fixtureは変更していない。

## 変更先

- `apps/client/src/data/direct-asr.ts`、`asr-providers.ts`、`asr-comparison.ts`、`asr-settings.ts`：7社8経路、並列処理、ジョブID保存、再試行、比較の引用ID検証。
- `apps/client/src/platform/audio/direct-device.ts` / `.web.ts`：既存ネイティブ録音とWeb MediaRecorder、端末内ファイル/IndexedDB保存、期限と保存再試行。
- `apps/client/src/screens/DirectAsrScreen.tsx` と `App.tsx`：初期画面、録音・設定・候補・比較・削除・旧画面への遷移。
- `scripts/configure-direct-asr.mjs` とテスト、`direct-asr.test.ts`、`scripts/check-direct-asr-live.ts`、`scripts/verify.mjs`。追加キー原本 `.env.audio-models.local` とクライアント `.env.local` はGit除外。キー値は記録・ログへ出力しない。
- MVP_SPEC、ロードマップ、APP_DEVELOPMENT、WORKFLOWと [運用手順](../development/DIRECT_ASR.md)。

## 人工音声による実APIの結果

2026-09-15 01:47:27 UTC。Windows音声合成で生成した架空の日本語7.522秒を、Nodeから製品と同じadapterへ渡した。利用者のマイク・実録音は使っていない。入力checksumは `6c8a561757c5b90c82191af25fc6e52f71cebbba9adaf71a0423e8876fb783f1`。

| 経路 | 結果 | 所要ms | 文字数 | 区間数 |
|---|---|---:|---:|---:|
| OpenAI通常 | succeeded | 1271 | 32 | 1 |
| OpenAI話者付き | succeeded | 3821 | 35 | 3 |
| ElevenLabs | succeeded | 1396 | 32 | 32 |
| Gemini | succeeded | 6908 | 32 | 1 |
| Deepgram | succeeded | 2963 | 32 | 25 |
| AssemblyAI | succeeded | 5905 | 32 | 1 |
| Speechmatics | succeeded | 4352 | 32 | 20 |
| pyannote | succeeded | 7287 | 0 | 3 |

別LLM比較も `succeeded`、終了コード0。文字数・区間数は正解率ではない。pyannoteは話者のみ。単一の短い合成音声であり速度・精度の優位性を示さない。機械記録はGit除外の `.npm-cache/direct-asr/live-speech-result.json`、人工入力と保存runも同フォルダにある。

初回の無音相当の人工トーンではGeminiの出力省略、発話入力ではInteractionsの `steps/model_output/content` を旧parserが認識しない問題を検出し、公式形式へ修正。比較は初回timeoutと引用不一致を検出し、reasoning設定と原文抜粋IDの選択方式へ修正した。同じ合成音声で全経路・比較を再確認して成功。外部通信とHermesの起動は制限環境で拒否され、許可された通常実行で成功した。

## 検証と残件

- 成功：型・UI・契約・検証ツール・文書の8/8確認。人工fixtureで各社HTTP形式、成功保持、重複実行拒否、取消/timeout、期限、永続化失敗、比較の出典検証、未完了のみ再試行を確認。
- 成功：Android/iOS/Webのexport。Android/iOSのHermes各約2.1MB、Web約829KB。APK/IPAの生成ではない。
- 成功：最終変更後も `npm run verify -- ui contracts tooling docs` は8/8、`npm run verify:security` は2/2（人工保管テスト12件）。Web/PWAビルド成功、差分空白検査成功。
- 成功：ブラウザで初期画面、設定開閉、人工デモへ遷移して戻る、既存API画面へ遷移して戻るを確認。最新Webバンドル名をDOMから照合し、最後のタブでconsole error 0件。マイク操作や録音後の結果表示はこのUI確認に含まない。
- 修正と再確認：キー追加後のMetroキャッシュに旧環境値が残ったため、`--clear` で全プラットフォームを再生成。Web/Android/iOSすべてに7社分の値が含まれることを、値を出力せずバイト照合した。証拠は `.npm-cache/direct-asr/bundle-verification.json`。最終Web `index-a6c6712181fced16fa07883d13bb622b.js`、PWA `b11cb9d043a42667`。端末への実配布の証拠ではない。
- 未確認：実スマホでの録音・形式・通信・各社CORS・保存・背景復帰、実音声の品質、5分入力、多話者、遠隔データの保持/削除。必要な実機確認は未完。
- 対象外：共有保存/Source変換/2端末統合/M15、ストア提出、公開、クラウドビルド、commit/push。今回の依頼でこれらの未決定を確定扱いしない。独立レビューは依頼なしのため未実施。
