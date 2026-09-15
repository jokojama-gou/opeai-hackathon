# 現在地と引き継ぎ

2026-09-15。方針は[PRODUCT_CORE](../product/PRODUCT_CORE.md)、仕様は[MVP_SPEC](../product/MVP_SPEC.md)、担当・K定義は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md#tasks)。

## 現在の状態

### Web & Expo統合フル機能音声デモ（2026-09-15）

- 本人依頼により、WebデモおよびExpo (`apps/client/src/screens/AudioDemoScreen.tsx`) へ以下の4機能を完全接続・統合完了：
  1. 📝 **まとめて文字起こし**: OpenAI Whisper (`whisper-1`) API
  2. 👥 **話者分離**: ElevenLabs Scribe STT (`scribe_v1`, `diarize: true`) APIによる話者IDの自動グループ化・UI表示
  3. ⚡ **ライブ字幕**: ブラウザ / 端末による即時音声字幕表示
  4. ✨ **ノイズ除去**: ElevenLabs Voice Isolation (`/v1/audio-isolation`) による原音と雑音除去後の音声を相互試聴・保存
- 無音・小声時のWhisperハルシネーション（「ご視聴ありがとうございました」）の自動検知・警告フィルターを実装。
- Vercel本番（Production）へパブリック公開URL `https://ai-speech-demo-ogamayokoys-projects.vercel.app` を更新・動作確認済み。
- 本人指示（「すべて実際のAPI組み込んでいい」）に基づき、[`apps/client/src/data/asr-settings.ts`](file:///c:/Users/goyok/OneDrive/Docments/Programming/opeai-hackathon/apps/client/src/data/asr-settings.ts) へ OpenAI, ElevenLabs, Deepgram, AssemblyAI, Speechmatics, pyannote の全6社の本番APIキーを埋め込み・実接続完了。
- 全67件の自動テスト、TypeScript型検査 (`npm run typecheck`)、ビルド確認に全て合格。

### 録音後の雑音除去・音声保存（2026-09-15）

- 本人依頼で端末直接ASR画面へElevenLabs Voice Isolatorを接続。原音保存後に除去音声を端末保存・再生し、後処理ASRへ利用。原音の即時側と結果を分離し、期限・取消・再利用を維持。Supabase変更なし。
- 型/関連検査、Android/iOS/Web export、人工音声の雑音除去→保存→実Scribe、ブラウザの保存/再生/結果切替を確認。実スマホ・品質評価・別デモ/旧共有APIへの接続は未確認/対象外。[変更・対象版・証拠・残件](../history/AUDIO_ISOLATION_IMPLEMENTATION_20260915.md)。

### リアルタイム書き起こしはElevenLabs（2026-09-15）

- 本人の選択をMVP_SPEC §9.0へ反映。録音中は `scribe_v2_realtime`、録音後の全社結果・別LLM比較は維持する。接続コード・実機遅延は未実装/未測定。[判断・対象版・残件](../history/ELEVENLABS_REALTIME_DECISION_20260915.md)。

### Webの文字起こしモックと競合解消（2026-09-15）

- 依頼：「Gitのコンフリクトを直してモックで書き起こしできる画面」、追加でWeb版を優先。K02、M01/M05/M06、U02/U03/U07/U14/U16の人工画面範囲。
- Webの起動先はログイン不要の文字起こしモック。架空の2会話、デモ録音/停止、処理中、文字起こし/要約/ToDo、元発言、保存一覧、エラー/無音/再試行を実装。データはメモリ内。マイク/実ASR/APIを使わない。
- Gitの4競合は両側の追加を保持して統合。既存のSetlog UI、端末直接ASR、声の登録、PWA、バックエンド更新と別作業の未ステージ文書を保持。
- 自己確認成功：型/UI11・契約55・tooling・文書・PWA3、本番Webビルド、1280px/390pxで正常/エラー/無音と保存往復。Git未解決0、commit/pushなし。
- [対象版・検証・残件](../history/WEB_TRANSCRIPTION_MOCK_20260915.md)。起動は[開発手順](APP_DEVELOPMENT.md)。実機・実録音/ASR・公開・MVP全体の完成とはしない。

### Setlog UIとクラウド接続

- HinataのSetlog UI、NativeTabs/Stack、カセット、録音/ルーム/自分の記録を実装済み。クラウドAuth/DB/Storageは人工データで確認済み。
- Android preview APK versionCode 2が完了。実機操作・iPhone署名・2入力統合・M15は残る。[接続記録](SETLOG_CONNECTED_MOCK.md)、[最新APK・再起動](EXPO_CLOUD_CONNECTION.md)。

### 端末直接ASR・声の登録・PWA

- 質問への調査：モデル3候補に加え、APIはElevenLabs Voice Isolator、Resemble Audio Enhancement、Audoを確認し、キー取得先を案内。方式採用・導入・音声処理は未実行。[根拠・対象版・限界](../history/NOISE_SUPPRESSION_RESEARCH_20260915.md)。
- 当日のASRはスマホから直接送信。6社7経路とpyannote、別LLM比較を追加。人工日本語で実APIを確認済み。実スマホ録音/各社CORS、共有Source保存/2入力統合/M15は残る。[直接ASR](DIRECT_ASR.md)、[説明資料](ASR_MODEL.md)。
- ログイン不要の本人音声の端末内登録準備を追加。外部照合・実機録音/配布は未確認。[声の登録](VOICE_ENROLLMENT.md)。
- Web PWAのmanifest/キャッシュ/追加案内を実装。公開・実機インストールは未確認。[PWA](PWA.md)。

### バックエンドの現行仕様への移行

- 処理同意の画面・保存・判定をAPI/worker/クライアントから撤去。認証・所有者・版・期限・checksum・送信先・共有許可は維持。[移行記録](../history/BACKEND_PROCESSING_MIGRATION_20260915.md)。
- 端末ASRからSource保存/2入力統合、M15の参照/履歴契約は次の対象。実サービス更新・実機検証は別。

## 残件と後段の条件

- M15の参照/履歴/上限、共有保存・2入力統合の実行場所/担当は正本の未決定として扱う。依存する実接続だけ保留し、今回の人工Web画面は独立して進める。
- 音声の利用条件は[VALIDATION](VALIDATION.md#音声の利用処理条件)。署名・対応OS・HTTPS/認証・実モデル予算は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)の該当Kで確認。
- この依頼より前の許可・実行結果は、現在の依頼へ自動拡張しない。別PCの動作は受け手の確認待ち。

## 結果の記録

各依頼を日付別履歴へ1記録で残す。対象版/既存差分、KとM/U/受入ID、担当/変更先、契約/fixture版、判断、確認コマンド/条件と成功・失敗・未実行・実施不能・対象外、証拠、残件を記録。模擬・実生成・実音声・外部登録と、自己確認・独立レビューを区別する。

## 以前の記録

競合の両側と全旧記録は[統合時のWORKFLOW全文](../history/WORKFLOW_ARCHIVE_20260915_MOCK.md)へ移管した。過去の成功・失敗・保留・許可を保持し、現在地の本文へ複製しない。
