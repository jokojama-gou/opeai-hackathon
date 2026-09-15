# バックエンド処理契約の現行仕様への移行

2026-09-15。主担当AI。ユーザー依頼「バックエンドの実装をすすめて」に対する最初の実装成果。

## 範囲・対象版

- 基準版 `3a5890e`。開始時のWORKFLOW変更とGit衝突修復の履歴ファイルを保持。新規の仕様採用、外部書込み、commit/pushなし。
- K01/K03/K04、M01/U03、AC19とAC13/14、MVP_SPEC §9.2/15。既定の「アプリ内処理同意なし」へ移行。共有許可・所有者・参加範囲は変更しない。
- 対象：backendのmodels/main/service/worker/contexts/generation、OpenAPI、clientのprocessing/useLiveWorkspace/storage/LiveApp/LiveInsightsと関連回帰テスト。共通Source/Recordingのschemaと4fixtureは変更なし。

## 変更と移行

- 旧処理同意と生成同意のAPI・入力型・保存・参照・画面導線を削除。upload/transcriptionは同意IDなしで要求可能。
- 同意の代わりにticket/jobが実行対象の設定snapshotを固定。所有者、版、checksum、期限、宛先、ASR provider/model/設定版を実行境界で検査し、旧ticketや旧jobを許可済みとみなさない。保持/予算未設定では外部呼出しない。
- 生成manifestから旧同意行を除外。生成の可否は既存のadapter設定と現在の所有権/共有範囲/期限で判断し、設定変更中の遅着結果を破棄する。録音の音声期限後も有効な文字の生成は可能。
- DBの歴史的な同意行は削除せず、新コードから読書きしない。JSON storeのためDDL不要。旧manifestはhash変更により再確認/再生成が必要。旧jobを自動再送しない。クライアントoperation keyを世代更新して旧同意キャッシュを使わない。
- [具体的な互換性・更新手順](../../services/backend/README.md#処理同意を持たない契約への移行2026-09-15)。API/worker/クライアントの同時更新が必要。今回は稼働サービスへ適用していない。

## 検証

- 自己確認。人工バイト列・人工ASR/生成adapter・MemoryStoreのみ。
- 基準版の隔離コピーで同意なしuploadは422となり、追加した回帰テストの失敗を再現。修正版では同じ経路でjobとSourceの成功を確認。
- 認証不正401、他人404、版違い409、期限410、checksum違い、旧入力422、旧ticket拒否、旧/宛先変更/model変更jobの無送信停止、処理中設定変更・削除後の公開抑止を確認。共有の双方許可/取消など既存回帰も継続。
- 初回はvenv未配置とグローバルPythonのpsycopg不足でテスト収集不能。Python 3.13のローカルvenvへrequirements.lock.txt通り導入。制限環境のネットワーク失敗後、許可された通常実行で導入成功。依存warning 2件は既存ライブラリの非推奨通知。
- 証拠はGit除外 `.npm-cache/conflict-preflight/backend-baseline.log`、`backend-setup.log`、`backend-migration-verify.log` と本タスク出力。UIの途中の型エラーは残っていたstateリセットを除去して解消。
- 最終 `npm run verify -- backend ui contracts tooling docs` は9/9検査成功。Python 70件、UI 11件、契約50件、型、tooling、文書/Skillを確認。`git diff --check` も成功。OpenAPIの出力は実API schemaと一致する回帰テストで照合。

## 残件・対象外

- 端末直接ASRの候補/原文→認証付き共有Source保存、2入力の共有統合、共有Context/clipは後続。旧サーバーASR経路の互換移行であり、端末直接ASRをWindows中継へ戻す変更ではない。
- M15の参照単位・初期選択・履歴・上限は未決定で、正式APIを推測追加していない。
- 実機/画面操作、実クラウド、実音声/実モデル、配布・公開・実サービス再起動は未実行。独立レビューは依頼なしのため対象外。アプリやMVP全体の完成とはしない。
