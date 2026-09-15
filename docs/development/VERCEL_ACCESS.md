# AI IDEからVercelを操作する

ユーザー提供のVercelトークンをリポジトリルートの`.env.vercel.local`に`VERCEL_TOKEN`として保存している。値は表示・コミットせず、アプリの公開環境変数へ入れない。Git・EAS・Vercelアップロードの除外対象。OneDrive配下なので、そのフォルダの同期設定は適用される。他PCにはGitで配布されない。

PowerShellを実行できるAI IDEはルートから利用できる。

```powershell
# 認証確認（必要なフィールドだけ表示）
$result = & ./scripts/vercel-api.ps1 -Path '/v2/user'
$result.user | Select-Object username
```

`scripts/vercel-api.ps1`は認証ファイルを実行時に読み、`https://api.vercel.com`だけに送信する。リダイレクトは許可しない。`-Method`でHTTPメソッド、`-Path`でバージョン付きAPIパス、`-BodyFile`でJSONを指定できる。チームのリソースにはAPIに応じて`teamId`クエリ等が必要。応答に秘密情報を含むAPIでは出力を必要項目だけに絞る。

2026-09-12、`GET /v2/user`で`og-amayokoy`として認証成功。今回の確認は読み取りだけで、プロジェクト変更・デプロイ・ドメイン変更は行っていない。操作可能な範囲はトークンのスコープとアカウント権限による。実際の変更はその時点のユーザー依頼に基づいて行う。ネットワーク制限のあるAI IDEでは、外部通信の実行権限が別途必要になる。

API仕様：[Vercel REST API](https://vercel.com/docs/rest-api)。
