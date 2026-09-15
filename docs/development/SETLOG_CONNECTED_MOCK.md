# HinataのSetlog UIを使う実接続モック

2026-09-15。K02-ui01〜04 / K03 / K04 / K07、M01・M15の既存接続範囲、U01/U02/U03/U15/U16、AC01/02/14/15/19。今回の依頼はプッシュ済みのHinataのUIを探して、バックエンドに接続したExpoアプリとAPKを作ること。MVP全体の完成判定とは分ける。

## 使用した版と実装

- Hinataの `4c0e8b2` に[Setlogの画面見本](../product/prototypes/setlog-ui/README.md)、カセット案、フォントがある。`49a1273` の[MVP_SPEC §18](../product/MVP_SPEC.md#platform-design)にOS別の採用仕様がある。両方とも取得済みmainに含まれ、別ブランチからのcherry-pickは不要だった。作業途中に同checkoutで作成された `b7023ba` の既存APK接続差分を保持した。
- 起動先を `expo-router/entry` と `apps/client/app` へ移行。録音/ルームのNativeTabs、それぞれのStack、設定/確認のヘッダー。認証と録音の状態はタブより上のWorkspaceProviderに1つ保持する。
- 白・ミントの配色、Kosugi MaruとNoto Sans JPの実フォント、カセットの録音画面、自分の記録カード、日付の折りたたみ一覧、ログインを実装。画像は画面全体を貼らず、[カセットだけの素材と生成指示](../../apps/client/assets/setlog/README.md)を使用する。
- Androidの録音CTAはExpo UIのJetpack Compose Button/FilledTonalButton。ナビゲーションは両OSの標準。その他の既存入力・チェック・詳細カードはRN共通部品を継続しており、全画面のCompose/SwiftUI移植は未完。
- 録音中だけリールの装飾が回転する。動き低減では停止し、音量の人工変動は表示しない。端末録音・停止後保存・音声転送は既存adapter/APIへ接続。
- 相手ルーム・AI会話・確認集約の未実装範囲は準備中と表示。ASR/生成の未設定状態を架空の成功応答で補わない。旧人工デモは `/demo`、設定から明示的に開く。

## 開き方

Androidの単体APKとクラウド構成は[Expo実接続](EXPO_CLOUD_CONNECTION.md)に記載。Expo Goでは次を実行し、PCと同じWi-FiでQRを読む。SDK57対応のExpo Goを使う。

```powershell
./scripts/phone-app.ps1
```

Expo Go/Webは画面・ログイン・一覧等の確認用。録音には専用Android APKを使う。ブラウザでは `./scripts/phone-app.ps1 -Mode web`。API URLはpreviewビルドと同じ設定を読む。各端末のログイン情報はGit除外の `credentials/development-accounts.local.json`。2アカウントをそれぞれ使う。

このPCで起動中のExpo Goは `exp://192.168.100.37:8083`、Webは `http://localhost:8083`。QR画像は `outputs/setlog/expo-go-qr.png`。LANアドレスが変わったら起動時に表示される新しいQRを使う。

## 確認結果

- 自己確認成功：TypeScript型、UI fixture 11件、API/データ契約32件、Android/iOS/Webのバンドル、バンドル66ファイルとEAS送信ソース98ファイルの認証情報検査。
- 人工APIのブラウザ確認成功：390px/320pxでカセット画面、ログイン→録音→ルーム→日付一覧→個人記録→保存→戻る。折りたたみ状態とタブ内の遷移位置をタブ往復後に保持した。実行時ログはMetro接続断のwarning 1件、アプリerrorなし。実機でのナビゲーション/録音継続確認ではない。
- 遷移失敗を再現：React Navigationの予約パラメータ `screen` が消費され `/room/undefined` になった。動的セグメントを `view` に変更し、同じ操作で `/room/records` と個人記録・保存への遷移が成功した。
- 実API成功：承認済みのクラウドAuth2アカウントでHTTPSログイン・DB一覧取得。1秒の人工AACをprivate Storageへ送信・再取得しバイト一致、別アカウントのメタデータ/音声取得404、削除後本人410。実音声・ASR・生成の実行なし。
- 環境要因：CloudflareのQUIC接続が途中で切れ502/530。health復旧後、同じ人工記録を再開して確認と削除を完了した。APIと一時トンネルの稼働維持が必要。
- 後片付け：一般worker起動は、既存キュー/外部モデルも処理し得るとして自動承認レビューが拒否。今回の人工記録1件のinstallation_id/deleted_atを照合する限定処理に変更し、残存blobの削除とDB参照消去を確認した。一般workerは未起動で、今後の削除済み音声の物理回収には別途運用が必要。
- 未実行：実機インストール/録音、iPhone署名、相手ルーム/AI会話、実ASR/生成、独立レビュー。今回の担当によるcommit/pushなし。
