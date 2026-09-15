# 端末から全プロバイダーへ書き起こし

2026-09-15。採用仕様は [MVP_SPEC §9.0](../product/MVP_SPEC.md#contracts)。各端末の録音を設定済み全社へ送り、原文を残して別LLMで比較する。Windowsバックエンドの起動は不要。現在は本人の端末内で完結する画面で、2端末の共有・統合やM15のAI会話には未接続。

モデルを1つに絞る推奨案と、実際に検証したScribe v2の説明は[仲間向けモデル資料](ASR_MODEL.md)を参照してください。以下は現在の複数社版の操作であり、単独運用への切替はまだ行っていません。

## 起動と操作

録音中のリアルタイム字幕はElevenLabs `scribe_v2_realtime` を採用済み。接続は未実装で、下記は現在動く録音後の処理。全社比較は維持する。[決定・残件](../history/ELEVENLABS_REALTIME_DECISION_20260915.md)。

1. リポジトリルートで `node scripts/configure-direct-asr.mjs` を実行する。既存OpenAI/pyannote設定、追加4社を保存した `.env.audio-models.local`、環境変数から、クライアントの `.env.local` へASR設定をまとめる。値は出力しない。既存のAPI URLは保持する。
2. キー変更後は `npm run build:bundles --workspace @hackathon/client -- --clear` でMetroキャッシュを再生成する。Webは続いて `npm run build:web`、開発は通常のExpo起動手順でキャッシュをクリアして再起動する。スマホのWeb録音にはHTTPSとマイク権限が必要。ネイティブ録音は [development buildの手順](DEVICE_INSTALLATION.md)を使う。
3. 最初の「録音を聞き比べる」で録音し、停止後の保存を待つ。1録音は最長5分、送信上限25MB。初回はファイル全体を送る。WebのMediaRecorderが出す小片は保存時に1ファイルへまとめ、別々のASR入力にはしない。
4. 原音保存後、ElevenLabs Voice Isolatorで雑音を除去し、返った音声を端末へ保存する。処理中も「すぐ書き起こす（原音）」から原音の書き起こしを実行できる。「後処理（雑音除去済み）」では保存済みの除去音声で全社の書き起こしを開始する。両者の結果は別に残る。結果・時刻・話者は会社ごとに表示する。未設定の会社は送らない。「設定」でキーを入力することもできるが、画面で変更したキーは再起動後に保存されない。
5. 2件以上の成功した書き起こしがあると別LLMで比較できる。モデル初期値は `gpt-5-mini`。違い・原文引用・不確実性を表示し、元原文は置き換えない。

当日用ASRキーを配布アプリへ含めることはユーザー了承済み。管理用トークンは設定生成の対象にしない。追加キーの原本とクライアント設定はGit除外のため、別PCでは設定を渡すか画面から入力する。EASのソース除外設定によりローカル `.env.local` が自動配布されるとは限らないため、別PC/クラウドビルドでは同じ公開ASR変数をビルド環境へ設定する。今回、公開・クラウドへのキー登録は行っていない。

## 初期モデルと出力

| 会社・経路 | モデル | 保存・表示するもの |
|---|---|---|
| OpenAI通常 | `gpt-transcribe` | 原文、時刻不明はnull |
| OpenAI話者付き | `gpt-4o-transcribe-diarize` | 原文、区間、話者 |
| ElevenLabs | `scribe_v2` | 原文、単語、話者 |
| Google Gemini | `gemini-3.5-transcribe` | 原文、未提供時刻はnull |
| Deepgram | `nova-3` | 原文、単語、話者 |
| AssemblyAI | `universal-2` | 原文、発話、話者 |
| Speechmatics | `enhanced` | 原文、単語、話者 |
| pyannote | `precision-2` | 話者区間のみ。書き起こし比較の入力から除外 |

6社の書き起こし7経路と、1社の話者処理。日本語を指定できるAPIでは日本語を指定する。「全モデル」を無制限に列挙したものではなく、手元にキーがある各社の上記経路を実装している。得意・苦手や精度の順位は未測定。

## 保存と失敗時

- 雑音除去は同じElevenLabsキーを使用する。権限/残高不足なら原音を残して失敗を表示する。「雑音除去して保存（再試行）」で再送でき、保存成功後は再利用する。再生は除去済み音声と原音を選べる。登録用の声はこの処理へ送らない。
- Webは同じIndexedDBレコードに `denoisedBlob` と `denoisedRun` を追加し、原音/既存 `run` を保持する。ネイティブは `recordings/<id>-denoised.<実形式>` と既存 `direct-asr` のmetadataへ保存。音声は両方とも元録音終了から7日。削除時は両方の音声と結果を削除する。
- 共通形式は `direct-asr-v1`。録音ID/checksum、各候補ID、モデル、元応答、時刻、話者、ジョブID、所要時間を記録する。別会社の時刻や話者を借りて補完しない。話者ラベルは端末所有者の身元ではない。
- WebはIndexedDB、ネイティブはアプリ内ファイルへ保存する。原音7日・文字30日の期限を適用し、一覧読込時に期限切れデータを掃除する。アプリ未起動中の定刻削除を保証する仕組みではない。
- 一社の失敗で他社の結果を捨てない。中断・タイムアウトは結果不明を区別し、自動再送しない。手動再試行は未完了候補のみ、成功結果と過去の試行を保持する。遠隔ジョブが完了している可能性があり、再試行で再課金される場合がある。
- 背景移行で録音・処理を停止する。通信中止はプロバイダー上のジョブ取消を保証しない。端末削除操作は端末内の音声と結果を削除する操作で、各社の保持データを一括削除するものではない。
- 比較へ渡すのは成功原文と候補情報のみ。比較モデルが選んだ引用IDをアプリ側で原文へ戻し、存在しない候補や引用を拒否する。モデルの判断自体の正確さは保証しない。

## 検証

雑音除去の人工実API確認は `node --import tsx scripts/check-audio-isolation-live.ts --artificial-only`。先行記録のchecksumに一致する人工合成音声だけを受け付け、ElevenLabsの雑音除去とScribeへ各1回送る。利用枠を消費する。音声本文やキーをログへ出さず、保存バイト一致・結果の有無を記録する。実行結果は `.npm-cache/audio-isolation/live-result.json`。認識精度や実スマホの証明とは分ける。

ローカル確認は `npm run verify -- ui contracts tooling docs`、設定保管は `npm run verify:security`、全プラットフォームのexportは `npm run build:bundles`。APK/IPA完成・実機成功とは区別する。

実API用の `node --import tsx scripts/check-direct-asr-live.ts --artificial-only --speech-fixture` は全社へ人工音声を送り課金対象になる。固定の `.npm-cache/direct-asr/artificial-speech.wav` が必要。利用者の録音へ差し替えるための汎用コマンドではない。2026-09-15の人工日本語7.522秒では8経路と比較LLMが成功。[証拠と未確認範囲](../history/DIRECT_ASR_IMPLEMENTATION_20260915.md)。

未確認：iPhone/Androidの実録音・形式・バックグラウンド挙動、スマホブラウザの各社CORS、長い録音、精度・多人数話者、回線断や端末容量不足の実機挙動。現時点の通信成功はPC上のNodeで共通adapterを呼んだ証拠。

## API参照

- [OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)、[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [ElevenLabs convert](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
- [ElevenLabs Voice Isolator](https://elevenlabs.io/docs/api-reference/audio-isolation/convert)
- [Gemini transcription](https://ai.google.dev/gemini-api/docs/transcribe)、[Files](https://ai.google.dev/gemini-api/docs/files)、[Interactions](https://ai.google.dev/api/interactions-api)
- [Deepgram prerecorded](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)
- [AssemblyAI upload](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/files/upload)、[transcripts](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/submit)
- [Speechmatics batch](https://docs.speechmatics.com/speech-to-text/batch/quickstart)
- [pyannote upload](https://docs.pyannote.ai/api-reference/upload-media)、[diarize](https://docs.pyannote.ai/api-reference/diarize)
