# React Native / Web 開発環境

2026-09-12の依頼に基づく共通クライアントの開発基盤。Expo、React Native、React Native Web、TypeScriptを使い、`apps/client/App.tsx`をAndroid・iOS・Webで共有する。npm workspacesでルートから操作する。

## デモの到達点（2026-09-12ユーザー決定）

各自のiPhone・AndroidのExpo Goからアプリを開いてハッカソンのデモを行う。ストア提出、単体APK/IPAの配布は今回の到達点に含めない。既存のEAS Build設定は任意の参考として保持し、デモ準備の前提にしない。

1. 各スマホに、このプロジェクトのSDK 57に対応するExpo Goを入れる。
2. PCと各スマホを同じWi-Fiへ接続する。
3. PCのリポジトリルートで`npm start`を実行する（Expo Go・LANモード）。
4. 表示された同じQRコードを各スマホで読む。iPhoneはカメラ、AndroidはExpo Goのスキャン機能で開く。
5. 各端末に画面が出て、ボタンでカウンターが増えることを確認する。このカウンターは端末ごとに独立しており、複数端末のデータ同期は未実装。

デモ中はPC・開発サーバー・ネットワークを維持する。Expoトークンをスマホへ配る必要はない。会場Wi-Fiが端末間通信を禁止する場合は、自分たちのルーター等の利用可能なネットワークを用意する。代替のTunnel方式は`apps/client`で`npx expo start --go --tunnel`（初回はngrok用依存の導入が必要な場合がある）。Tunnelは外部中継とインターネット接続に依存し、今回は未導入・未検証。

Expo Goに含まれない独自ネイティブ機能が必要になった時だけ、Expo Goでの代替可否とdevelopment buildの必要性を再検討する。今回の設定で録音・バックグラウンド動作・近距離通信の実現性まで確認したものではない。

参考：[Expo公式の実機起動手順](https://docs.expo.dev/get-started/start-developing/)。複数スマホでの動作は端末接続後に確認する。

## セットアップと起動

Node.js 22.20.0、npm 10.9.0を使用する。Volta利用時はルートの設定で切り替わる。nvm利用時は`.nvmrc`を参照する。

リポジトリルートで実行する。

```sh
npm ci
npm run web
```

表示されるlocalhostのURLを開く。画面の「動作確認 +1」で回数が増えることを確認する。`apps/client/App.tsx`を保存すると開発サーバーが変更を反映する。

スマホで確認する場合:

```sh
npm start
```

ターミナルのQRコードを、このExpo SDKに対応するExpo Goで開く。PCとスマホは同一ネットワークを使用し、必要に応じてOSのファイアウォールで開発サーバーの通信を許可する。Expo Goの対応版は[公式案内](https://expo.dev/go)を確認する。

| コマンド | 用途 |
|---|---|
| `npm run web` | Web開発サーバー |
| `npm start` | スマホ向けの開発サーバー・QRコード |
| `npm run android` | 起動済みAndroidエミュレーター等で開く |
| `npm run ios` | macOSのiOS Simulatorで開く |
| `npm run typecheck` | TypeScriptの型チェック |
| `npm run doctor` | Expo設定・依存の整合性チェック |
| `npm run build:web` | Webを`apps/client/dist`に出力 |
| `npm run build:bundles` | Android・iOS・Webの配信用バンドルを出力 |

`build:bundles`はAPK/IPAの作成や実機テストではない。WindowsではiOS Simulatorを実行できない。Androidエミュレーターを使う場合はAndroid StudioとSDK・仮想端末が別途必要。独自ネイティブ機能を追加する際はExpo development buildと必要なビルド環境を整える。

## 任意の参考：スマホアプリを書き出す（EAS Build）

`apps/client/eas.json`に単体アプリのビルド設定を用意した。クラウドでネイティブアプリをコンパイルするので、WindowsからAndroid・iOS両方のビルドを依頼できる。

| ルートで実行するコマンド | 出力・用途 |
|---|---|
| `npm run build:android:apk` | Androidへ直接インストールするAPK。Expo Go・Metro不要 |
| `npm run build:android:store` | Google Play提出用AAB |
| `npm run build:ios:preview` | 登録したiPhone向けのAd Hoc署名ビルド |
| `npm run build:ios:store` | TestFlight・App Store提出用iOSビルド |
| `npm run build:ios:simulator` | macOSのiOS Simulator用アプリ。iPhoneには入れられない |

このリポジトリは2026-09-12にExpoプロジェクトへ連携済み（下記参照）。このPCではトークン用ラッパーから実行できる。別アカウントの新規アプリを初期化する場合のみ、次の手順を使う。

```sh
npm run eas:login
npm run eas:init
npm run build:android:apk
```

`eas:init`でチームのExpoアカウント／プロジェクトを選び、生成された`extra.eas.projectId`を共有する。初回ビルドの案内に従って`android.package`／`ios.bundleIdentifier`を決め、署名を設定する。未指定のアカウントやストア識別子は設定ファイルに仮固定していない。公開前にチームで識別子を確定する。

完了するとEASのビルドURLからAPK等を取得できる。AndroidではAPKを端末へダウンロードしてインストールする。iPhoneの実機ビルドにはApple Developerアカウントと署名が必要。Ad Hoc用端末は`npm run eas:device`で登録してからビルドする。ストアへの提出・公開は別作業で、上のコマンドに自動提出は含めていない。

EAS BuildはソースをExpoへ送信してビルド枠を使用する。料金・残枠は利用アカウントで確認する。リポジトリルートの`.easignore`は開発資料・AI設定・補助スクリプト・秘密情報・生成物を除外する。`credentials.json`や署名鍵はGitに含めない。EAS CLIはルートの開発依存に固定し、各コマンドは`apps/client`で実行される。

Expoプロジェクト連携は完了。署名、クラウドビルド、実機インストールは未実行。Expo Goのデモにこれらは不要。`build:bundles`成功をAPK/IPA完成とは扱わない。

公式資料：[EAS Build初回設定](https://docs.expo.dev/build/setup/)、[APK作成](https://docs.expo.dev/build-reference/apk/)、[iOS内部配布](https://docs.expo.dev/build/internal-distribution/)、[monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/)。

## AI IDEのExpoトークン認証

2026-09-12セットアップ済み：[Expoプロジェクト](https://expo.dev/accounts/yokoyamago/projects/hackathon-client)。所有者は`yokoyamago`、slugは`hackathon-client`、projectIdは`143962b8-7d31-413d-9b43-74ea32106cff`。`apps/client/app.json`へ反映済み。EAS CLIは`eas.json`でも24.3.0に固定。

このPCのPowerShellでは、ルートから次で認証・連携を確認できる。

```powershell
& ./scripts/expo.ps1 whoami
& ./scripts/expo.ps1 project:info
```

ラッパーは保存済みトークンを読み、`apps/client`からローカルEAS CLIを実行した後、環境変数を元に戻す。Expo Goの起動は従来どおり`npm start`。

ユーザー提供のトークンはルートの`.env.expo.local`に`EXPO_TOKEN`として保存している。GitとEAS送信から除外済み。OneDrive配下なので同期設定は別途適用される。内容は表示せず、アプリに埋め込まない。

PowerShellでEASを実行する際は、そのプロセスだけに読み込む。トークン方式では`eas login`は不要。

```powershell
$previousExpoToken = $env:EXPO_TOKEN
try {
    $env:EXPO_TOKEN = ([IO.File]::ReadAllText((Join-Path (Get-Location) '.env.expo.local')).Trim() -split '=', 2)[1]
    & ./node_modules/.bin/eas.cmd whoami
    # 上のコマンドを、現在の依頼で必要なEASコマンドに置き換える。
} finally {
    $env:EXPO_TOKEN = $previousExpoToken
}
```

トークン保持は任意の変更・公開への包括的な許可ではない。操作範囲は現在の依頼で定める。Expo以外のストア認証・署名は別途必要。[公式のトークン仕様](https://docs.expo.dev/accounts/programmatic-access/)。

## ファイルと依存関係

- `apps/client/App.tsx`: 共通画面。現状は環境確認用のカウンター。
- `apps/client/index.ts`: Expoのエントリーポイント。
- `apps/client/app.json`: アプリ名・プラットフォーム設定。
- `apps/client/assets/`: 公式テンプレートのアイコン。
- `package.json`: ルートの実行コマンドとNode/npm設定。
- `package-lock.json`: チームで共有する依存バージョン。再現時は`npm ci`を使う。

UIは`react-native`の`View`・`Text`・`Pressable`などで書く。WebではReact Native Webがブラウザに描画する。必要な場合は`.web.tsx`・`.native.tsx`等でOS固有部分を分離できる。

Expoと組み合わせるライブラリは、`apps/client`から`npx expo install <package>`で互換バージョンを追加する。ロックファイルはルートのものを共有する。秘密情報はコミットしない。`EXPO_PUBLIC_`付き変数はクライアントに埋め込まれるため、API秘密鍵を入れない。

## 決定範囲

ユーザー指定のReact NativeとWeb共通開発を具体化するため、Expoのblank TypeScriptテンプレートを採用した。画面遷移が不要な段階なのでRouterは未導入。

2026-09-12の追加指定により、React Nativeを共通基盤としてiOS・Android・Webを作る。Webは、ハッカソン当日にiOS・Android版の開発が終わらなかった場合の保険として用意する。大会の参照資料は[ハッカソンのリンク集](HACKATHON_LINKS.md)にまとめる。

関連はPRODUCT_COREのO02（対応先と開発基盤）とD14/D15。対象端末の詳細・OSバージョン・プラットフォーム間の機能差・Webで代替する範囲、MVP、録音・統合・共有・バックエンド・音声処理場所は未決定のまま。現在の画面は製品UIではない。実測結果は[WORKFLOW](WORKFLOW.md)の2026-09-12開発環境記録を参照する。

公式資料: [create-expo-app](https://docs.expo.dev/more/create-expo/)、[Web開発](https://docs.expo.dev/workflow/web/)。
