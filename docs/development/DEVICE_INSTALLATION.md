# 当日端末へのインストール

2026-09-15の本人回答：iPhoneとAndroidを1台ずつ、Macを利用可能、Apple Developer Programの有料会員なし。製品はRN＋Expoの共通コード。iPhoneはMac/Xcodeの無料Personal Team、Androidはdevelopment APKを使う。これは手順の準備で、端末へのインストール成功記録ではない。

## 開発用とデモ用

| 用途 | iPhone | Android |
|---|---|---|
| 開発・録音の実機確認 | Macでdevelopment buildを署名・直接インストール。Metroへ接続 | EASのdevelopment APK、またはAndroid Studioのローカルbuild。Metroへ接続 |
| デモ用の単体起動 | Mac/XcodeでRelease構成を実機へ直接インストールし、Metro停止後にも起動確認 | EASのpreview APKを入れ、Metro停止後にも起動確認 |

Expo Goは今回の実録音の確認には使わない。製品の録音adapterが専用development build・バックアップ除外等を要求する。JavaScript/TypeScriptだけの変更は既存development buildで更新できるが、ネイティブ依存、plugin、app.json等を変えたら再ビルドする。単体起動できても、認証・ASR・AIを使うAPIとworkerは別途稼働が必要。

## iPhone：無料アカウント＋Mac/Xcode

1. Macに対応するXcodeを導入し、初回起動のコンポーネント設定を完了する。実機のiOS版がそのXcodeでサポートされることを確認する。Node 22.20.0/npm 10.9.3と、このリポジトリの同じ版を用意する。
2. XcodeのSettings → Accountsで本人のApple Accountにサインインする。有料会員がなければPersonal Teamを使用する。認証コード・パスワードをGitやチャットへ保存しない。
3. iPhoneをUSBでMacに接続し、本人が「このコンピュータを信頼」を許可する。iPhoneの設定 → プライバシーとセキュリティ → デベロッパモードを有効にし、再起動と確認を行う。項目が出なければ先にXcodeとペアリングする。
4. リポジトリルートで `npm ci`。`apps/client/.env.local` に `EXPO_PUBLIC_API_URL` として稼働中のHTTPS APIを設定する。スマホから見たlocalhostはスマホ自身なので使わない。APIキーやDB秘密鍵は入れない。
5. `apps/client` で `npx expo prebuild --platform ios`。生成された `ios` 配下の `.xcworkspace` をXcodeで開く。初回は上書きするネイティブ編集がないことを確認する。既存の変更を消す `--clean` は手順の既定にしない。
6. アプリtarget → Signing & CapabilitiesでAutomatically manage signingを有効にし、Personal Teamを選ぶ。重複しない `ios.bundleIdentifier` をチームで決めてapp.jsonにも反映する。表示名や参考構成名Setlogをそのまま識別子に決めつけない。
7. 実行先に接続中のiPhoneを選び、Runする。署名・信頼の追加案内が出たら本人が確認する。Expo側からは `npx expo run:ios --device` でもビルド・インストールできる。
8. 開発中はリポジトリルートで `npm run start -- --dev-client --lan` を実行し、同じLAN上のdevelopment buildから接続する。会場LANで端末間通信が制限される場合は、自分たちのテザリング等の接続経路を確認する。
9. デモ候補は `apps/client` で `npx expo run:ios --device --configuration Release`、またはXcodeのRun構成をReleaseにして実機へ入れる。Metroを終了して、アプリの起動・APIログイン・録音保存まで確認する。無料署名で利用できる機能と実機動作の成立はこの確認で判断する。

無料Personal Teamのプロビジョニングは7日で期限切れになり、再ビルド・再インストールが必要。登録上限はApp ID 10件、端末3台、端末あたりアプリ3つ。EASクラウドからiPhone実機へAd Hoc配布する経路には有料会員が必要なので、今回の無料経路はMacで直接ビルドする。TestFlightやApp Storeの一般配布とは別。

## Android：開発用APKとデモ用APK

1. Expoアカウントでログインし、チームが使うプロジェクトを選ぶ。既存のリポジトリルートの `npm run eas:login` / `npm run eas:init` を使える。プロジェクト作成・ソースのクラウド送信・利用枠は実行前に対象を確認する。
2. `apps/client/app.json` の `android.package` をチームで決める。生成される `extra.eas.projectId` と合わせ、仮値を固定しない。API接続先をビルド時に渡す。`.easignore` がローカルenvを除外するため、EAS側の環境にも `EXPO_PUBLIC_API_URL` を明示する。公開API URLだけを使い、秘密鍵を入れない。
3. 開発用は `apps/client` で `npx eas build --platform android --profile development`。完成後のビルドURLを対象Androidで開き、APKを取得してインストールする。OSの案内に従い、そのダウンロード元からのインストールを本人が許可する。Play Storeへの提出は不要。
4. リポジトリルートの `npm run start -- --dev-client --lan` へ接続する。開発用APKはPCのMetroから画面コードを読み込む。
5. デモ用はルートの `npm run build:android:apk`（preview profile）。完成APKを入れ、Metroを止めて起動・ログイン・録音保存を確認する。`build:android:store` はAABを作るので、直接入れるAPKの代わりにしない。

クラウドビルドを使わない場合、Android Studio・SDK・JDKを用意し、USBデバッグを許可した端末へ `apps/client` の `npx expo run:android --device` で直接インストールできる。今回はそのネイティブツールチェーンの導入・動作確認はまだしていない。

## 2台を同じAPIへ接続する

両方のアプリに同じHTTPS API URLを設定し、別々の開発アカウントでログインする。ログイン確認→各端末の録音開始/停止/保存→送信→結果→共有→AI会話の順で確認する。APIの `/health` 成功だけでDB/Auth/音声送信/ASRの成功にしない。仮URLが変わったときは両端末の設定とビルドへの反映を確認する。

このWindows側の[接続設定・アカウントの所在・再起動手順](LOCAL_CONNECTION_PREP.md)を用意した。開発版では人工デモからAPIモードへ切り替える。Release/previewはAPIモードで起動する。ASR/統合/AI会話は未接続のため、現時点で上の通し確認を完了できる状態ではない。

## 公式資料

- [Expo：development buildとローカル作成](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo：ローカル実機ビルドとRelease構成](https://docs.expo.dev/guides/local-app-development/)
- [Apple：無料Personal Teamと期限・上限](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Expo：内部配布とiOS Ad Hoc](https://docs.expo.dev/build/internal-distribution/)
- [Expo：Android APK](https://docs.expo.dev/build-reference/apk/)

2026-09-15に公式文書を確認。アカウントや端末の操作は本人の実確認を要する。
