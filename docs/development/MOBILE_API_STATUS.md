# モバイル実装状況とAPI呼び出しの現状

確認日: 2026-09-12。記録ID: REVIEW-20260912-MOBILE-API。
目的: Gitで共有されているモバイルコードの量と、API呼び出しがどこまで決まっているかを整理する。新しいAPI仕様を採用する文書ではない。

## 1. 調査した版と結論

- GitHub: `jokojama-gou/opeai-hackathon`。`git ls-remote --heads origin`で最新ブランチを照会。
- mainとローカルHEAD: `04324682e9cefb0dff4d51cb6be2f7a5dfee81f0`（`react-native`）。取得済みorigin/mainとも一致。
- もう一つのリモートブランチ: `codex/aidd-lite-adoption`、`fc962c5`。内容は既存の計画資料で、最新mainに取り込まれている。
- 開始時の未コミット変更: `APP_DEVELOPMENT.md`、`WORKFLOW.md`。アプリコードの未コミット差分はなかった。
- 終了確認時には別作業によるREADME・アプリpackage.jsonの変更と` scripts/test-supabase-access.ps1`の追加も観測した。package.jsonの差分は起動を`expo start --go --lan`にするもの。追加スクリプトは管理APIの接続・SQL操作等の検査用であり、本調査では実行していない。下記のGit共有実装の評価は上記コミットを基準とする。

**共有されている実装はReact Native／Expoのスターターまで。製品画面・録音・認証・製品API接続は未実装。APIの構成案はあるが、呼び出せる製品API契約はまだない。** 別PCの未pushコードや、リポジトリ外の実装はこの結果に含まない。

## 2. モバイル用コードはどのくらいあるか

| 対象 | Git上の実体 | 実装状況 |
|---|---|---|
| 共通画面 | [App.tsx](../../apps/client/App.tsx)、48行 | 開発用の1画面。説明、実行OS表示、ボタンでカウンターを加算、見た目のスタイル |
| 起動入口 | [index.ts](../../apps/client/index.ts)、8行 | Expoの`registerRootComponent(App)`で画面を登録 |
| 依存・型設定 | [アプリpackage.json](../../apps/client/package.json)、[tsconfig.json](../../apps/client/tsconfig.json)、[ルートpackage.json](../../package.json) | Expo 57／React Native 0.86／React 19／TypeScript、npm workspaces、起動・型チェック・バンドル生成コマンド |
| アプリ・配布設定 | [app.json](../../apps/client/app.json)、[eas.json](../../apps/client/eas.json) | iOS／Android／Web設定、APK・ストア・iOS simulator等のビルドprofile。署名済み成果物の存在を意味しない |
| 素材 | `apps/client/assets/` | アイコン・スプラッシュ等のPNG 6点 |
| Swiftアプリ | 該当ソースなし | SwiftUI並行開発はロードマップ上の方針。共有GitにSwiftコードはない |
| 製品バックエンド | 該当ソースなし | FastAPI、worker、DB migration、RLS、OpenAPI、生成クライアントは未配置 |
| 製品テスト・CI | 該当ファイルなし | AIDD文書検査スクリプトはあるが製品テストではない |

アプリのTS／TSXソースは**2ファイル・計56行（空行・コメント・スタイルを含む）**。最新コミットの追加11,824行のうち11,274行は`package-lock.json`で、製品ロジックの量とは分ける。MVPの分母が未確定なため、製品完成率をパーセントでは示さない。

未実装の主要機能は、録音開始・停止・保存、会話履歴・詳細、ログイン、音声送信、処理状況取得、文字起こし、複数端末統合、参加者判定、共有制限、検索・要約・AI回答。ロードマップの`apps/mobile/`等は将来配置案で、現物は`apps/client/`にある。

## 3. 現在、本当に呼び出しているAPI

### アプリからの製品APIコール

**0箇所。** `App.tsx`のボタンは`setCount`で端末内の状態を変えるだけ。2つのソースにHTTP通信・認証・アップロードはなく、依存にもSupabase SDKやOpenAPIクライアントはない。製品APIのbase URL、環境切替、Bearer token付与、再試行なども未実装。

Expoの開発サーバーやEAS CLIの通信は開発・配布用であり、製品の会話データAPIとは別。

### 開発者向けSupabase管理API

[scripts/supabase-api.ps1](../../scripts/supabase-api.ps1)には実際のHTTP呼び出しが1箇所ある。これはPCからプロジェクトを管理する補助スクリプトで、モバイルアプリからは参照されていない。

| 項目 | コードで決まっている動作 |
|---|---|
| 実行契機 | 開発者／AIがPowerShellスクリプトを実行したとき |
| 接続先 | 固定ホスト`https://api.supabase.com`に`-Path`を連結 |
| 既定の呼び出し | `GET /v1/projects`（プロジェクト一覧） |
| メソッド | `-Method`でGET／POST／PATCH／PUT／DELETEを指定可能。既定GET |
| パス制限 | `/v1/`から始まる限定文字列のみ。`..`を拒否。リダイレクト追従なし |
| 認証 | Git対象外の`.env.supabase.local`から`SUPABASE_ACCESS_TOKEN`を読み、`Authorization: Bearer <token>`を付与 |
| 本文 | `-BodyFile`指定時、ファイルを読みJSONとして解析できるか確認し、`application/json`で送信 |
| 待ち時間 | タイムアウト30秒。自動再試行はない |
| 応答・失敗 | `Invoke-RestMethod`の結果を返す。失敗時はHTTPステータスを含む汎用エラーを返し、任意の応答本文やトークンは表示しない |

管理用PATはアプリ利用者のログイントークンではない。[利用手順](SUPABASE_ACCESS.md)に過去の一覧取得成功記録があるが、今回はスクリプトを実行せず、秘密情報も読んでいない。Supabase管理APIへの接続成功は、会話API・DB構造・認可の完成を示さない。

## 4. 製品APIはどう決める計画か

根拠は[全体ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md)の§2〜4、§7。以下は**既存の計画・提案の説明**で、採用済みのAPI仕様ではない。

1. Go君が共通API定義を取りまとめ、Mac担当がSwiftクライアントと音声workerから必要な項目を返す。
2. 最初の単位は人工データの「履歴→会話詳細」。同じ会話・閲覧者に対し、RNとSwiftで同じ許可内容を表示できる契約を先に作る案。実API採用前はローカルfixtureでもよい。
3. FastAPI／Pydanticを定義元としてOpenAPIを出力・管理する案。
4. 同じOpenAPIから、RN向けは`openapi-typescript`＋`openapi-fetch`、Swift向けはSwift OpenAPI Generator＋URLSession transportで型・通信部分を生成する案。
5. 認証は共通Supabase Auth、業務上の書き込み・共有判定は共通APIに集約する案。APIが認証トークンを検証し、クライアントが送る`user_id`だけでは権限を認めない。
6. 音声をクラウド処理する場合は、受付API→キュー→Python worker→結果保存という非同期構成案。処理場所・送信・保持はO03/O07の判断が必要。
7. 契約変更時は画面・worker・受入ケースも対応させ、互換性維持または両クライアントの同時接続確認を行う計画。

既存の契約案には、録音ID・端末ID・音声形式・開始時刻、upload ID・checksum・再試行key、処理状態`queued / processing / needs_confirmation / completed / failed`、会話ID・発言区間・根拠参照・閲覧許可区間、機械判定用エラーcodeが挙がっている。型・必須項目・JSON例・遷移条件を定めたschemaはまだない。

### まだ決まっていない具体的なコール

| 呼び出しの観点 | 現状 |
|---|---|
| base URL・APIバージョン・開発／提出環境 | 実設定なし。v1は計画上の名称 |
| 履歴取得・詳細取得のURL／HTTPメソッド | 未定義 |
| リクエスト／レスポンスJSON、ページング、日時表現 | 項目案のみ。OpenAPIファイルなし |
| 認証方式の詳細・セッション更新・期限切れの処理 | Supabase Auth候補まで。実装なし |
| 録音アップロードの宛先・形式・サイズ制限 | 未定義。録音停止後の送信を評価する案 |
| 処理開始の契機・結果取得 | 非同期処理案のみ。polling／push等、頻度・停止条件は未定義 |
| timeout・再試行・重複排除 | 再試行key・冪等性の案はあるが具体値と仕様は未定義 |
| HTTPエラーと画面状態の対応 | エラーcodeの方針案のみ。コード一覧なし |
| AIサービス・モデル・プロンプト・呼び出し条件 | 評価後に選ぶ計画。APIコールも採用モデルもない |

実装済みの`GET /v1/projects`を、製品用の履歴APIとして流用する設計にはなっていない。

## 5. API設計で維持する確定方針と注意点

[PRODUCT_CORE](../product/PRODUCT_CORE.md)のD01〜D17を確認。特にD03/D13の複数端末統合、D05〜D09/S03の会話・本人・参加区間の区別、D12/S04の通常記録と職場共有の区別、D17/S02の閲覧者別制限が関係する。C参加前の内容はC向けの要約・検索・AI回答にも含めない方針だが、コードによる実施はまだない。D14/O01/O10のMVPと品質条件、D15/O03の処理場所、O04〜O09の関連未決定を、この調査では確定していない。

P2の文書不整合: mainコミット自体に`WORKFLOW.md:9–19`と`PRODUCT_CORE.md:143–147`の競合マーカーが残っている。Gitが未解決状態を報告していなくても、本文には両側の記述がある。O02のSwift並行開発とRN／Webの記述を次の担当が片側だけ読み、方針を誤認する可能性がある。最小修正は、最新の明示決定と各変更の意図を照合して両方の内容を整理し、マーカーを除去すること。今回は調査・API説明の追加に限定し、既存方針の統合修正は行っていない。

## 6. 確認結果と限界

- 成功: リモートhead照会、ローカル履歴・追跡ファイル一覧・差分状態の確認、全アプリソースと管理スクリプトの読解、ロードマップとの机上照合。
- 証拠: 上記コミット、リンク先のコード・設定・計画、今回のGit／検索コマンド出力。過去のWeb操作・バンドル生成結果は[WORKFLOW](WORKFLOW.md)の記録であり、今回の再検証ではない。
- 未実行: アプリ起動、型チェック、実機・署名ビルド、製品APIやSupabaseへのリクエスト、AI処理。静的調査なので製品動作の成功は主張しない。独立レビューなし。
- 次の具体化対象: 既存計画の最初の単位を採用するなら、「履歴→会話詳細」の入力・出力・閲覧範囲・失敗例を契約にする。製品全体のMVP確定や音声送信の許可とは分ける。

今回の変更は本書追加とWORKFLOWへの調査記録追記。アプリコードの変更、commit・pushは行っていない。
