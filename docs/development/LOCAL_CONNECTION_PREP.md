# スマホ接続の準備と再起動

2026-09-15。iPhone・Android各1台を同じWindows側APIへ接続するための開発環境。端末へのインストールは[端末手順](DEVICE_INSTALLATION.md)、製品実装の残件は[現在地](WORKFLOW.md)を参照する。

## このPCで用意したもの

| 項目 | 状態・場所 |
|---|---|
| Docker | Desktop 4.43.1 / Linux Engine 28.3.0で起動確認 |
| Supabase | CLI 2.117.0をpackage-lockで固定。新規ローカルproject `conversation-mvp` に既存migrationを適用 |
| 認証・保存 | Auth / PostgreSQL / private recordings bucket。管理者作成の2アカウント。一般のsignupは無効 |
| Python | 3.12.14、`.npm-cache/backend-venv` に依存を導入 |
| 音声形式検査 | FFmpeg/ffprobe 9.0.1を `.npm-cache/tools/ffmpeg` に配置。公式配布先のSHA-256と照合。`backend.ps1` がffprobeのPATHを設定 |
| API / worker | APIは `http://127.0.0.1:8000`。workerは別プロセス |
| スマホ用HTTPS | cloudflared 2026.9.1によるQuick Tunnel。ダウンロード時にrelease digestとSHA-256を照合 |

現在のHTTPS URLはGit除外の `.npm-cache/phone-api-url.txt`、クライアント設定は `apps/client/.env.local`。APIのURLだけを両端末へ渡す。バックエンド `.env` と `.npm-cache/local-test-accounts.json` のパスワードはローカル専用で、Gitへ含めない。音声プロバイダの暗号化保管庫は変更・復号していない。

Quick TunnelのURLは起動ごとに変わる。今回は固定URLの配備ではない。再起動時は2台の開発設定を更新し、単体デモビルドへ埋め込んだURLなら再ビルドする。当日は固定URLを用意するか、最終ビルド後に同じトンネルを維持する運用を決める。PCの電源・インターネット接続も必要。トンネルが公開するのは認証付き製品APIだけで、Supabase管理画面やservice-role keyをスマホへ公開する構成ではない。

## 確認した経路と限界

PCから公開HTTPSへアクセスし、別々の開発アカウントで次を確認した。入力はFFmpegで生成した1秒の正弦波（AAC/48kHz/mono）で、人の声は含まない。

- 未ログインの録音一覧は401。2アカウントのログインとDB一覧取得は成功。
- 各アカウントで作成→形式検査→private Storageへ保存→取得が成功し、取得内容のバイト一致を確認。
- 別アカウントによるmetadata/音声取得は404。試験記録の削除要求後、本人の音声取得は410。
- 一般のsignupは422 `signup_disabled`。ASR/生成は無効のまま。

証拠はこのPCの `.npm-cache/device-connection-result.json`、人工検査コードは `.npm-cache/check-device-connection.py`。この2ファイルは共有成果物ではなくローカル検査記録。既存backendの同意付きAPIを使った接続試験であり、採用仕様2.4への同意経路移行・ASR・2入力統合・AI会話の動作証拠ではない。iPhone/Androidからの実接続、録音、署名・インストールはまだ未確認。

初回の実接続で `email_provider_disabled` が判明した。`[auth.email].enable_signup=true` と、全体の `[auth].enable_signup=false` を組み合わせ、ログイン成功とsignup拒否を実確認した。Supabase再起動中は既存workerがDB接続エラーで終了したため、DB起動完了後に再起動した。自動復旧は未実装。

## 再起動する

以下はリポジトリルート、PowerShell 7で実行する。すでに動いているプロセスへ重ねて起動しない。今回起動したPIDは `.npm-cache/local-processes.json`、ログは `.npm-cache/backend-*.log` と `.npm-cache/tunnel.*.log` にある。PIDは再利用されるため、停止前に実行コマンドとこのリポジトリのプロセスであることを照合する。

1. Docker Desktopを起動し、`docker version` でLinux Engineを確認する。
2. ローカルSupabaseを起動する。

```powershell
& ./node_modules/.bin/supabase.cmd start --exclude realtime,imgproxy,edge-runtime,logflare,vector,supavisor --agent no
```

3. 初回設定がない別PCでだけ、`./scripts/backend.ps1 setup -Python <Python3.12のパス>` と `./scripts/configure-local-backend.ps1` を実行する。後者はローカルSupabaseのみを受け付け、既存設定があると停止する。既存アカウントを消してやり直さない。このPCでは設定済みなので不要。
4. 別々のターミナルでAPI、workerを起動する。

```powershell
./scripts/backend.ps1 serve
```

```powershell
./scripts/backend.ps1 worker
```

5. HTTPS入口を別ターミナルで起動する。今回取得したバイナリはこのPCのキャッシュにある。

```powershell
& ./.npm-cache/tools/cloudflared.exe tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

6. 表示されたHTTPS URLで `/health` を開く。両端末の `EXPO_PUBLIC_API_URL` を同じ新URLに更新する。development buildはMetroを再起動し、単体Release/previewは必要に応じて再ビルドする。開発版では人工デモからAPIモードへ切り替えてログインする。
7. Supabaseを止める場合は先にAPI/worker/トンネルを終了し、`supabase stop` を使う。開発データを保持するため `--no-backup` やvolume削除を加えない。

別PCはこのPCの `.npm-cache` やbackend秘密鍵をコピーして環境構築したことにせず、同じ依存と必要なツールを用意する。Macは同じソース版・公開HTTPS URLを使い、テストアカウントの本人向け認証情報だけを受け取る。

## 参照

- [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase CLIのメールprovider設定に関する修正記録](https://github.com/supabase/supabase/issues/40582)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [FFmpeg公式ダウンロード案内](https://ffmpeg.org/download.html)
