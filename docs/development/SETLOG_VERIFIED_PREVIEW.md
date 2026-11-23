# 完成版Setlogの隔離プレビュー

2026-09-15。APK `5ebe13aa-195f-4d01-9878-a84455c0a9cf` 完成後、同じcheckoutで別作業のマージが始まり、LiveApp等4ファイルが競合した。完成版のExpo Goを維持するため、共有checkoutのマージには手を加えず、`050f393` のフロントエンドを `.npm-cache/setlog-verified-preview` に復元した。

この版はHinataのUI、Router、実API接続を含む。後からマージ中の直接ASR・新バックエンド契約は含まない。現在稼働中のAPIプロセスは完成APKと確認済みの版を読み込んでいる。今後APIを新ソースで再起動する際は、処理契約とこのAPKの互換性を確認すること。

```powershell
./scripts/phone-app-verified.ps1
```

Expo Goは同じWi-Fiで `exp://192.168.100.37:8083`、Webは `http://localhost:8083`。既存のQRを使える。再起動でPCのLANアドレスが変わったら、起動ログのQRを使用する。

復元元は `050f393` の `apps/client`、`packages/api-ts`、参照する `contracts`、`package.json`、`package-lock.json`。Git履歴、rootのサービス認証設定、バックエンド環境はコピーしていない。固定依存は隔離先で `npm ci --no-audit --no-fund`。稼働APIへつなぐURLは隔離先のpreview EAS設定から読む。

APK・実API・画面の検証は[実接続記録](EXPO_CLOUD_CONNECTION.md)と[UIモック記録](SETLOG_CONNECTED_MOCK.md)を参照。マージ中のcheckout全体について、この検証が成功したとは扱わない。

復旧確認成功：隔離先へ固定依存1004パッケージを導入、TypeScript型チェック、Expo GoマニフェストHTTP 200（Setlog/SDK57）、実API health 200、Webバンドル1069モジュールとブラウザのログイン画面表示。初回コピーに足りなかったcontractsの参照6件は、同じ050f393から追加して型チェックを再実行し成功した。起動中のサーバーは隔離先のソースを使い、同じQR/URLで利用できる。
