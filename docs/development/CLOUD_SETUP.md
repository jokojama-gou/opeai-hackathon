# クラウド開発環境のセットアップ

2026-09-12。現在の依頼は、保存済みトークンを使ったサービスの構成・初期連携。関連O02、D14/D15。製品のAPI契約、DBスキーマ、音声処理先を新たに確定するものではない。

## Expo

- プロジェクト：[yokoyamago/hackathon-client](https://expo.dev/accounts/yokoyamago/projects/hackathon-client)
- Project ID：`143962b8-7d31-413d-9b43-74ea32106cff`
- `apps/client/app.json`のownerとprojectIdを設定済み。
- `scripts/expo.ps1`でGit対象外の`.env.expo.local`から認証してEASを実行できる。利用例は[開発環境](APP_DEVELOPMENT.md#ai-ideのexpoトークン認証)。
- デモはExpo Goで起動する。署名・クラウドビルド・ストア提出は未実行。

## Vercel

Web用のローカル設定とリモートプロジェクトの作成・連携を完了。

- チーム：`ogamayokoys-projects`（`team_GgoD0T0YLAdny734gFL4Qdt4`）
- プロジェクト：[opeai-hackathon](https://vercel.com/ogamayokoys-projects/opeai-hackathon)
- Project ID：`prj_CJizohgkVb57cTERJp1cOiK6KqnI`
- ローカル連携：Git対象外の`.vercel/project.json`。
- 認証：[Vercelアクセス手順](VERCEL_ACCESS.md)。同時進行の別作業で保存された`.env.vercel.local`を使用。

| 設定 | 値 |
|---|---|
| Root Directory | リポジトリ直下（`apps/client`にはしない） |
| Framework Preset | Other |
| Node.js | 22.x（ルートpackage.jsonのengines） |
| Install Command | `npm ci` |
| Build Command | `npm run build:web` |
| Output Directory | `apps/client/dist` |

設定はルートの`vercel.json`が正本。単一HTML形式のExpo Web用に、画面URLを`index.html`へ書き換える。`.vercelignore`はCLI送信からトークン・資料・補助スクリプト等を除外する。公開対象はWeb出力だけで、Expo/Supabaseの管理トークンをVercelの環境変数へ設定する必要はない。

上表のリモート設定をGETで再取得して一致を確認。既定のVercel認証保護は`all_except_custom_domains`のまま。デプロイ・公開URL・Git自動デプロイ連携は未設定。ロードマップにあるRender Static Siteは以前の提案で、今回用意したVercel設定とは別。

### プレビュー作成の承認待ち

クラウドビルド確認用の送信対象は15ファイル：ルートの`package.json`・`package-lock.json`・`vercel.json`、`apps/client`の`package.json`・`app.json`・`App.tsx`・`index.ts`・`tsconfig.json`・`LICENSE`、同assetsのPNG 6件。トークン・開発資料は含めない。宛先は上記の専用Vercelプロジェクトで、targetはpreview。

送信リクエストは準備したが、自動承認レビューが「セットアップ依頼だけでは具体的なソース送信・デプロイの明示承認がない」と拒否したため未実行。ユーザーの承認後にプレビュー作成とクラウドビルド・応答の確認を行う。

参考：[Vercel公式の設定仕様](https://vercel.com/docs/project-configuration/vercel-json)。

## Supabase

既存プロジェクト`nmidnmqnrhogehzehkjh`の稼働状態`ACTIVE_HEALTHY`を再確認。regionは`ap-south-1`。新規プロジェクトや製品テーブルは作成していない。

管理APIへの接続は既存の`scripts/supabase-api.ps1`を利用する。[接続手順・別作業の検証結果](SUPABASE_ACCESS.md)を参照。管理トークンはアプリの認証鍵ではなく、アプリからの接続には別途契約・認証・権限設定が必要。

## 残っている確認

- 上記15ファイルをVercelへ送信する承認と、プレビューのビルド・配信確認。
- 各スマホのExpo Goからの実機起動。
- 製品機能の実装時に共通APIとDB/認証の具体仕様を決定。
