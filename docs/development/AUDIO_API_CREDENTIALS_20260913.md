# 音声比較用の認証準備

2026-09-13。対象は[音声モデル比較](AUDIO_MODEL_SELECTION_20260913.md)の全候補。ユーザーから、本人のブラウザで各サービスのAPIキーを取得する依頼を受けた。**CodexのWindows実行エラーを修復し、5社の専用キーを新規発行・ローカル保存済み**。残る認証準備は下表のとおり。キー保存とモデル実行の成功は区別する。

## 最新の取得状態

キー名は5社とも `hackathon-audio-eval-20260913`。キー値・認証コードは本資料に保存しない。全社とも実認証API、対象モデルの実行、音声送信は未検証。

| サービス | 発行・保存 | 設定または残件 |
|---|---|---|
| OpenAI | 成功 | Personal / Default project。RestrictedのModel capabilities Request。有効期限2026-10-13。Files等の管理権限はNone |
| pyannote | 成功 | 慶應メールで本人認証、Keio univチーム。Jobs API（`jobs:all`）。画面上は無料trial残り29日。既存キーは保持 |
| Speechmatics | 成功 | Default project、EU1。専用キー1件。画面上は100 credits。作成画面に期限・権限の選択欄なし |
| Deepgram | 成功 | 本人のproject。デフォルト音声API実行権限、30日。project管理・追加キー作成の権限なし。画面上は$200無料credit |
| AssemblyAI | 成功 | Default project。登録時のDefault API Keyとは別に専用キーを発行・保存。Free plan、画面上は$50 credit。作成画面に期限・権限の選択欄なし |
| Gemini | 未取得 | 初回はサイトがsuspicious requestで拒否。復旧後、同じGemini Projectで1回再試行。発行成功・同名キーの追加を確認できず、保存なし。他projectの既存キーは流用していない |
| ElevenLabs | 未取得 | Googleログイン小窓のアカウント選択で操作がタイムアウト。本人によるログイン完了待ち |
| Hugging Face | 未取得 | ログイン画面を保持。本人ログイン後に読取トークンを発行する。モデル利用条件への同意は別途確認 |
| Google Cloud Chirp 3 | 設定途中 | Gemini ProjectでSpeech API有効化・`hackathon-audio-eval` サービスアカウント作成を確認。Cloud Speech Client / Service Usage Consumerの権限付与完了、JSON鍵、region設定は未確認・未取得 |

## 対象と発行先

同じサービスのモデルごとにキーを増やす必要はない。APIキー7サービス、Google Cloudの認証、Hugging Faceのモデル取得用トークンの計9項目で整理する。取得状況は上表、修復前の履歴は末尾に記録する。

| 対象 | 発行・設定の入口 | 保存変数・準備内容 | 公式手順 |
|---|---|---|---|
| OpenAIの書き起こし2候補 | [API Keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY`。対象プロジェクトの音声処理用キー | [Quickstart](https://developers.openai.com/api/docs/quickstart) |
| ElevenLabs Scribe v2 / speaker library | [Developers / API Keys](https://elevenlabs.io/app/developers/api-keys) | `ELEVENLABS_API_KEY`。Speech to Textと必要な話者機能の権限を画面で確認 | [認証・発行](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key) |
| pyannote Precision-2 / voiceprint | [Dashboard](https://dashboard.pyannote.ai/) | `PYANNOTE_API_KEY`。API Keysから比較用に発行 | [Quickstart](https://docs.pyannote.ai/quickstart) |
| Geminiの書き起こし・音声再確認候補 | [Google AI Studio / API keys](https://aistudio.google.com/apikey) | `GEMINI_API_KEY`。現在のAI Studioはauth keyを新規発行する。プロジェクトと利用可能モデルを確認 | [APIキー](https://ai.google.dev/gemini-api/docs/api-key) |
| Speechmatics | [Portal](https://portal.speechmatics.com/) | `SPEECHMATICS_API_KEY`。対象workspace/projectのAPIキー | [公式入口](https://docs.speechmatics.com/) |
| Deepgram Nova-3 | [Console](https://console.deepgram.com/) | `DEEPGRAM_API_KEY`。対象projectのSettings → API Keys。音声処理に必要な権限を選ぶ | [キー作成](https://developers.deepgram.com/docs/create-additional-api-keys) |
| AssemblyAIの書き起こし候補 | [Dashboard](https://www.assemblyai.com/dashboard) | `ASSEMBLYAI_API_KEY`。対象projectのAPI Keys。利用モデル名・機能は実行準備時に再確認 | [複数キーの管理](https://www.assemblyai.com/blog/announcing-dashboard-revamp-multiple-api-keys) |
| Google Cloud Chirp 3 | [Google Cloud Console](https://console.cloud.google.com/) | `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION`とADC。Geminiのキーを転用する前提にはしない。Speech API、権限、課金先を確認 | [Cloud STT認証](https://docs.cloud.google.com/speech-to-text/docs/v1/authentication) |
| pyannote Community-1の取得 | [Hugging Face Tokens](https://huggingface.co/settings/tokens) | `HF_TOKEN`。モデルの利用条件を確認し、必要なモデルを読めるトークンを発行。ローカル推論用で、Precision-2のキーとは別 | [モデルのSetup](https://huggingface.co/pyannote/speaker-diarization-community-1) |

Qwen3-ASR、VibeVoice、ReazonSpeech、Whisper、NVIDIAのローカル候補、ReDimNet2、WeSpeaker、ECAPA、CAM++、WeSepは、今回の比較案ではローカル実行を想定するため、個別の商用推論APIキー取得対象にしない。重みの取得条件・ライセンス・依存先の認証は導入時に確認する。モデルごとの別サービス登録はしていない。

## 保存と再開

- ルートの `.env.audio-models.local` に5社のキーを保存した。既存 `.gitignore` の `.env.*` で除外される。読み込むランナーは未接続。クライアントの公開環境変数には使用しない。
- キー名は `hackathon-audio-eval-20260913`。既存キーの削除・ローテーションは今回行っていない。キー値を文書・チャット・Excel・クライアントバンドルに含めない。
- 再開時に本人のアカウントと対象project/workspaceを画面で確認し、発行したキーを保存する。ユーザー入力が必要なログイン・2段階認証等は、その画面まで到達した時点で引き継ぐ。
- 発行、ローカル保存、認証確認、対象モデルの利用可否、音声実行はそれぞれ別の状態として記録する。今回の依頼によりキー取得は依頼済み。実音声の送信・利用条件は既存の検証方針と照合する。

## 初回の結果

- 成功：候補全体の認証方式と公式発行先を整理。空の保存欄を作成。
- 実施不能：ブラウザ操作用 `cua.getState()` が `failed to write kernel assets: The system cannot find the path specified. (os error 3)` で初期化失敗。セッションreset後も同一。別のComputer Use用Node環境も同じ初期化エラー。ユーザーのブラウザ画面に到達していない。
- 未実行：アカウント作成、ログイン、キー取得/発行、認証API確認、課金、音声送信、モデル実行。
- 再開条件：操作ツールの初期化が成功し、ブラウザのタブ一覧を取得できること。Codexの再起動は復旧を試す候補であり、解決を確認したものではない。


## 再起動後の再試行

- ユーザーの再起動報告後、操作セッションresetでブラウザ接続が成功。内蔵ブラウザは未ログインのため、Chromeの保存済みログインを確認した。
- ユーザーは今回の依頼の継続中に、7サービスの新規APIキーとHugging Faceの読取トークンの発行・Git除外ファイルへのローカル保存を明示許可した。課金契約・既存キーの削除は含めていない。
- OpenAI：保存済み本人アカウントでログイン成功。Personal / Default projectで新規キー作成フォームまで到達。名前入力・Restricted選択の呼出しは自動レビューがタイムアウト。キーの新規発行成功は未確認。
- Gemini：Google AI Studioの既存ログイン確認。既定選択のGemini Projectで `hackathon-audio-eval-20260913` の作成を1回実行したが、サイトが `Failed to generate API key, The request is suspicious. Please try again.` と拒否。新規キーを取得していない。別経路での発行回避・既存キーの流用は行っていない。
- ElevenLabs：ログイン画面からGoogleの本人アカウント選択まで到達。ログイン完了は未確認。pyannoteは内蔵ブラウザでログイン/規約同意画面まで確認。Speechmatics、Deepgram、AssemblyAI、Hugging Face、Cloud STTの本人認証画面には未到達。
- 保存先を値を出力せず確認し、保存済み認証変数0件だった。新規キー値を取得・保存した操作はない。
- 再停止：自動レビューのタイムアウト後に `Debugger unattached`、続くユーザー依頼の再試行で `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`。セッションreset後も同一。指定された `.codex/.sandbox/setup_error.json` の読み取りでコードとメッセージを確認した。通常のshell起動と文書編集用helperも同じアクセス権設定で失敗する。
- 診断：広範なログ本文取得は自動承認レビューが拒否したため実行せず、ファイル情報と当該タスク・直近1時間のERROR/WARNの件数だけを確認する限定診断へ変更した。該当エラー記録は見つからなかった。Codex設定・ACL・セキュリティ保護の変更、ランタイムの自作修復は行っていない。
- 残件：Windows実行環境の初期化復旧後、実際のキー一覧から重複作成の有無を確認して再開する。Geminiのサイト側拒否は別の未解決事項。ログイン済みとAPI実行可能を同一視しない。

## Codex修復と取得再開の結果

- 対象版 `c39307a`、既存の調査資料・比較表・WORKFLOW差分を保持。ユーザーからCodex自体の修復を依頼され、Windows sandbox初期化を限定診断した。
- 原因：`C:/Users/横山豪/.codex/.sandbox/deny_read_acl_state.json` が22バイトすべてNULで、不正JSONだった。sandboxのsetupログにも `parse deny-read ACL state` / `expected value at line 1 column 1` が記録されていた。
- 修復：上記の1ファイルだけを同フォルダの `deny_read_acl_state.corrupt-20260913-183232.json` に退避。退避前後のSHA-256一致を確認（`6A4875DDACEAA91FB3369F0F6D962F77442DAF1B1D97733457D12BCABDF79441`）。通常のshell起動でCodexが `{"principals":{}}` を自動再生成した。ACL、Codex設定、Defender等の保護設定は変更していない。
- 自己確認成功：通常権限のshellから `CODEX_SANDBOX_EXEC_OK`、エラー状態ファイルの消失、正常JSON、ブラウザのタブ取得と実操作を確認。その後のキー保存時にも通常shell成功。途中のブラウザMCP応答停止2回はセッションresetで復帰。ElevenLabsのGoogle小窓のクリックだけは未解決で、本人ログインを依頼した。
- 追加の人間判断：pyannote/Deepgramの規約同意、AssemblyAIの規約同意、pyannoteのGitHub連携を、この依頼中に明示確認した。GitHub連携は自動承認レビューに拒否された後、ユーザーの追加承認で続行したが、サービス側の仕事用メール制限でログインできなかった。ユーザーが慶應メールの利用を指定し、本人提供の認証コードでログイン成功。コードは保存していない。
- 外部実行成功：OpenAI、pyannote、Speechmatics、Deepgram、AssemblyAIの専用キー各1件の発行と、キー値を出力しないローカル保存・保存値照合。AssemblyAI登録時に自動発行されたDefault API Keyは未使用で保持。新しい有料契約、credit購入、既存キー削除、音声送信は行っていない。
- Gemini再試行：復旧後、同じGemini Projectで専用名を入力して作成を1回実行。作成パネルは閉じたが、一覧再読込後も専用名なし（ヘッダーを含む15行）。今回の失敗理由は画面で確定できず、初回のsuspicious拒否と区別して未確認と記録する。異なるprojectや非UI経路による回避は行っていない。
- 未実行：保存済みキーによる実認証API、音声・声紋モデルの試験、Hugging Faceのモデル取得、Cloud STTのADC設定、製品への接続、独立レビュー、commit/push。次は本人ログインの完了確認とGeminiの発行状況の確認。キー発行許可を課金契約や音声送信許可に広げない。
- 文書・保存の自己確認成功：`node scripts/check-docs.mjs`（49ファイル399ローカル参照）、`git diff --check`、`.env.audio-models.local` のGit除外、保存済み5変数、変更した公開文書3本に実キー値が含まれないことを確認。

## 追加の認証準備とGit共有（2026-09-14）

- 追加承認：ユーザーが既存Gemini ProjectでのCloud Speech API有効化・規約同意、音声用サービスアカウントへのCloud Speech Client / Service Usage Consumer付与、JSON鍵のGit除外保存を明示承認。ElevenLabsへ本人の指定Googleアカウントで名前・画像・メールを共有するログイン連携も承認した。今回も音声実行・課金契約・購入は対象にしていない。
- Cloudで確認できた結果：Speech APIの管理画面にDisable APIが表示され、有効化成功。`hackathon-audio-eval@gen-lang-client-0236493235.iam.gserviceaccount.com` の作成成功通知と権限選択画面を確認。ロールを検索する途中でブラウザ操作の自動レビュー待ち・実行タイムアウトが起き、権限付与完了とJSON鍵発行には至っていない。CLIと標準保存先のユーザーADCは見つからなかった。今後のJSON鍵はADC用の資格情報ファイルとして扱う。
- ElevenLabsはGoogle認証の小窓でクリックがタイムアウト。本人アカウントの連携承認後、同じ認証ページを通常タブで開きアカウント選択操作は通ったが、次の画面確認がタイムアウトしてセッションがresetされた。ログイン成功・キー取得とは扱わない。HFとGeminiも新たな取得なし。
- Git共有の依頼を受領。privateの `jokojama-gou/opeai-hackathon` を送信先として確認。取得済み5社の環境ファイル全体を `credentials/audio-models.env.enc.json` に暗号化した。復号鍵は `.env.audio-models.encryption-key.local` に保存し、Git除外を確認。平文キー・復号鍵はpush対象外。別PCでの復号にはGitとは別の経路で鍵を渡す必要がある。
- [共有・復号手順](../../credentials/README.md)とNode.jsスクリプトを追加。AES-256-GCMの認証付き暗号化を使用。人工データで復号一致・IVの更新・異なる鍵/改ざん拒否・既存ファイル保護を確認し、実データでも暗号化後の原本一致を確認。キー値は検証ログに出力していない。
