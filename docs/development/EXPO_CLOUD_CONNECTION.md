# このPCのExpo・クラウドSupabase接続

2026-09-15。対象はWindowsのこのcheckout。別PCの[ローカルSupabase準備](LOCAL_CONNECTION_PREP.md)とは接続先が異なる。

## 現在の構成

- アプリ：Setlog / `@yokoyamago/hackathon-client`、Android ID `com.yokoyamago.hackathonclient`。previewは単体APK。初回ログイン後は録音待機、録音・ルームの2タブ。
- DB/Auth/Storage：既存Supabase `nmidnmqnrhogehzehkjh`。非公開テーブル `private.app_entities`、private bucket `recordings`。
- API：このPCの `127.0.0.1:8000`。Supabase接続設定はGit対象外の `services/backend/.env`。実音声ASRと生成モデルは未設定・無効。
- 形式検査：FFmpeg/ffprobe 9.0.1を `.npm-cache/tools/ffmpeg` へ配置。1秒の人工AAC（48kHz/mono）を実MediaProbeで検査済み。`backend.ps1` がPATHを設定する。[FFmpeg公式が案内する配布元](https://www.gyan.dev/ffmpeg/builds/)のZIPのSHA256は `fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9` と照合した。
- スマホ接続：ユーザー了承済みCloudflare一時HTTPS。現在のURLはGit対象外 `.npm-cache/phone-api-url.txt` と、今回のAPK用 `apps/client/eas.json` のpreview環境変数に記録。
- Androidビルド：10:41 JSTに成功。[APKを取得](https://expo.dev/artifacts/eas/rw4Ft2pYvrGRSmzg3mLz_LOjkEhoafZVwfdnehA2aHE.apk) / [Expoのビルド画面](https://expo.dev/accounts/yokoyamago/projects/hackathon-client/builds/065bd0de-c822-4db5-83bc-71b2abbcde8d)。端末へのインストールと実機受入は未実施。

取得したAPKは73,608,313バイト、SHA256 `a4a75137766496577af8e5705037830ae571aebccb6e51db02059c79ef07f577`。ZIP整合性と展開後1,403ファイルのキー混入検査が成功した。

## 起動と維持

今動いているAPIとcloudflaredを止めると、APKからサーバーへ接続できなくなる。再起動時は別々のPowerShellで以下を実行する。

```powershell
# リポジトリルート、API
./scripts/backend.ps1 serve

# 別のPowerShell、承認済みの開発API用トンネル
./.npm-cache/tools/cloudflared.exe tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

新しい一時URLが発行されたら、`.npm-cache/phone-api-url.txt` と `apps/client/eas.json` の `build.preview.env.EXPO_PUBLIC_API_URL` を更新しAPKを作り直す。公開するのはAPI URLのみ。管理トークン・DBパスワード・service roleキーを `EXPO_PUBLIC_` へ入れない。

```powershell
./scripts/expo.ps1 -Task android
```

Expoの `EXPO_PUBLIC_` 値はアプリへ埋め込まれる。EAS用環境変数の扱いは[公式資料](https://docs.expo.dev/eas/environment-variables/)、APK形式は[公式手順](https://docs.expo.dev/build-reference/apk/)を参照。

## 確認済み範囲と残件

- クラウドDB：人工行のinsert/read/rollback、専用ロールの権限、匿名・認証済みクライアントの直接DB参照拒否を確認。Storage：人工バイト列のwrite/read/delete成功。再現は[backend手順](../../services/backend/README.md)。
- HTTPS：health成功、未認証 `/v1/recordings` は401。実ユーザーは0人（2026-09-15 10時台JST）。2開発アカウント作成は自動承認レビューが明示了承を要求し、回答待ち。製品APIに新規登録機能はない。
- アプリの人工API接続とクラウド認証は別の検証。実機録音・実ASR・2端末統合・相手ルーム/AI会話は未完。iPhone導入は[Mac/XcodeのPersonal Team手順](DEVICE_INSTALLATION.md)が必要。
- EAS送信物は `.easignore` で認証ファイルとGit履歴を除外。`.git/` だけではEASのshallow clone削除判定に一致しないため、`.git` と指定する。送信前の展開物と配布bundleを `scripts/check-client-secrets.mjs` で検査する。
