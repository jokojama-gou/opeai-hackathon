# AI IDEからSupabaseを操作する

元の確認PCでは、リポジトリルートの `.env.supabase.local` に `SUPABASE_ACCESS_TOKEN` を保存していました。他PCでの存在・認証成功は未確認です。既存の `.gitignore` の `.env.*` で除外されます。トークンの内容を表示・コピー・commitせず、アプリの公開環境変数にも入れないでください。元の保存先はOneDrive配下でしたが、現在の保存場所・同期設定は利用するPCごとに確認してください。

PowerShellを実行できるAI IDEは、リポジトリルートから次でアクセスできます。MCPの登録やIDEの再起動は不要な、Management API経由の方式です。

```powershell
# 接続確認・プロジェクト一覧
$projects = & ./scripts/supabase-api.ps1
$projects | Select-Object id, name, status

# 特定プロジェクトの確認
& ./scripts/supabase-api.ps1 -Path '/v1/projects/nmidnmqnrhogehzehkjh'
```

スクリプトは実行時に認証ファイルを読み、Supabase公式ホストだけへ送信します。`-Method` と `-BodyFile`（JSONファイル）で更新APIも呼べます。実際の変更はその時点のユーザー依頼の範囲で行ってください。APIの応答には秘密情報を含むエンドポイントもあるため、出力項目は作業に必要なものだけ選びます。

2026-09-12確認：プロジェクト一覧の認証成功、1件、状態 `ACTIVE_HEALTHY`。DB変更は未実行。ネットワーク制限のあるAI環境では外部通信の実行権限が必要です。他PCには認証ファイルはGitで配布されません。

認証仕様・各操作は[Supabase Management API公式資料](https://supabase.com/docs/reference/api/introduction)を参照。
