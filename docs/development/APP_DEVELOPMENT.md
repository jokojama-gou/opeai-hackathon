# React Native / Web 開発環境

2026-09-13、確認済みMVP作業ツリー f461ab7 から既存スターターを選択統合。Expo、React Native、React Native Web、TypeScriptを使い、`apps/client/App.tsx`をAndroid・iOS・Webで共有する。npm workspacesでルートから操作する。

## デモの到達点（2026-09-12ユーザー決定）

各自のiPhone・AndroidのExpo Goからアプリを開いてハッカソンのデモを行う。ストア提出、単体APK/IPAの配布は今回の到達点に含めない。既存のEAS Build設定は任意の参考として保持し、デモ準備の前提にしない。

1. 各スマホに、このプロジェクトのSDK 57に対応するExpo Goを入れる。
2. PCと各スマホを同じWi-Fiへ接続する。
3. PCのリポジトリルートで`npm start`を実行する（Expo Go・LANモード）。
4. 表示された同じQRコードを各スマホで読む。iPhoneはカメラ、AndroidはExpo Goのスキャン機能で開く。
5. 各端末に人工データの操作デモが出て、画面遷移を操作できることを確認する。これは実ASRや複数端末統合の成功確認ではない。

デモ中はPC・開発サーバー・ネットワークを維持する。Expoトークンをスマホへ配る必要はない。会場Wi-Fiが端末間通信を禁止する場合は、自分たちのルーター等の利用可能なネットワークを用意する。代替のTunnel方式は`apps/client`で`npx expo start --go --tunnel`（初回はngrok用依存の導入が必要な場合がある）。Tunnelは外部中継とインターネット接続に依存し、今回は未導入・未検証。

現在の録音adapterは専用development buildを必要とし、Expo Goでは録音を開始しない。Expo Goは人工画面の確認に使う。録音・バックグラウンド動作・近距離通信の実機検証とは区別する。

参考：[Expo公式の実機起動手順](https://docs.expo.dev/get-started/start-developing/)。複数スマホでの動作は端末接続後に確認する。

## セットアップと起動

Node.js 22.20.0、npm 10.9.3を使用する。Volta利用時はルートの設定で切り替わる。nvm利用時は`.nvmrc`を参照する。

リポジトリルートで実行する。

```sh
npm ci
npm run web
```

表示されるlocalhostのURLを開く。開発ビルドは「今日」から始まる人工データの操作デモ。記録→会話→元の記録、保存/メモ、ToDo採用、期限切れの表示を操作できる。デモの変更はメモリ内だけで、再読込すると戻る。実音声・実AIは呼ばない。Windowsでは `./scripts/dev.ps1 web` でも起動でき、このPCに用意したGit除外済みNodeキャッシュがあれば利用する。

<a id="ui-study"></a>
### U01/U06/U07のUI検討モック（K02準備）

開発時の人工デモ上部で「UI検討モックを開く（K02準備）」を選ぶ。`__DEV__`だけの入口であり、製品の初回起動先「今日」U12を変更しない。モックを閉じると人工デモへ戻る。製品ビルドは従来どおりAPIモードから始まる。表示はRN＋Expoの共通部品、状態とデータはすべて人工の検討用。保存・共有・取消・訂正・指摘・録音・再生・APIの成功は返さない。

1. 左のパネルで18状態を切替。狭い画面では「状態・配色を比較する」を開き、状態を選ぶと画面案へ戻る。
2. U01の個人行はU03の宛先確認、共有行はU06へ。「会話の整理」の根拠から対象発言を開き、「元の記録」でU07へ。シートを閉じると本文の位置を保つ。
3. U07で自分の入力は「文字を訂正」→U08、他者入力は「気になる点を伝える」→指摘の仮画面。ID/版/文字範囲は開発用の仮画面で確認する。本文内には開発IDを表示しない。
4. U07上部の検討パネルで読込・失敗・出典なし・版更新・音声期限・文字期限・閲覧不可・通信断を比較する。再試行や原音再生を押しても成功に戻さない。版更新後は閉じたU06の旧本文も伏せる。元の人工例へ戻すには検討パネルから明示的にケースを選び直す。
5. 案A（青）/案B（深緑）を同じ状態で比較する。明色・本文16以上・操作領域48以上を基準とし、具体色/余白/配置は未採用の案。Glassは未導入で、採用仕様の通常面を表示する。本文/出典へ透過効果は付けていない。

| 比較する状態 | 表示・操作の具体化 |
|---|---|
| 通常/重複 | 出典2件の対応発言、片側発言、別時点の同文反復を保持。個人18:30→共有14:10の順 |
| 相違/不明 | 土曜・日曜の両原文。話者不明と順序不明を独立表示し、位置不明は別枠。時刻nullでは原音再生不可 |
| 共有未回答 | 自分の記録の待機行→U03。U06の検討入口も無効。相手の本文・録音日時・派生タイトルはなし |
| 統合の確認待ち | 時間対応/人物/範囲変更を別例にし、本文なし→U04。「持ち寄りをやめる」はU03宛先の確認のみで取消未実行 |
| 確認期限切れ | 原音も期限に達した例。再申請不可を説明してU03へ。個人記録の削除扱いにしない |
| 原音期限/文字期限/共有失効 | 原音だけなら文字を残す。文字期限/共有失効はタイトル・本文・整理・出典を伏せる。本人期限410と権限外/不存在404の文言を分ける |
| 空/読込/失敗 | U01の空・フィルタ0件と解除。U06の0件は空表示の比較案だけで、正式な統合状態との対応付けは未定義。読込/失敗を成功扱いにしない。U07の出典なしは取得不可表示 |
| 機能別生成/失敗 | 整理・ToDo・予定の各状態を表示し、有効な本文は読める。ToDo上限超過は再試行不可。候補の実生成ではない |
| 版更新/通信・権限確認不可 | U06/U07の取得済み旧本文も伏せる。再取得の未接続を説明し、旧版への成功fallbackなし |

実装先は[操作モック](../../apps/client/src/screens/UiStudy.tsx)、[UI検討用データ](../../apps/client/src/data/ui-study.ts)、[仮画面の宛先](../../apps/client/src/navigation/ui-study.ts)、[表示部品/配色案](../../apps/client/src/ui/StudyPrimitives.tsx)。データ版は`ui-study-20260913`、閲覧主体`ui-self`、判定時刻`2026-09-13T12:00:00Z`固定。実音声由来の文言は使わず、Unicode code point範囲を確認する絵文字を含む。公開JSON/schema/サーバーenumではなく、K01受領後の共有fixtureへ置き換える前の検討用repositoryである。

人工データと宛先の不変条件はルートで次を実行する。正式K01契約、API認可、RN実機のテストではない。

```sh
npm run verify:ui
```

モック復元のための依存追加はない。mainのpackage-lock.jsonに記録された依存の導入が必要。iOSの実Glass/透明度低減、OS文字拡大、VoiceOver/TalkBack、録音・原音切替/停止、実APIは未検証。採用仕様と後段条件は[MVP_SPECのUIルール](../product/MVP_SPEC.md#ui-rules)と[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md#readiness)、今回の検証範囲は[WORKFLOW](WORKFLOW.md)を参照する。

スマホで確認する場合:

```sh
npm start
```

ターミナルのQRコードを、このExpo SDKに対応するExpo Goで開くと人工画面を確認できる。録音はバックグラウンド設定・バックアップ除外を含む専用development buildが必要で、Expo Goでは開始しない。PCとスマホは同一ネットワークを使用する。Expo Goの対応版は[公式案内](https://expo.dev/go)を確認する。

| コマンド | 用途 |
|---|---|
| `npm run web` | Web開発サーバー |
| `npm start` | スマホ向けの開発サーバー・QRコード |
| `npm run android` | 起動済みAndroidエミュレーター等で開く |
| `npm run ios` | macOSのiOS Simulatorで開く |
| `npm run typecheck` | TypeScriptの型チェック |
| `npm test` | 人工契約・APIクライアント・画面用データ処理のテスト |
| `npm run contracts:generate` | JSON schema/4 fixture/共通TypeScript型の再生成 |
| `npm run doctor` | Expo設定・依存の整合性チェック |
| `npm run build:web` | Webを`apps/client/dist`に出力 |
| `npm run build:bundles` | Android・iOS・Webの配信用バンドルを出力 |

`build:bundles`はAPK/IPAの作成や実機テストではない。WindowsではiOS Simulatorを実行できない。Androidエミュレーターを使う場合はAndroid StudioとSDK・仮想端末が別途必要。独自ネイティブ機能を追加する際はExpo development buildと必要なビルド環境を整える。

<a id="verification"></a>
## 変更後の検証入口

AIは完了報告前に、今回変更した内容に該当する対象を下表から選び、リポジトリルートで実行する。複数にまたがる場合は併用し、他の人の既存差分だけを理由に無関係な対象を増やさない。対象が分からない場合は `npm run verify` で現在登録されている全ローカル確認を実行する。

| 今回の変更 | コマンド | 実行する確認 |
|---|---|---|
| 文書・AGENTS・Skill・画面見本の参照 | `npm run verify:docs` | ローカル文書/アンカーの参照とAIDD-Liteのmetadata |
| RN共通UI・UI用データ・遷移・型 | `npm run verify:ui` | クライアントの型チェックとUI試作用データ/遷移テスト |
| 旧共有操作プロトタイプの状態処理 | `npm run verify -- prototype docs` | 旧試作の状態テストと文書確認。製品の共有認可テストではない |
| 検証スクリプト・検証用package scripts | `npm run verify -- tooling docs` | 検証入口と文書検査の自己テスト、文書/Skill確認 |
| 認証情報の保管・Git除外・漏出検査 | `npm run verify:security` | 追跡候補の秘密情報検査と、人工キーによる暗号化/改ざん/実行時処理/配布物検査 |
| 共通契約・APIクライアント・製品画面用データ | `npm run verify -- contracts`（または `npm test`） | mainのTypeScript契約・クライアント・データテスト |
| UIと文書の両方 | `npm run verify -- ui docs` | 重複を除いて両方を実行 |

入口は[scripts/verify.mjs](../../scripts/verify.mjs)。対象未指定または `all` は上表の全確認、`--help` は使い方を表示する。追加依存・ネットワーク通信・CI設定は不要で、Node.jsとPowerShell 7（`pwsh`）、UI対象では導入済みの開発依存を使う。型チェックはクライアントの `typecheck` と同じTypeScript・引数を直接起動する。コマンドや新しいテストを追加・変更した場合は、この入口と対応表も更新する。

各確認のPASS/FAIL/UNAVAILABLEと集計を表示し、スクリプトは一つでも失敗・起動不能・タイムアウト（各確認120秒）なら終了コード1を返す。対象名の誤記は、確認を開始せず終了コード2を返す。npm経由の終了コードはnpmの版により変わるため、呼出側は非0を失敗として扱う。失敗後も他の選択済み確認を実行する。AIは依頼範囲で原因調査→修正→関連確認の再実行を進め、必要な確認が失敗・未実行・実施不能の成果は完了と報告しない。対象指定は変更に基づいて選び、失敗した確認を外して成功扱いにしない。

これはAIが変更後に起動するローカルの実行入口で、常駐監視ではない。認証情報の検査と保管テストはGitHub Actionsでもpush/PR時に実行するが、全ローカル確認の代替ではない。既存のUIテストはデータ/宛先の検査であり、見た目・タップ・戻る操作はブラウザ等で別途確認する。実機・実API・実音声・ビルドの必要性は該当Kの受入条件から選び、未登録の将来機能をこのコマンドだけで検証済みにしない。

## スマホアプリを書き出す（EAS Build）

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

- `apps/client/App.tsx`: 人工デモ/APIモードの入口。製品ビルドはAPIモードから始まる。
- `apps/client/src/screens/`: 共通画面。Demo系とLive系を明示的に分ける。
- `apps/client/src/platform/audio/`: iOS/Androidの録音・保存。Webは録音を開始しない。
- `apps/client/src/data/`: fixture repository、認証、API処理状態。通信失敗をfixture成功へ切り替えない。
- `contracts/` / `packages/api-ts/`: schema、人工データ、生成型、APIクライアント。
- `services/backend/` / `supabase/`: FastAPI/worker、非公開保存のDB migration。
- `apps/client/index.ts`: Expoのエントリーポイント。
- `apps/client/app.json`: アプリ名・プラットフォーム設定。
- `apps/client/assets/`: 公式テンプレートのアイコン。
- `package.json`: ルートの実行コマンドとNode/npm設定。
- `package-lock.json`: チームで共有する依存バージョン。再現時は`npm ci`を使う。

UIは`react-native`の`View`・`Text`・`Pressable`などで書く。WebではReact Native Webがブラウザに描画する。必要な場合は`.web.tsx`・`.native.tsx`等でOS固有部分を分離できる。

Expoと組み合わせるライブラリは、`apps/client`から`npx expo install <package>`で互換バージョンを追加する。ロックファイルはルートのものを共有する。秘密情報はコミットしない。`EXPO_PUBLIC_`付き変数はクライアントに埋め込まれるため、API秘密鍵を入れない。

## 製品実装へ進むとき

大会の参照先は[リンク集](HACKATHON_LINKS.md)。必要時のクラウド管理は[Supabase操作手順](SUPABASE_ACCESS.md)を参照する。管理APIの過去の認証成功は、製品API・ローカルSupabaseの構築や現在のPCでの成功を意味しない。

- Glass、expo-audio、FileSystem、SecureStore、Network、SafeArea、expo-system-uiを導入済み。カレンダーadapterは未実装。
- development profileとexpo-dev-clientを追加済み。録音保存先のバックアップ除外はconfig pluginで設定し、iOSでは起動時の設定成功を確認できない場合に録音を開始しない。OS上の実効性は実機で検証する。
- 初回はlight固定。主タブ/録音操作面は対応iOSでGlass、非対応環境と透明度低減設定では通常面を使う。実機の文字拡大・読み上げ・OSの戻るは未検証。

音声処理は[MVP_SPEC §9](../product/MVP_SPEC.md#contracts)の外部API構成を採用する。FastAPI・非公開Storage/PostgreSQL adapter・単一入力のASR worker境界と、個人Context/G1/G2/G5生成・ToDo/日次APIを追加した。外部ASRの具体adapter、正規化/チャンク分割、2入力統合・共有Context、G3/G4は残る。Expoの起動だけでは書き起こせない。生成adapterも接続/保持/予算の明示設定まで無効。バックエンドの依存・起動・人工テストは[backend README](../../services/backend/README.md)を参照する。

実機接続は `apps/client/.env.example` を参考に `EXPO_PUBLIC_API_URL` を設定し、設定画面でAPIモードへ切り替える。スマホは証明書を検証できる明示的なHTTPS接続先が必要。開発PC自身のWeb検証に限りloopback HTTPを許す。Supabase用の秘密鍵やASRキーをクライアントのenvへ入れない。ログインにはチームが用意したアカウントを使い、画面から新規アカウントを作る機能はない。

プロバイダの認証情報の準備は[credentialsの手順](../../credentials/README.md)を参照する。実接続時はworker側で読み込み、クライアント公開変数やアプリ配布物へ入れない。キー取得と認証確認、許可済み音声による書き起こし成功は別々に記録する。接続先/モデル・分割設定・保持条件・呼出/費用上限の確認項目は[ロードマップのK03前提](MULTIPLATFORM_DELIVERY_PLAN.md#runtime-prerequisites)から辿る。

## 決定範囲

ユーザー指定のReact NativeとWeb共通開発を具体化するため、Expoのblank TypeScriptテンプレートを採用した。今回の画面遷移はReact stateとModalで実装し、Routerは未導入。実機のOS戻る・画面復帰の受入は残る。

2026-09-12の追加指定により、React Nativeを共通基盤としてiOS・Android・Webを作る。Webは、ハッカソン当日にiOS・Android版の開発が終わらなかった場合の保険として用意する。提出条件は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)で実際の大会条件と照合する。

仕様と採用状態は[MVP_SPEC](../product/MVP_SPEC.md)、残る判断は[PRODUCT_CORE](../product/PRODUCT_CORE.md)、担当・実装順は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)。MVP A/B/CとRN＋Expoは採用済み。現状は操作デモと実機接続用の実装途中のアプリ。全43条件の合格・スマホ実動作は未確認。確認結果と残実装は[WORKFLOW](WORKFLOW.md)を参照する。

公式資料: [create-expo-app](https://docs.expo.dev/more/create-expo/)、[Web開発](https://docs.expo.dev/workflow/web/)。

## 復元・統合後の注意

認証情報は[Windows暗号化保管庫](../../credentials/README.md)へ移管する。`npm run verify:security`で追跡対象・人工キーの保管処理を検査し、`npm run security:hooks`でこのクローンのcommit/push検査を有効にする。実キーはアプリ/デモ/型検査には渡さない。

[復元・統合記録](RESTORE_INTEGRATION_20260915.md)に89ファイルの扱いと仕様・実装の差を記録する。`verify`の全確認は登録済みの文書・UI・契約・試作・tooling・認証情報の確認。Python backend、実機、実APIは別検証である。
