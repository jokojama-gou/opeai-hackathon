# opeai-hackathon

日常の会話を写真のように気軽に残し、各自が記録した同じ会話を統合して、アイデア・約束・思い出を振り返る2C向けアプリです。本人の録音開始、参加範囲に応じた共有、根拠へ戻れる記録を重視します。

## 現在地

RN＋ExpoでiOS・Androidを共通開発し、Webは保険として扱います。現行仕様は2.2で、外部APIによる音声書き起こしを採用しています。各スマホから共通バックエンドへ音声を送り、workerが必要な分割と外部ASR呼出・結果結合を担当します。Supabaseは認証・非公開保存・ジョブ管理を担います。初回UIは明色＋Liquid Glass。仕様・採用状態は[MVP_SPEC](docs/product/MVP_SPEC.md)、進捗・検証結果は[WORKFLOW](docs/development/WORKFLOW.md)が正本です。2.1の独立レビューは完了しましたが、今回の2.2差分の独立レビューは未実施です。

既存のExpoスターターを同じ作業ツリーへ取り込みました。製品機能は未実装です。コード生成・バンドル出力と、実機・音声・APIの成立は区別します。

## 開発を始める

Node.js 22.20.0 / npm 10.9.0で、リポジトリルートから実行します。

~~~sh
npm ci
npm run web
~~~

共通画面は `apps/client/App.tsx` です。スマホ・型チェック・EASの前提は[開発環境](docs/development/APP_DEVELOPMENT.md)を参照してください。

AIは[AGENTS](AGENTS.md)→[現在地](docs/development/WORKFLOW.md)→[担当と実装順](docs/development/MULTIPLATFORM_DELIVERY_PLAN.md)から、該当する仕様・受入条件だけを読みます。次の実装入口はK01の人工契約、続いてK02の画面です。資料の存在自体は実装依頼ではありません。

### 初回プロンプト

~~~text
AGENTSとWORKFLOWを読み、ロードマップから次のKの担当・変更先・依存を確認してください。
MVP_SPECの該当機能・画面・受入条件を参照し、現在の依頼の範囲で進めてください。
未実装・実装済み・実機確認済みを分け、履歴の旧指示を実行しないでください。
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

共有リポジトリが資料の正本です。個人PCの移管前資料を並行更新しません。音声・文字起こし・内容入り評価、認証情報、個人環境設定は共有対象に含めません。詳細な音声条件はVALIDATIONを参照してください。
