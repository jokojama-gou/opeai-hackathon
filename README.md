# opeai-hackathon

日常の会話を写真のように気軽に残し、各自が記録した同じ会話を統合して、アイデア・約束・思い出を振り返る2C向けアプリです。本人の録音開始、参加範囲に応じた共有、根拠へ戻れる記録を重視します。

## 現在地

書き起こしモデルを知りたい仲間向けに、[Scribe v2の選定理由・実際の検証・現在の実装との違い](docs/development/ASR_MODEL.md)をまとめています。

RN＋ExpoでiOS・Androidを共通開発します。録音アプリ全体のWeb版は保険ですが、外部共有の公開ページは必須です。現行仕様は2.7。友達登録・グループ作成から会話を始める方針を追加し、実装設計をまとめました。近距離接続は条件付きの追加入口、元の音声自動発見は保存案とします。新経路は未実装です。Setlog構成を採用し、「録音」「ルーム」の2タブ、録音の待機画面から起動、相手のルームで「記録／AI」を切り替えます。記録の統合と根拠付きAIに加え、[外部共有・公開URL（M18）](docs/product/MVP_SPEC.md#external-sharing)から受け手の利用開始につなぐ機能を必須にしています。当日のASRは各スマホから外部APIへ直接送信します。既存のクラウド接続・端末ASR・声の登録・PWAを維持し、共有保存/2入力統合/AI会話の接続先と担当は[MVP_SPEC §9](docs/product/MVP_SPEC.md#contracts)の残件として扱います。初回は明色、iOSはネイティブUI/Liquid Glass、AndroidはMaterial 3です。仕様は[MVP_SPEC](docs/product/MVP_SPEC.md)、進捗・検証結果は[WORKFLOW](docs/development/WORKFLOW.md)が正本です。今回の仕様反映の独立レビューは未実施です。

2026-09-14〜15に共通画面、人工契約、端末録音adapter、FastAPI/worker、2人の接続・共有確認、個人の訂正・保存に加え、個人Context/生成処理・ToDo/日次APIとLive画面を追加しました。開発起動は人工データの操作デモです。実ASR・2入力統合・スマホ実機の通し動作はまだ完成していません。実装範囲と残件は[現在地](docs/development/WORKFLOW.md#現在の状態)を参照してください。

## 発表準備・資料の確認

[発表準備](hackathon-pitch/README.md)に大会情報・発表コーチ・原稿テンプレートを保持しています。現行仕様は `docs/` を参照し、文書の確認には `npm run verify:docs` を使います。
音声検証環境 `../audio-validation-local/` は既存の保管条件に従ってリポジトリ外に保持します。

## 開発を始める

Node.js 22.20.0 / npm 10.9.3で、リポジトリルートから実行します。

~~~sh
npm ci
npm run web
~~~

各スマホのExpo Goで人工画面を確認できます。録音には専用development buildが必要です。共通画面は `apps/client/App.tsx`、起動・接続・ビルド手順は[開発環境](docs/development/APP_DEVELOPMENT.md)を参照してください。

変更後は[検証入口](docs/development/APP_DEVELOPMENT.md#verification)を使います。UIは `npm run verify:ui`、UIと文書の両方は `npm run verify -- ui docs`、登録済みの全ローカル確認は `npm run verify` です。AIは依頼された成果まで実装・検証・修正・再確認を続け、新しい仕様判断や担当範囲の変更が必要な部分だけ確認します。

AIは[AGENTS](AGENTS.md)→[現在地](docs/development/WORKFLOW.md)→[担当と実装順](docs/development/MULTIPLATFORM_DELIVERY_PLAN.md)から、該当する仕様・受入条件だけを読みます。バックエンドは[起動・検証手順](services/backend/README.md)を参照してください。人工画面の成功を実機・実処理の成功として引き継がないでください。

### 初回プロンプト

~~~text
AGENTSとWORKFLOWを読み、ロードマップから次のKの担当・変更先・依存を確認してください。
MVP_SPECの該当機能・画面・受入条件を参照し、依頼された成果まで必要な作業を分割して進めてください。
同じ依頼の明示済み判断と範囲を引き継ぎ、小作業ごとの再依頼を求めず、必要な検証・修正・再確認まで行ってください。
未実装・実装済み・実機確認済みを分け、終了した別作業の旧指示を実行しないでください。
~~~

## 必要な資料

| 目的 | 参照先 |
|---|---|
| 製品の方針・残る判断 | [PRODUCT_CORE](docs/product/PRODUCT_CORE.md) |
| 機能・画面・API・受入条件 | [MVP_SPEC](docs/product/MVP_SPEC.md) |
| 技術構成・担当・タスク・提出条件 | [ロードマップ](docs/development/MULTIPLATFORM_DELIVERY_PLAN.md) |
| 音声利用・検証 | [VALIDATION](docs/development/VALIDATION.md) |
| 人向けの説明 | [TEAM_CONCEPT](docs/product/TEAM_CONCEPT.html)、[シナリオ](docs/product/SCENARIOS_AND_SUCCESS.md) |
| 配置見本 | [15画面](docs/product/prototypes/mvp-spec-wireframes.html)。架空データであり製品ではない |
| 必要時の作業支援 | [AIDD-Lite](docs/development/aidd-lite/GUIDE.md) |

`docs/history/` は旧案・過去結果です。実装の通常入口ではなく、当時の理由や証拠が必要な場合に参照します。旧共有操作試作の位置付けは[試作README](docs/product/prototypes/README.md)に記載しています。

共有リポジトリが資料の正本です。個人PCの移管前資料を並行更新しません。ユーザーの当日決定により、5つのAPI/ツール設定を非公開リポジトリでチームへ平文共有します。clone/pullで取得でき、復号鍵は不要です。対象と利用上の扱いは[認証情報の保管](credentials/README.md)を参照してください。その他の個人環境設定、音声・文字起こし・内容入り評価は共有対象に含めません。詳細な音声条件はVALIDATIONを参照してください。

## 復元した資料と統合状態

[Setlog構成案](docs/product/SETLOG_UI_STRUCTURE.md)・[一覧整理](docs/product/SETLOG_RECORDS_LIST.md)・[画面画像v2と書体見本](docs/product/prototypes/setlog-ui/README.md)、[発表準備](hackathon-pitch/README.md)、[復元一覧と実装の残件](docs/development/RESTORE_INTEGRATION_20260915.md)を参照できます。
