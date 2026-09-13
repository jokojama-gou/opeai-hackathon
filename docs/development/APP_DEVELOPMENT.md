# React Native / Web 開発環境

2026-09-13、確認済みMVP作業ツリー f461ab7 から既存スターターを選択統合。Expo、React Native、React Native Web、TypeScriptを使い、`apps/client/App.tsx`をAndroid・iOS・Webで共有する。npm workspacesでルートから操作する。

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

## スマホアプリを書き出す（EAS Build）

`apps/client/eas.json`に単体アプリのビルド設定を用意した。クラウドでネイティブアプリをコンパイルするので、WindowsからAndroid・iOS両方のビルドを依頼できる。

| ルートで実行するコマンド | 出力・用途 |
|---|---|
| `npm run build:android:apk` | Androidへ直接インストールするAPK。Expo Go・Metro不要 |
| `npm run build:android:store` | Google Play提出用AAB |
| `npm run build:ios:preview` | 登録したiPhone向けのAd Hoc署名ビルド |
| `npm run build:ios:store` | TestFlight・App Store提出用iOSビルド |
| `npm run build:ios:simulator` | macOSのiOS Simulator用アプリ。iPhoneには入れられない |

初回はリポジトリルートで次を実行する。

```sh
npm run eas:login
npm run eas:init
npm run build:android:apk
```

`eas:init`でチームのExpoアカウント／プロジェクトを選び、生成された`extra.eas.projectId`を共有する。初回ビルドの案内に従って`android.package`／`ios.bundleIdentifier`を決め、署名を設定する。未指定のアカウントやストア識別子は設定ファイルに仮固定していない。公開前にチームで識別子を確定する。

完了するとEASのビルドURLからAPK等を取得できる。AndroidではAPKを端末へダウンロードしてインストールする。iPhoneの実機ビルドにはApple Developerアカウントと署名が必要。Ad Hoc用端末は`npm run eas:device`で登録してからビルドする。ストアへの提出・公開は別作業で、上のコマンドに自動提出は含めていない。

EAS BuildはソースをExpoへ送信してビルド枠を使用する。料金・残枠は利用アカウントで確認する。リポジトリルートの`.easignore`は開発資料・AI設定・補助スクリプト・秘密情報・生成物を除外する。`credentials.json`や署名鍵はGitに含めない。EAS CLIはルートの開発依存に固定し、各コマンドは`apps/client`で実行される。

現在は設定とローカル検証まで。Expoプロジェクト連携、署名、クラウドビルド、実機インストールは別途実行が必要。`build:bundles`成功をAPK/IPA完成とは扱わない。

公式資料：[EAS Build初回設定](https://docs.expo.dev/build/setup/)、[APK作成](https://docs.expo.dev/build-reference/apk/)、[iOS内部配布](https://docs.expo.dev/build/internal-distribution/)、[monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/)。

## ファイルと依存関係

- `apps/client/App.tsx`: 共通画面。現状は環境確認用のカウンター。
- `apps/client/index.ts`: Expoのエントリーポイント。
- `apps/client/app.json`: アプリ名・プラットフォーム設定。
- `apps/client/assets/`: 公式テンプレートのアイコン。
- `package.json`: ルートの実行コマンドとNode/npm設定。
- `package-lock.json`: チームで共有する依存バージョン。再現時は`npm ci`を使う。

UIは`react-native`の`View`・`Text`・`Pressable`などで書く。WebではReact Native Webがブラウザに描画する。必要な場合は`.web.tsx`・`.native.tsx`等でOS固有部分を分離できる。

Expoと組み合わせるライブラリは、`apps/client`から`npx expo install <package>`で互換バージョンを追加する。ロックファイルはルートのものを共有する。秘密情報はコミットしない。`EXPO_PUBLIC_`付き変数はクライアントに埋め込まれるため、API秘密鍵を入れない。

## 製品実装へ進むとき

大会の参照先は[リンク集](HACKATHON_LINKS.md)。必要時のクラウド管理は[Supabase操作手順](SUPABASE_ACCESS.md)を参照する。管理APIの過去の認証成功は、製品API・ローカルSupabaseの構築や現在のPCでの成功を意味しない。

- K01/K02の人工データ・共通画面から着手する。独立Swiftアプリは作らない。
- Glass部品・録音・カレンダー・SecureStore・navigation等は未導入。該当Kで既存Expo SDKに互換の依存を追加し、root lockfileを更新する。
- 製品の権限やネイティブ設定を確認する際はexpo-dev-clientとEAS development profileを追加する。現在のpreviewは配布用でdevelopment clientではない。
- 初回はlight固定。主タブ/録音操作面のGlassと非対応環境の代替表示はMVP_SPECのUIルールに従う。

## 決定範囲

ユーザー指定のReact NativeとWeb共通開発を具体化するため、Expoのblank TypeScriptテンプレートを採用した。画面遷移が不要な段階なのでRouterは未導入。

2026-09-12の追加指定により、React Nativeを共通基盤としてiOS・Android・Webを作る。Webは、ハッカソン当日にiOS・Android版の開発が終わらなかった場合の保険として用意する。提出条件は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)で実際の大会条件と照合する。

仕様と採用状態は[MVP_SPEC](../product/MVP_SPEC.md)、残る判断は[PRODUCT_CORE](../product/PRODUCT_CORE.md)、担当・実装順は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)。MVP A/B/CとRN＋Expoは採用済み。現在の画面は製品UIではなく、録音・統合・共有・APIは未実装。確認結果は[WORKFLOW](WORKFLOW.md)を参照する。

公式資料: [create-expo-app](https://docs.expo.dev/more/create-expo/)、[Web開発](https://docs.expo.dev/workflow/web/)。
