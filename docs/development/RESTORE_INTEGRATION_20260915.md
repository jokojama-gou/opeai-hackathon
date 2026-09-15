# 退避変更の復元・統合（2026-09-15）

対象は `codex/rn-expo-parallel-handoff`、HEAD `4ecab1d`。mainの9コミットを保持し、同期前の未コミット変更89ファイルと、その後の編集を統合した。依頼範囲はローカルでの復元・統合・参照/関連テストの確認。コミット・push・公開は含めない。

## 保全と統合方針

- 同期前: `stash 1f3eb52610c7143a8c03f0ff8266a1a76117c661` と `repo-sync-backups/opeai-hackathon-2026-09-14T16-27-08-712Z/original`。89ファイルをSHA-256とGit blob IDで確認済み。
- 統合開始時: main取り込み後の179ファイルをハッシュ記録し、今回触れる既存ファイルと11件の新しい編集を `repo-sync-backups/opeai-hackathon-integrate-2026-09-14T16-56-18-020Z/before` へ保存。反映直前にも全179ファイルを照合。
- 退避前の基準版・退避版・main版・現在版を比較。新版の画像v2、一覧整理、名称候補を保持し、Setlog構成1.4から新しい一覧とv2を参照する。実フォント・見本・v1画像もリポジトリ内へ復元。
- Setlogの画像v2のREADMEを入口にし、v1の説明・生成指示は[履歴](../product/prototypes/setlog-ui/history-v1.md)へ保存。既存MVPの画面案とSetlog案の分離を維持。
- Appのmainの人工デモ/APIモードを保持し、開発時だけUI検討モックの入口と戻る操作を復元。旧カウンターはmainが置き換えた基盤なので再導入しない。
- AGENTS・補助Skill・検証手順のローカル変更を復元。package scriptsはmainの契約/製品データテストと復元した検証入口を併存させる。
- WORKFLOWは新しい記録とmain側の記録を残し、同期前のローカル履歴を追加。過去の成功数を今回の検証結果に流用しない。

<a id="implementation-gaps"></a>
## 採用仕様と現在の実装の差

採用仕様は[MVP_SPEC 2.3](../product/MVP_SPEC.md)、担当と後続Kは[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)。本節は実装との照合結果であり、新しい仕様の正本ではない。

| 項目 | 復元した決定・確認結果 | 後続の対応 |
|---|---|---|
| K03/K09/K10・AC19: 処理同意 | 同期前のMVP_SPEC §9.2とWORKFLOWに、2026-09-13ユーザー決定「利用時点で承諾済み、同意画面/データ/API/判定を設けない」が明記されていた。mainの翌日の変更は外部ASRの採用で、今回照合した資料にはこの決定の撤回が記録されていないため復元。mainの[処理経路](../../apps/client/src/data/processing.ts)はconsent_idを作成/送信し、[API](../../services/backend/app/main.py)と[service](../../services/backend/app/service.py)、[生成画面](../../apps/client/src/screens/LiveInsights.tsx)にも同意の取得・判定が残る | 仕様へ未対応。schema・生成型・API/worker・画面・テストを一緒に移行する必要がある。認証/所有者/共有範囲/保持期限の検査は維持する。今回の復元依頼で既存バックエンドの処理を変更しない |
| K03・AC01/02/14/19: オフライン録音とiPhoneの追加開始入口 | ログイン済み端末のオフライン新規録音、アクションボタンの開始条件を復元 | 今回は実機・App Intents・録音を検証していない。既存実装の受入適合は未確認 |
| K04/K06・AC03/10/13/16: 確認期限・共有取消反映 | 確認期限の起点、取消後5秒以内の遮断などローカルの追加受入を復元 | 取り込み済み共有実装をこの受入に沿って人工時計・実機で確認する必要がある。今回の契約テスト成功だけでは適合済みとしない |
| 外部ASR | mainのworker分割・時刻変換・結果結合・再試行/費用上限・外部保持条件を保持。処理同意に依存する部分を復元方針に合わせて仕様上整理 | 提供者/モデル・実送信設定と品質の選定/検証は引き続き別作業 |

## 検証

- 成功: Node.js 22.20.0で `node scripts/verify.mjs all` が8/8。UIデータ11、mainのTS契約/クライアント/製品データ28、旧共有試作4、検証入口7の計50テスト。型チェック、文書参照、Skill metadata、文書検査の自己テストも成功。
- 追加確認: 復元した発表準備フォルダを含む69文書・731ローカル参照/使用アンカーを確認。通常の文書検査は59文書・712参照、管理metadataは16ファイル。外部URLの現行内容の再調査は対象外。
- ブラウザー: localhost:8091でmainの人工デモ→UI検討モック→入口の「今日」へ戻る操作を確認。復元したモックの古い説明を修正し、Webで未対応のBackHandler呼出しをAndroidだけに限定。修正後の開閉で新しいconsole errorがないことを確認。
- ブラウザー: 127.0.0.1:8092の書体見本でNoto Sans JP 600とKosugi Maru 400の実フォント読込・字形を確認。画像v2のローカル表示を確認。元画像・フォントのバイト保存と画面表示を区別して検証。
- 再確認: モック修正後に型/UI/文書/metadataの4/4が成功。統合対象外164ファイルのSHA-256一致、89ファイルすべての存在、新しいWORKFLOW/PRODUCT_CORE追記の保持、競合記号なし、差分空白を確認。
- 環境: ロックファイルどおりの依存をnpm ci --ignore-scriptsで導入（既定Node 24でengine警告あり、package-lock.jsonの内容は保持）。検証とMetroには導入済みNode 22.20.0を明示使用。MetroのDevTools取得は環境権限で失敗したが同梱版で起動。dotenv・telemetry・外部APIを使わずloopbackで確認。
- 対象外: Python backendの再テスト、production build、実機、実API、実音声、ASR/生成品質。mainのAPI/worker/契約実装を今回変更していない。独立レビューは実施していない。
- 保存: 変更は未コミット。stashと両バックアップを保持し、削除・pushしない。検証用サーバーとタブは終了する。

## 89ファイルの扱い

一覧の各ファイルは通常の作業ツリーから参照できる。旧版を併存させた場合は新版の入口と区別する。[ハッシュ一覧](restore-integration-20260915.json)は退避時と統合時の対応を記録する。

| ファイル | 扱い |
|---|---|
| [.agents/skills/aidd-lite-handoff/SKILL.md](../../.agents/skills/aidd-lite-handoff/SKILL.md) | 原本どおり復元 |
| [.agents/skills/aidd-lite-implement/SKILL.md](../../.agents/skills/aidd-lite-implement/SKILL.md) | 原本どおり復元 |
| [AGENTS.md](../../AGENTS.md) | 原本どおり復元 |
| [README.md](../../README.md) | 新版と差分を統合 |
| [apps/client/App.tsx](../../apps/client/App.tsx) | 新版と差分を統合 |
| [apps/client/src/data/ui-study.test.mjs](../../apps/client/src/data/ui-study.test.mjs) | 原本どおり復元 |
| [apps/client/src/data/ui-study.ts](../../apps/client/src/data/ui-study.ts) | 原本どおり復元 |
| [apps/client/src/navigation/ui-study.ts](../../apps/client/src/navigation/ui-study.ts) | 原本どおり復元 |
| [apps/client/src/screens/UiStudy.tsx](../../apps/client/src/screens/UiStudy.tsx) | 新版と差分を統合 |
| [apps/client/src/ui/StudyPrimitives.tsx](../../apps/client/src/ui/StudyPrimitives.tsx) | 原本どおり復元 |
| [docs/development/APP_DEVELOPMENT.md](../../docs/development/APP_DEVELOPMENT.md) | 新版と差分を統合 |
| [docs/development/CODEX_OPERATING_GUIDE.md](../../docs/development/CODEX_OPERATING_GUIDE.md) | 原本どおり復元 |
| [docs/development/MULTIPLATFORM_DELIVERY_PLAN.md](../../docs/development/MULTIPLATFORM_DELIVERY_PLAN.md) | 新版と差分を統合 |
| [docs/development/WORKFLOW.md](../../docs/development/WORKFLOW.md) | 新版と差分を統合 |
| [docs/development/aidd-lite/GUIDE.md](../../docs/development/aidd-lite/GUIDE.md) | 原本どおり復元 |
| [docs/product/MVP_SPEC.md](../../docs/product/MVP_SPEC.md) | 新版と差分を統合 |
| [docs/product/PRODUCT_CORE.md](../../docs/product/PRODUCT_CORE.md) | 新版と差分を統合 |
| [docs/product/SETLOG_UI_STRUCTURE.md](../../docs/product/SETLOG_UI_STRUCTURE.md) | 新版と差分を統合 |
| [docs/product/prototypes/design-directions/a-sport-minimal-v2.png](../../docs/product/prototypes/design-directions/a-sport-minimal-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/a-sport-minimal.png](../../docs/product/prototypes/design-directions/a-sport-minimal.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/b-quiet-editorial.png](../../docs/product/prototypes/design-directions/b-quiet-editorial.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/c-soft-modern-v2.png](../../docs/product/prototypes/design-directions/c-soft-modern-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/c-soft-modern.png](../../docs/product/prototypes/design-directions/c-soft-modern.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/d-slack-mobile-v1.png](../../docs/product/prototypes/design-directions/d-slack-mobile-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/d-slack-mobile-v2.png](../../docs/product/prototypes/design-directions/d-slack-mobile-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/e-ios-today-v1.png](../../docs/product/prototypes/design-directions/e-ios-today-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/e-ios-today-v2.png](../../docs/product/prototypes/design-directions/e-ios-today-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/e-ios-today-v3.png](../../docs/product/prototypes/design-directions/e-ios-today-v3.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-01-home-talk-v1.png](../../docs/product/prototypes/design-directions/f-01-home-talk-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-02-recording-v1.png](../../docs/product/prototypes/design-directions/f-02-recording-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-02-recording-v2.png](../../docs/product/prototypes/design-directions/f-02-recording-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-03-archives-v1.png](../../docs/product/prototypes/design-directions/f-03-archives-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-04-sources-v1.png](../../docs/product/prototypes/design-directions/f-04-sources-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-04-sources-v2.png](../../docs/product/prototypes/design-directions/f-04-sources-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-05-saved-export-v1.png](../../docs/product/prototypes/design-directions/f-05-saved-export-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-05-saved-export-v2.png](../../docs/product/prototypes/design-directions/f-05-saved-export-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-06-sharing-setup-v1.png](../../docs/product/prototypes/design-directions/f-06-sharing-setup-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-06-sharing-setup-v2.png](../../docs/product/prototypes/design-directions/f-06-sharing-setup-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-06-sharing-setup-v3.png](../../docs/product/prototypes/design-directions/f-06-sharing-setup-v3.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-07-sharing-states-v1.png](../../docs/product/prototypes/design-directions/f-07-sharing-states-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-07-sharing-states-v2.png](../../docs/product/prototypes/design-directions/f-07-sharing-states-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-08-ai-states-v1.png](../../docs/product/prototypes/design-directions/f-08-ai-states-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-09-chat-services-v1.png](../../docs/product/prototypes/design-directions/f-09-chat-services-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-09-chat-services-v2.png](../../docs/product/prototypes/design-directions/f-09-chat-services-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-10-settings-v1.png](../../docs/product/prototypes/design-directions/f-10-settings-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-10-settings-v2.png](../../docs/product/prototypes/design-directions/f-10-settings-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-11-entry-recovery-v1.png](../../docs/product/prototypes/design-directions/f-11-entry-recovery-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-11-entry-recovery-v2.png](../../docs/product/prototypes/design-directions/f-11-entry-recovery-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-12-review-interruption-v1.png](../../docs/product/prototypes/design-directions/f-12-review-interruption-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-13-android-v1.png](../../docs/product/prototypes/design-directions/f-13-android-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-13-android-v2.png](../../docs/product/prototypes/design-directions/f-13-android-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-14-account-filters-v1.png](../../docs/product/prototypes/design-directions/f-14-account-filters-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-14-account-filters-v2.png](../../docs/product/prototypes/design-directions/f-14-account-filters-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-15-progress-connection-v1.png](../../docs/product/prototypes/design-directions/f-15-progress-connection-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-15-progress-connection-v2.png](../../docs/product/prototypes/design-directions/f-15-progress-connection-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-15-progress-connection-v3.png](../../docs/product/prototypes/design-directions/f-15-progress-connection-v3.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-16-confirmations-v1.png](../../docs/product/prototypes/design-directions/f-16-confirmations-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-16-confirmations-v2.png](../../docs/product/prototypes/design-directions/f-16-confirmations-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-17-record-scope-v1.png](../../docs/product/prototypes/design-directions/f-17-record-scope-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-17-record-scope-v2.png](../../docs/product/prototypes/design-directions/f-17-record-scope-v2.png) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/f-screen-gallery.html](../../docs/product/prototypes/design-directions/f-screen-gallery.html) | 原本どおり復元 |
| [docs/product/prototypes/design-directions/g-ios-home-attention-v1.png](../../docs/product/prototypes/design-directions/g-ios-home-attention-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/mvp-spec-wireframes.html](../../docs/product/prototypes/mvp-spec-wireframes.html) | 新版と差分を統合 |
| [docs/product/prototypes/setlog-ui/01-main-screens-v1.png](../../docs/product/prototypes/setlog-ui/01-main-screens-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/02-ai-sharing-states-v1.png](../../docs/product/prototypes/setlog-ui/02-ai-sharing-states-v1.png) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/README.md](../../docs/product/prototypes/setlog-ui/README.md) | 新版を保持・旧版をhistory-v1.mdへ保存 |
| [docs/product/prototypes/setlog-ui/fonts/KosugiMaru-Regular.ttf](../../docs/product/prototypes/setlog-ui/fonts/KosugiMaru-Regular.ttf) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/LICENSE.txt](../../docs/product/prototypes/setlog-ui/fonts/LICENSE.txt) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/METADATA.pb](../../docs/product/prototypes/setlog-ui/fonts/METADATA.pb) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/README.md](../../docs/product/prototypes/setlog-ui/fonts/README.md) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/METADATA.pb](../../docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/METADATA.pb) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/NotoSansJP-Variable.ttf](../../docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/NotoSansJP-Variable.ttf) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/OFL.txt](../../docs/product/prototypes/setlog-ui/fonts/noto-sans-jp/OFL.txt) | 原本どおり復元 |
| [docs/product/prototypes/setlog-ui/kosugi-maru-body.html](../../docs/product/prototypes/setlog-ui/kosugi-maru-body.html) | 原本どおり復元 |
| [hackathon-pitch/AGENTS.md](../../hackathon-pitch/AGENTS.md) | 原本どおり復元 |
| [hackathon-pitch/README.md](../../hackathon-pitch/README.md) | 原本どおり復元 |
| [hackathon-pitch/day-of-details.md](../../hackathon-pitch/day-of-details.md) | 原本どおり復元 |
| [hackathon-pitch/event-open-questions.md](../../hackathon-pitch/event-open-questions.md) | 原本どおり復元 |
| [hackathon-pitch/event-rules.md](../../hackathon-pitch/event-rules.md) | 原本どおり復元 |
| [hackathon-pitch/event-sources.md](../../hackathon-pitch/event-sources.md) | 原本どおり復元 |
| [hackathon-pitch/output/slides.md](../../hackathon-pitch/output/slides.md) | 原本どおり復元 |
| [hackathon-pitch/past-winner-reference.md](../../hackathon-pitch/past-winner-reference.md) | 原本どおり復元 |
| [hackathon-pitch/skill/hackathon-pitch-coach/SKILL.md](../../.agents/skills/hackathon-pitch-coach/SKILL.md) | 原本どおり復元後、現在は標準skill配置へ移設 |
| [hackathon-pitch/skill/hackathon-pitch-coach/agents/openai.yaml](../../.agents/skills/hackathon-pitch-coach/agents/openai.yaml) | 原本どおり復元後、現在は標準skill配置へ移設 |
| [hackathon-pitch/start-coach.ps1](../../hackathon-pitch/start-coach.ps1) | 原本どおり復元 |
| [hackathon-pitch/working-draft.md](../../hackathon-pitch/working-draft.md) | 原本どおり復元 |
| [package.json](../../package.json) | 新版と差分を統合 |
| [scripts/verify.mjs](../../scripts/verify.mjs) | 新版と差分を統合 |
| [scripts/verify.test.mjs](../../scripts/verify.test.mjs) | 新版と差分を統合 |
