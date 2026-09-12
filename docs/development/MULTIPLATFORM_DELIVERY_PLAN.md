# React Native主軸・Swift並行開発の全体計画

最新の実装に渡す仕様は[MVP_SPEC 2.0](../product/MVP_SPEC.md)。M01〜M14/U01〜U15、共通契約、受入条件43件、K01〜K10に本書を同期した。採用状態は仕様書に従い、担当・提出方針は維持する。

作成日: 2026-09-12。状態: Mac担当の依頼者・Windows担当のGo君に向けたロードマップ。開発・提出方針はユーザー決定、下記の作業分割は今回の計画。MVP・処理方式の未決定は維持。この文書更新では製品実装・環境導入・外部送信・公開を行っていない。

2026-09-12・最新の作業順: K01から基盤K02〜K06、K09→K10→K08、全体判定K07へ接続する。依存は§7とMVP_SPEC §11。旧T01〜T09や音声探索への分岐を現在の手順にしない。追加録音・全文採点・既存録音再評価・認識環境再構築は再開しない。

## 1. 決まった方針と計画の前提

- ユーザー決定: React NativeでAndroid・iPhoneに対応するアプリを第一に開発する。SwiftによるiPhoneアプリも並行して検討・開発し、ハッカソンに間に合えばSwift版、難しければReact Native版を提出する。
- 計画上の解釈: Swift版は独立したSwiftUIクライアント。Swift採用時もAndroidはReact Native版を維持する。React Nativeもネイティブアプリであり、比較はReact Native版とSwift版で行う。
- 前の会話の意向: Web版を保険にする。専用の第三プロジェクトを一から作らず、ExpoのWeb出力で共通画面を早期に動かす案を推奨する。
- 仕様根拠: [PRODUCT_CORE](../product/PRODUCT_CORE.md)のD01〜D17、S01〜S05、O01〜O10。今回具体化したのはO02の開発方針。音声処理場所O03、照合・本人帰属O04、近距離通信O06、保持O07、MVPと品質基準O01/O10は別判断。
- 2026-09-12ユーザー決定: 依頼者本人（以下「あなた」）がMacでSwiftUI、Go君がWindowsでReact Nativeを開発する。各人の稼働時間、提出日時、大会条件、Xcode/署名/開発用実機の準備状況は未確認。Macの有無や開発者のOSを再質問しない。検証用のiPhone 16／Pixel 8は既存資料で確認済みだが、開発用配布の成立とは分ける。
- このロードマップで具体化するのは担当範囲・受け渡し・進行順と観測可能な完了条件。クラウド構成、期限割合、最初の製品画面・機能範囲は提案であり、MVP確定や外部音声処理の許可にはしない。Go君の稼働時間や作業完了を本人確認済みとは扱わない。
- 適用FWは[採用済みAIDD-Lite](../decisions/AIDD_FW_ADOPTION.md)。本書は技術構成と実装ロードマップ、[開発開始ガイド](aidd-lite/DEVELOPMENT_START.md)は作業入口、[音声検証計画](AUDIO_VALIDATION_PLAN.md)は検証手順、[WORKFLOW](WORKFLOW.md)は最新状態を担当する。同じ手順・採点規則を本書へ複製しない。

## 2. MVP 2.0の開発構成

方式の定義元は[MVP_SPEC §9](../product/MVP_SPEC.md#9-実装方式データ契約推奨案)。ローカルSupabase（Auth/PostgreSQL/非公開Storage）＋FastAPI＋Python workerを推奨し、Windows側のAPI/ASRへRNとSwiftを同じ明示設定のHTTPS接続先でつなぐ。MacにASR環境を重複構築しない。構成の採用・導入・実行は未実施。

処理は「RN/Swift → 共通APIの認証・区間認可 → DB/非公開Storageと永続job → workerの個別ASR → 許可内文字・出典だけ生成adapterへ → 出典/manifest/権限版検査 → 閲覧者別結果」の順。

共通化するのは認証・データ・API・処理・権限判定・デザイン規則・人工ケース。SwiftUIは独立クライアントでTSXは共有しない。端末録音とログインセッションはRN/Swift間で自動移行しない。アプリ識別子・redirectを分け、提出切替は新規デモ開始前に行う。

## 3. 技術の扱いと実行条件

- RNはExpo/TypeScript、SwiftはSwiftUI。録音・保存、認証、ASR/生成候補と形式上限は仕様書§9に従い、数値やモデルを別定義しない。
- 初期jobはPostgreSQLとworkerのleaseで処理する。Supabase Queues/Renderは後続候補であり初期着手の前提にしない。§11の一次資料は過去の候補検討の出典として保持する。
- 統合adapterとG1〜G5の共通runnerは§15に従う。G4は決定的なコード、生成モデルは共通adapterに閉じる。開発AIのサブエージェントとは別の概念。
- 実adapter接続前に送信対象・処理先・保持・モデル版・費用上限・認証/HTTPS設定を具体化する。実行上限/冪等性は§15.5、外部カレンダーの作用は§14を適用する。
- バージョン・導入コマンドは着手時に実環境で確認して固定する。方式の提案を導入済みとしない。自動発見/BLEは初回対象にしない。

## 4. API・データ契約の先行設計

Go君が契約を取りまとめ、あなたがSwift/workerの適合を確認する。K01は指定schemaと4fixtureから始め、実API段階ではFastAPI/PydanticからOpenAPIを管理する。JSON schemaとOpenAPIで同じ型の意味が食い違わないよう確認する。

- Source/Conversation/Match/共有snapshot・jobは§9、予定候補・bindingは§14、ContextView/evidence group/manifest・ToDo/保存/確認項目/日次は§15を詳細参照元にする。
- 正常結果だけでなく401/404/409/422/429、失効本文なし、旧版の再確認、再送/二重操作を担当Kのfixtureに含める。
- APIが現在の認可を判定する。個人の根拠はU03、共有はU06/U07。生成入力全体のmanifest、件数・キャッシュ・遅着jobまで同じ制約を適用する。
- ToDo/保存の本人編集・採用で根拠の期限や共有取消を無効にしない。外部保存された予定コピーは§14で別に扱う。

API変更はschema/fixture/両クライアント/workerの影響を一つの作業で示す。型生成・decode成功だけで認可や製品動作の成功としない。
## 5. 推奨するリポジトリ構成

以下は将来の配置案で、今回はディレクトリや製品コードを作成しない。

```text
apps/mobile/          Expo：Android・iPhone・限定Web
apps/ios-swift/       SwiftUIの独立iPhoneアプリ
services/backend/    FastAPIと共通ドメイン、workerの別起動入口
packages/api-ts/     OpenAPIから生成したTypeScript型・クライアント
packages/ios-core/   必要になった場合だけRN/Swift間で再利用するSwift package
contracts/           OpenAPI出力、人工データ、エラー契約
design/              tokens.json、画面見本、状態別文言
supabase/            DB migration・RLS・Storage policy・job設定
tests/contracts/     同じケースをAPIと各クライアントで確認する素材
```

Swift package共通化は録音/通信の独自実装が本当に必要な場合だけ行う。expo-audioと同じ機能を先に作り直さない。API/DBは一系統、画面は二系統として管理する。

## 6. デザイン方針と最初の範囲案

UIデザインはユーザー決定によりGo君が担当する。あなたは共通デザインをSwiftUIで実装し、iOS固有の制約や操作上の調整をGo君へ返す。OSごとに画面全体を別デザインにする必要はない。

| 対象 | 共通にする部分／調整する部分 |
| --- | --- |
| 共通デザイン | 色、余白、文字階層、アイコン素材、カード、画面の情報構造、録音・処理・共有の状態表現をGo君が管理する |
| iOS／Androidの操作 | 戻る操作・ジェスチャー、ナビゲーション、sheet・共有メニュー、キーボード、safe area、権限ダイアログとの接続を各OSに合わせる。標準部品で吸収できる範囲も実機で確認する |
| RNのiOS／Android | UIコードを原則共通化し、必要な差だけPlatformや.ios/.androidファイルへ分ける。Windowsで開発してもAndroid専用の見た目になるわけではない |
| RN／SwiftUI | デザイン仕様・素材・API契約は共有するが、RNのTSXをSwiftUIへそのまま流用はできない。あなたがSwiftUIのViewとして別実装する |
| Web | 共通デザインを使い、ブラウザ幅・ポインター／キーボード操作を調整する。録音等の機能制約は本節末尾のWeb保険案に従う |

RNの分岐方法は[公式のPlatform-Specific Code](https://reactnative.dev/docs/platform-specific-code)を参照。まず履歴・会話詳細の一組をGo君のデザインから両実装へ展開し、文字拡大と各OSの戻る操作まで確認してから画面数を増やす。

共通の色・余白・角丸・文字階層・状態名を先に決め、まずU01→U06→U07で比較し、3主タブ「今日・記録・保存」とU01〜U15へ段階的に展開する。仕様上必要な状態を先に揃え、その後にSwiftUIの標準ナビゲーション・sheet・触覚等を調整する。Swift版の見た目だけを優先し、録音/共有の状態を省略しない。

RN版も提出品質のデザインを作る。Swift版を作ること自体が品質向上の証明ではない。大きな文字、VoiceOver/TalkBack、暗色表示、録音中の可読性、片手操作を確認する。Androidはブランド表現を揃えつつ戻る操作等の慣習に合わせる。

完成体験はMVP_SPEC §3/§10に従う。本人開始→保存→持ち寄りと確認→共有と統合→根拠/訂正→ToDo/予定/保存→日次振り返り。K02の操作デモと全体完成を分ける。グループ実画面・自動発見・全文/意味検索・同じ録音の一時停止/再開は後続で、確定した権限方針は維持する。

Webの保険案は、許可された音声のファイル取込、履歴、共有確認、統合結果閲覧。ブラウザ録音は対応確認後の追加。背景録音・BLEの同等性は約束しない。手動で入力組を指定するデモを採用する場合、自動候補発見が未実装と明示し、ユーザーが妥協範囲を選ぶ。

## 7. Mac・Windowsの開発ロードマップ

### 今回の担当と編集境界

役職を固定するものではなく、このロードマップの仕事を割り当てる。担当者のOSがサーバーの実行OSや処理先を決めるわけではない。

| 仕事 | 主担当 | 受け渡すもの・協力範囲 |
|---|---|---|
| RNのAndroid/iPhone、限定Web | Go君／Windows | 同じAPI契約を使う画面・録音・保存・再試行。あなたはRNのiPhone実機・Xcode調査を支援 |
| SwiftUIのiPhone | あなた／Mac | 同じデモのSwiftクライアント。UI仕上げはRNの提出可能状態を損なわない時間枠で行う |
| 共通API、認証、DB、ジョブ受付、権限制御 | Go君 | API契約、認可テスト、migration、job状態。RNの一つの操作からAPI・DBまで通す単位で実装 |
| 個別ASR・統合・生成・clip処理ワーカー | あなた | K03のASR adapterと正規化・Source生成、K05/K06/K10の契約・処理実装。Go君へ同じコード版と起動条件を渡し、Windowsでの接続結果を受け取る。API/DB変更はGo君へ要求する |
| 共通デザイン・状態別の表示案 | Go君 | U01〜U15と3主タブの状態別見本、文字・色・余白の規則。あなたはSwiftUIへ反映し、iOSの制約をGo君へ共有 |
| API定義・処理job契約の取りまとめ | Go君 | Pydantic/OpenAPIの定義元を一つに保つ。あなたはSwift生成・ワーカー入出力から適合を確認 |
| iOS署名・配布、提出比較 | あなた | RN/Swift両方のiOS起動・配布結果。Go君はAndroidとWebを確認 |

先の配置案を採用する場合、Go君はapps/mobile、design、services/backendのAPI/domain、packages/api-ts、contracts、supabaseを主に編集し、あなたはapps/ios-swift、services/backendのworker/processingを主に編集する。共通設定・依存ファイル・DB定義・WORKFLOWはその作業の担当者一人が編集する。配置はまだ製品コードとして存在せず、API/domainとworker/processingの具体的な境界は着手する単位で定める。

共通処理が未成立の間、あなたの優先順位は共通処理の契約・実装→RNのiPhone支援→SwiftUIの追加演出。Go君はRNの一操作と必要なAPIを一緒に仕上げ、RN全画面とAPI全機能を同時に抱えない。手が足りなければSwift固有の新機能・Web固有機能を止め、主軸の未達項目へ時間を戻す。

### 順序と完了条件

チケット定義は[MVP_SPEC §11](../product/MVP_SPEC.md#11-実装順と最初のチケット)。番号順に直列化せず、依存関係で進める。日程は稼働・提出条件が判明してから置く。

| 段階・依存 | Go君 / Windows | あなた / Mac | 完了条件 |
|---|---|---|---|
| K01（A採用後） | schema、4fixture、期待表示 | Swift適合確認 | duplicate/conflict/pending/expiredの受理・拒否とID/版/範囲が一致 |
| K02（K01・RN起動依存の採用後） | RNのU01→U06→U07とデザイン | SwiftUIで同じ操作 | AC06/07/15の表示部分。人工デモと明示 |
| K03（B・実機条件） | RN/APIの録音・保存・送信、WindowsでASR workerの起動・API接続確認 | Swift録音、RN iPhone支援、ASR adapter・正規化・Source生成の実装と受け渡し | U02/U03、AC01/02/14。入力metadata→job→SourceとASR状態、失敗/再送/上限の結果が両画面へ反映される |
| K04（K01・BのAuth/DB） | snapshot・認可とRN | SwiftのU04/U05/U09 | AC03/04/09〜12/16/19。未回答・再確認・取消・継続 |
| K05（K01/K04・生成条件） | API接続とjob状態、確認済みMatchからContextView/根拠group・範囲被覆を確定 | 統合adapter/G1の根拠付き結果を共通契約でAPIへ返す | AC05/06、出典・再送・公開前版検査 |
| K06（K03〜K05） | 認可・訂正・指摘API/RN | clip処理とSwift | AC07/08/13/17/18。原音・訂正・指摘解決・取消競合 |
| K09（K01/K04、UIはK02から） | 今日・ToDo・保存/メモ・確認API/RN | U12〜U15のSwift | 人工G2/G4出力で本人操作と権限/版/期限をAPIまで確認 |
| K10（K05/K09・目的別許可） | runner/API接続・日次選択 | G2/G3/G5生成とG4コード | A01〜A15。manifest・日付・重複・失効・再試行/費用上限 |
| K08（K05/K10のG3実生成後） | Google executor/API/RN | SwiftのU10/U11・OS経路 | C01〜C09。人工UIはK09と並行可、実登録は条件成立後 |
| K07（全機能接続後） | RN Android/iPhone、APIの証拠 | Swift/iPhone、workerと配布の証拠 | AC01〜19/C01〜09/A01〜15、通しデモ、RN候補→Swift切替 |

K03のASR受け渡しは、あなたがコード版・入出力契約・起動条件をGo君へ渡し、Go君がWindows側の実行版・job/Source・成功/失敗の証拠を返す。Macは人工入出力でadapter契約を確認でき、ASR環境を重複構築しない。実音声経路は許可された実装検証の条件成立後に確認し、人工状態だけではASR接続完了にしない。旧探索の再評価・環境再構築を自動再開する指示ではない。

K01/K02とK09の画面準備は実音声・外部登録に依存しない。K10のG4はモデルを呼ばない。MVPの生成機能と開発AIへの委任を混同しない。

### 採用判断と未達時の扱い

A/B/Cの採否は仕様書§1とWORKFLOWへ記録する。旧Q1〜Q3の未回答を同意にせず、担当・OSは再質問しない。実装依頼と採用状態を開始時に照合する。

- 出典不正・権限漏れ・目的別許可不足は該当公開/送信を止め、担当Kで修正して同じ条件を再確認する。
- 統合・帰属/参加確認が未達なら不明/保留を維持し、MVP_SPEC §12の限界と修正点を報告する。旧音声探索へ自動で戻らない。
- 生成失敗・費用未設定/上限到達は§15.5で停止/再試行する。有効な本文と独立操作を維持し、無限生成や予算変更で通過させない。
- 実行条件や配布が未成立なら独立した人工契約/画面を進め、依存する実接続だけ未実行とする。
- 工数不足ならSwift演出/Web追加よりRNと共通基盤を優先する。M09〜M14を見本で済ませて2.0完成とせず、範囲変更はユーザー判断を記録する。

### 二人と各AIの受け渡し

[開発開始ガイド§4](aidd-lite/DEVELOPMENT_START.md#4-一つの作業を進めるサイクル)に従い、K・M/U/受入ID、仕様/契約/fixture版、差分、実行条件、証拠、残件を渡す。

Go君はAPI/DB契約を取りまとめ、あなたはSwift/workerの適合結果を返す。共有ファイルは一人が編集し、別checkout/作業ブランチの対象版を明示する。相手で同じ入力を試した証拠が揃うまで両PC確認済みとしない。API変更は互換性を保つか、両画面とworkerを同時に接続確認する。

各AIへの準備依頼は[開発開始ガイド§6](aidd-lite/DEVELOPMENT_START.md#6-各aiへ渡す最初の依頼例)に一本化する。共有資料はAGENTS、PRODUCT_CORE、MVP_SPEC 2.0、WORKFLOW、本書、DEVELOPMENT_START。画面担当は15画面見本、必要に応じGUIDE/VALIDATIONを参照する。旧音声資料は必要な過去証拠だけ参照する。

共有前に必要ファイルが受け渡す版に含まれるか確認する。未コミット・未追跡資料は相手のpullに含まれない。音声・転記・特徴量・秘密情報は共有Gitへ入れない。今回の資料更新では相手への送信やcommit/pushを実施していない。
## 8. 提出版の切替基準

最終判断は経過80%までを推奨。ただし大会の提出締切、署名・審査・配布の締切が早ければ、その前に置く。外部TestFlightは審査があるため最後に初回配布しない [15]。

Swiftを選ぶ条件（すべて満たす案）:

1. 選定済みのデモ必須機能がRN版と同じ範囲で動き、模擬部分は両版とも明示されている。
2. Swift/iPhone＋RN/Androidで独立録音から統合・共有、ToDo/予定/保存、別会話を含む日次・根拠まで通る。AC01〜19/C01〜09/A01〜15の結果を揃える。
3. 今回許可・継続許可・未回答・途中参加・グループ閲覧等、採用範囲の権限ケースが同じ期待結果になる。iPhoneのUIだけで共有条件を緩めない。
4. ロック、着信等の中断、オフライン停止、再送、重複操作の選んだケースを確認し、保存失敗を成功表示しない。
5. 実際の提出・デモ端末へ署名済みアプリを配布できる。SwiftとRNの認証redirectが混線しない。
6. 初期状態をリセットしたデモを異なる入力で3回通す（少数回の提出準備確認であり品質保証ではない）。録音内容の採用・処理条件を満たす。
7. デザイン・操作感を比較し、RN提出候補を置き換えるだけの利点がある。

Swift不合格ならRN版を提出し、Android対応も維持する。Swift合格ならiPhone側はSwift、Android側はRNを使う方針で提出形式を大会条件に合わせる。RNも未達なら「Webなら完成」とはしない。Webの採用範囲・大会条件・実際の完成度を確認し、縮小提出か説明用デモかをユーザーが選ぶ。共通AI/APIが未完成の場合は全クライアントに影響する。

## 9. 検証・費用・運用

- CI: APIの認証・区間権限・遅着・重複処理をpytestで確認。OpenAPI生成差分とTS/Swiftクライアントのコンパイル、人工ケースの整合を確認。RNはJest、SwiftはSwift Testing/XCTest、操作はMaestroまたはXCUITest。各5分以内の録音・中断・保存とOSカレンダーは実機で確認する。長時間・BLEは初回範囲へ追加しない。
- 混在確認: RN Android↔RN iPhone、RN Android↔Swift iPhone、必要時RN iPhone↔Swift iPhone。機種・OS・ビルド・入力ID・条件を記録する。1台のiPhoneに2アプリを入れただけでは2台同時録音の代替にならない。
- ログ: recording/job/requestの匿名ID、処理時間、状態遷移、エラーコードを残す。音声・全文転記・トークンを通常ログに出さない。初期はホストの構造化ログを用い、追加監視SDKは必要時に検討する。
- 費用枠: Apple開発者登録、必要ならGoogle Play登録、EASビルド、MacまたはmacOS CI、Supabase容量・転送、API/常駐ワーカー、AIの音声分数と文字量を別項目で見積もる。最新料金と無料枠は採用時確認。録音2台分の入力、再処理、保持期間が費用に効く。定額・無料を保証しない。
- 現行の実験音声条件を製品クラウド送信許可へ読み替えない。[VALIDATION](VALIDATION.md)の条件を守り、O03/O07が決まるまでは人工データで準備する。
- 当日: 使用するバイナリとバックエンド版を記録し、ネットワーク・認証・配布経路を事前確認。必要な公開・送信は別途ユーザーの明示範囲で行う。

## 10. 次に必要になる判断

| 判断 | 推奨・不足情報 | 必要な時点 |
|---|---|---|
| 日程・準備 | 提出日時、各人の稼働時間、Xcode/署名/開発用配布の状態。あなた=Mac、Go君=Windowsは決定済み | 担当は§7で具体化済み。日付・時間枠と配布方式の確定前 |
| 大会条件 | 公式URLと提出形式。事前開発・指定AI/クラウド・複数アプリ提出条件を確認 | 外部サービス選定・提出準備前 |
| 処理・保持 O03/O07 | MVP_SPEC §9/§15のローカル構成・目的別生成許可と§14の予定送信条件を具体化 | 実音声の外部処理と保存実装前 |
| MVP O01/O10 | MVP_SPEC 2.0のA/B/C、全43受入条件と実処理/模擬の範囲を判断 | 両クライアントの機能範囲固定前 |
| 本人帰属・発見 O04/O06 | 仕様書§3/§7の手動持ち寄り・帰属/参加確認を具体化。自動発見/BLEは後続 | K04の確認・認可実装前 |

この計画は開発の依存関係を示す。未決定を理由に画面・API人工契約・ビルド準備の独立作業まで停止する必要はない。一方、期限の経過やモデル出力を人間の判断の代用にはしない。

## 11. 一次資料（2026-09-12確認）

- [1] [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/?buildenv=build-with-eas): 任意OSからのクラウドiOSビルドとネイティブ開発環境の違い。
- [2] [Expo Web](https://docs.expo.dev/workflow/web/): Web出力とReact Native for Web。
- [3] [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/): 録音・背景録音・キャッシュ保存の注意。
- [4] [Expo Modules API](https://docs.expo.dev/modules/overview/): Swift/Kotlin拡張。
- [5] [Apple AVAudioSession record](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/record): 背景録音・中断の条件。
- [6] [Supabase Swift SDK](https://github.com/supabase/supabase-swift)、[Expo連携](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native): 両クライアント向けSDK。
- [7] [FastAPI Features](https://fastapi.tiangolo.com/features/): OpenAPI・Pydantic。
- [8] [openapi-typescript](https://openapi-ts.dev/introduction): TypeScript型生成。
- [9] [Swift OpenAPI Generator](https://www.swift.org/blog/introducing-swift-openapi-generator/): Swiftクライアント生成。
- [10] [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control): データ・ファイルのアクセス制御。
- [11] [Supabase Queues](https://supabase.com/docs/guides/queues): Postgresベースの永続キュー。
- [12] [Render Service Types](https://render.com/docs/service-types)、[Background Workers](https://render.com/docs/background-workers): API・worker・静的Webの配置候補。
- [13] [Expo UI Universal](https://docs.expo.dev/versions/latest/sdk/ui/universal/): OS/Web別に部品を実装する共通API。
- [14] [Expo Unit Testing](https://docs.expo.dev/develop/unit-testing/)、[Maestro](https://docs.expo.dev/eas/workflows/examples/e2e-tests/): テスト構成。
- [15] [Apple TestFlight](https://developer.apple.com/testflight/): 外部配布前の審査。
- [16] [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx): Peripheral／スマホ同士通信の非対応。

## 12. 今回の成果と限界

2026-09-12、MVP_SPEC 2.0に構成・担当・K01〜K10の依存・受け渡し・完成判定を同期。文書整合と参照先の点検であり、採用・製品実装・実機/実API/外部登録の成功は更新していない。確認結果はWORKFLOWを参照。
