# 現在地と引き継ぎ

2026-09-15。方針は[PRODUCT_CORE](../product/PRODUCT_CORE.md)、採用仕様は[MVP_SPEC](../product/MVP_SPEC.md)、担当・依存・K定義は[ロードマップ](MULTIPLATFORM_DELIVERY_PLAN.md#tasks)。

## 現在の状態

### 全変更のPR集約と認証履歴の除去（2026-09-15）

- 依頼/範囲：ユーザーの「全てをPR,マージして」に対応。復元89ファイル、UI検討モック、仕様・発表準備、Setlogの実フォント/見本/画像とDREAM TAPE、認証保管・検査・CIをまとめる。以下の「commit/pushなし」は各作業時点の履歴として残す。
- 保持：集約前277ファイルをリポジトリ外へ退避し、履歴更新後のバイト一致を確認。元の退避stashと、他の作業ブランチ/作業ツリーは保持。
- 認証情報：[履歴除去の結果](CREDENTIAL_STORAGE_20260915.md)。GitHubのmainは旧SHA一致を条件に `4ecab1d → 30d2147` へ更新。認証情報以外の内容は一致。ローカルも同じ履歴へ移し、無関係な復旧データ13件を保持して認証履歴由来16オブジェクトだけを除去した。APIキーは本人専用の暗号化保管庫にそのまま保持する。
- 検証：Node 22.20.0の全登録10検査・57テスト、型・文書/参照・metadataが成功。保管庫の整合性、実キーを使うローカル履歴検査も成功。CIとマージの結果は対象PRのchecks/merge記録を参照する。
- 製品の残件：仕様に合わせた同意経路の実装修正、ASRの具体adapter/チャンクと2入力統合などは継続。実機・実API・実録音・新規配布buildの完了をこのPRで示すものではない。

### Cのカセットを夢のある見た目へ発展（2026-09-15）

- 依頼/段階：ユーザーがCを選択し、夢やワクワクする要素の追加を指定。対象版 `4ecab1d`。M01/U02の画像検討に限定し、既存差分を保持。
- 成果：[C / DREAM TAPEの画像と生成指示](../product/prototypes/setlog-ui/recording-dream-tape-v1/README.md)。Setlog基調を保ち、透明なカセット内の星・雲・朝焼け・乳白のリールと光の軌道を表現した。左が待機、右が録音中のPNG1枚。Cの方向は選択済み、今回の具体表現は提案段階。
- 制作/自己確認：内蔵imagegenで旧Cを編集。1536×1024、原本と保存コピーのSHA-256一致、状態・操作・日本語・残り時間なしを目視確認。書体指定はKosugi Maru 400／Noto Sans JP 600の画像上の近似。旧C画像は保持し、一覧と3案比較資料に選択結果を反映した。
- 確認：`npm run verify:docs` は2/2成功（65文書・764参照、管理metadata16件）。対象差分と新規文書の空白検査が成功。保護5ファイルのSHA-256が一致。既存WORKFLOWの一致検査は並行する保管修正の確認結果1行が更新されたため不一致となり、行差分を確認してその更新を保持した。画像提案のため動作実装・実操作・実機・効果測定は対象外。アプリコード・公開API／型・既存MVP仕様・動く見本は変更せず、commit/pushなし。

### APIキーを維持した保管修正（2026-09-15）

- 依頼/範囲：現在のキーを変えずに保管を強化。既存の復元変更・Setlog画像/動く見本の更新を保持。実API・音声・課金は実行しない。
- 成果：[保管修正と履歴除去の結果](CREDENTIAL_STORAGE_20260915.md)。2認証ファイルを本人専用のWindows DPAPI保管庫へ移管し、復号後のバイト一致を確認。平文のGit追跡を解除して作業ツリーから除去。gitignore・検査・hook・CI・利用手順を更新した。
- 確認：関連6検査、保管/秘密情報検査7テスト、検証入口7テストが成功。実キーの変更なし。除去案の6コミットは認証情報以外の全ファイルが一致し、他のブランチ/PR参照は不変。
- 後続の承認で完了：GitHubのmainの6コミットを書き換えるpushと、ローカルの古い認証履歴の整理。上のPR集約記録を参照する。GitHubのキャッシュや他のコピーの完全消去までは確認できない。

### Setlog基調の録音画面を画像3案で比較（2026-09-15）

- 依頼/段階：録音を触りたくなる見た目として複数の画像案を提案し、追加指示「setlogのデザインは基調にして」を反映。対象版 `4ecab1d`。既存差分を保持する。M01/U02の見た目の検討であり、採用仕様や動作実装の変更ではない。
- 成果：[現在の比較案v2と生成指示](../product/prototypes/setlog-ui/recording-pop-concepts-v2/README.md)。白・淡いミント・丸い操作を共通に、Aゼリー、B真珠色のリング、C小さなカセットを各2状態で制作。Aを推奨するが3案とも未採用。先行案v1の3画像も履歴として残す。
- 制作/自己確認：内蔵imagegenを使用。既存Setlog画像を見た目の基準、動く見本の待機画像を配置の基準、先行案を中央物体の素材参照にした。最終PNG各1536×1024、保存コピーのSHA-256一致、2状態・経過時間・停止操作・残り時間なしを確認。本文Kosugi Maru 400／見出しNoto Sans JP 600を指定した画像上の近似であり、実フォントによる組版ではない。
- 確認：`npm run verify:docs` は2/2成功（63文書・750参照、管理metadata16件）。対象の `git diff --check` と新規文書の空白検査が成功。開始時の保護8ファイルのSHA-256と既存WORKFLOW履歴が一致。静止画の提案なので、実操作・実機・実録音・効果測定は対象外。アプリコード・公開API／型・既存MVP仕様・動く見本は変更せず、commit/pushなし。

### Setlog案の録音を「声でゆれる立体」の動く見本へ（2026-09-15）

- 依頼/段階：ユーザー承認済みの演出計画を、疑似音量の独立した見本として実装・ブラウザ確認。対象版 `4ecab1d`。復元・統合中の既存差分を保持する。M01/U02の状態表現とSetlog案の録音起点を扱い、製品APIには接続しない。
- 成果：[動く見本と起動手順・画像](../product/prototypes/setlog-ui/recording-motion-v1/README.md)。白・ミント・ラベンダーのSVG立体、押下の反応、疑似音量3段階、保存時のカードへの変化、失敗・中断・5分停止、ルームからの録音帯を実装。本文Kosugi Maru 400／見出しNoto Sans JP 600を同梱フォントで描画。既存画像v1/v2から別ファイルに分離した。
- 自己確認：開始→停止→保存→再開始、連打、失敗→再試行、中断、共通帯、時刻移動後の05:00自動停止が成功。390px／320pxと文字200%で横はみ出しなし、Enterキーで開始・停止・保存まで確認。動き低減とOS設定エミュレーションで静止、疑似音量による変形差を確認。検証用表示変更は解除し、見本は待機へ戻す。
- 通信/実行境界：localhostのHTMLと実フォント2件だけの通信を観測。マイク・音声取得・保存・再生・API呼出なし。ブラウザ警告/エラーなし。描画フレーム観測はこのPC上の結果で、実機性能保証ではない。
- 文書・保持：`npm run verify:docs` は2/2成功（61文書・731参照、管理metadata16件）。新規ソースの構文と空白、対象差分を確認。開始時との比較で対象外253ファイルと既存WORKFLOW履歴が一致。復元台帳JSON1件は開始後の変化を検出したため、その変更を編集せず保持。代表状態のJPEG3枚を保存。アプリコード・公開API／型・既存MVP仕様は変更せず、commit/pushなし。

### main取り込み後の退避変更を復元・統合（2026-09-15）

- 依頼/段階：最新編集を保持して退避89ファイルを復元・統合。基準版 `4ecab1d`、同期後の11件の編集を保存・照合。
- 成果：[統合記録と89ファイルの一覧](RESTORE_INTEGRATION_20260915.md)。Setlog構成・実フォント・見本・画像v1とv2、UI検討モック、発表準備、検証入口を現行リポジトリ内に整理した。先行記録の「バックアップ側のみ」という所在は、その記録時点の状態。現在は元のファイル位置から参照できる。
- 仕様：MVP_SPEC 2.3/PRODUCT_CORE 0.8へ統合。同意を設けない明示決定を復元し、mainのASR分割等を保持。既存API/worker/画面の同意前提は[未対応事項](RESTORE_INTEGRATION_20260915.md#implementation-gaps)として明記。
- 検証：Node 22.20.0で登録8/8（50テスト・型・文書・metadata等）が成功。発表準備も含む69文書731参照を確認。UIモックの開閉と実フォント/画像表示、修正後のWebエラー解消をブラウザーで確認。対象外164ファイルのSHA-256と新しい編集を保持。詳細と実機等の未検証範囲は統合記録を参照。
- 範囲外：同意経路の実装修正、実録音・実API・実機、コミット・push。退避stashとバックアップは保持。

### Setlog案の画面画像をv2へ更新（2026-09-15）

- 依頼/段階：「変更があった分の画像のページは作り直して」に対応した画像制作。対象は `codex/rn-expo-parallel-handoff` / HEAD `4ecab1d`。本文・見出しの書体変更が全8画面に関わるため、既存2ボードをそれぞれv2として再生成した。
- 成果：[画面画像と生成指示](../product/prototypes/setlog-ui/README.md)をSetlog専用フォルダへ保存。[一覧整理メモ](../product/SETLOG_RECORDS_LIST.md)から参照する。03を今日3件の2行一覧・過去の日付の折りたたみに変更し、07/08の架空の確認対象を同じ08:40の記録へ統一。追加指示で05の残り時間表示を削除し、経過時間と停止操作を維持。本文Kosugi Maru 400・見出しNoto Sans JP 600を指定したが、生成画像の字形は近似であり実フォント組版の保証ではない。
- 制作/保持：内蔵imagegenで旧版画像を編集。元のv1画像は同期バックアップに保持し、既存MVPの画面と混在させない。許可範囲・自分のみ・本人対応1件と相手待ちの区別を維持した。検索・ピン留め等は追加していない。
- 自己確認：2ボードの日本語・一覧3件・本人対応1件・一覧から確認対象への整合・2:05以内の範囲00:20〜01:50を目視確認。残り時間の非表示も確認。生成原本と保存PNG2件のSHA-256一致、各1536×1024、文書参照53文書・438件、対象差分と新規Markdownの空白検査、旧画像を含む既存11ファイルのSHA-256とWORKFLOW既存履歴の保持を確認。
- 対象外：アプリコード・公開API／型・既存MVP仕様の変更、実アプリの操作・文字拡大・実機・実API・実録音の検証。commit/pushなし。

### Setlog案の個人記録一覧は日付整理とコンパクト表示を優先（2026-09-15）

- 依頼/段階：一覧が大量になった場合の提案に対し、ユーザーが「①②を優先でよい」と指定。設計方針の反映のみ。対象は `codex/rn-expo-parallel-handoff` / HEAD `4ecab1d`。既存のPRODUCT_CORE・本書・名称候補資料の差分を保持する。
- 決定/成果：[Setlog案の一覧整理](../product/SETLOG_RECORDS_LIST.md)を独立した設計メモに保存。日付別・新しい順、今日を開き過去の日付を件数付きで折りたたむ。記録は時刻・記録名、録音時間・自分のみ・状態の1〜2行を基本にし、要約や全文は詳細へ。文字拡大時は行数を固定しない。M01/M14・U01/U03の入口と状態の意味を保持する。
- 資料の所在：先行するSETLOG_UI_STRUCTURE 1.3と見本は、同期バックアップ `repo-sync-backups/opeai-hackathon-2026-09-14T16-27-08-712Z/original` 側にあり、現作業ツリーにはない。先行資料の本文・書体・共有条件を照合し、バックアップは変更せず今回の追加方針だけを現行フォルダへ保存した。既存MVP_SPECへ混在させない。
- 確認：`node scripts/check-docs.mjs` は52文書・431ローカル参照/使用アンカーで成功。対象の `git diff --check` と新規文書の末尾空白確認は成功。既存仕様・製品方針・名称候補等9ファイルのSHA-256と既存WORKFLOW履歴が一致した。主担当の文書確認であり、アプリ表示の動作証拠ではない。
- 範囲外：ピン留め・新しい検索・確認待ちフィルタ・フォルダ/タグ・AI分類は今回採用しない。画像再生成、アプリコード、公開API／型、実機・実API・実録音の検証は未実施。commit/pushなし。


**名称・アイコン候補を2案に限定して保留（2026-09-15）**

- 依頼/段階：添付のFolday F4とVoicemark V1のみを記録し、ユーザーが後で決めるための資料保存。対象版は `70e936a`。PRODUCT_COREと本書の既存差分を保持する。
- 決定/成果：[保留候補](../product/brand-shortlist/README.md)に2案だけを登録し、[比較ページ](../product/brand-shortlist/index.html)では選ばれた図柄だけを表示。Foldayは今回の添付PNG、Voicemarkは元ボードのV1部分を参照。原画像を再生成せず保存し、候補IDとSHA-256を同梱した。製品名・デザインは未採用。
- 確認：原画像2件のSHA-256一致、候補が2件で採用未決定であること、表示範囲が画像内であること、保存資料のローカル参照9件、`git diff --check`が成功。`npm run verify:docs`は現行package.jsonにスクリプトがなく実行不能のため、今回の参照を個別確認した。ブラウザでの実表示は未検証。
- 残件：ユーザーによる最終選定。ほかの案は現在の候補に含めない。アプリ実装・commit/pushなし。

- 個人の生成・ToDo・日次を追加（2026-09-14〜15）：ユーザーの「このほか実装すべきところを実装して」に対し、主担当がK09/K10・M10/M11（M12のメモ非送信）・U03/U12/U13・§15/A02/03/05/06/08/10/11/13/14/15の個人入力部分を実装・人工検証。開始版 `a8ab85d` / main、開始時差分なし。変更は未コミット。採用仕様の変更、Go君の作業受領、実APIの利用許可取得ではない。
  - 実装：個人ContextViewと全生成入力のmanifest、G1/G2/G5 runner、ToDoの本人採用/編集/完了/戻す/削除/再確認、タイムゾーンと日次の選択/生成/失効API。引用していない背景Sourceも依存に含む。ToDoの再確認でIDと完了状態を保持。11候補は全件非公開、日次11件以上は自動選択しない。個人メモを生成へ渡さない。
  - 実装：LiveAppの「今日」「ToDo」、個人記録の整理/候補、根拠の現在版確認、生成同意の追加/取消、失敗/上限/再試行表示。文字が有効なら原音の7日期限後にも生成同意を変更できる。画面は通信断/背景化で消去し、復帰時・表示中15秒ごと・期限時に再検査。別端末変更のpush通知は未実装。
  - 実装：採用済みResponses API用の `openai_generation.py`。modelは設定差替え可、例は `gpt-5-mini`。構造化出力・toolなし・store false・切詰めなし・timeout/応答量制限。backend専用の明示設定が全部揃うまで無効。全worker同時2件、本人queued最大10、全員共通の予約予算台帳、各round最大2呼出・手動retry1round、結果不明は再送なし。保持/予算値・実キーは今回設定していない。予約額と実請求額の照合は未実装で、実費保証ではない。
  - 共通契約：追加response modelから `contracts/derived-v1.schema.json` とOpenAPIを出力し、共通TS型を生成。端末でも失効応答への本文混入を拒否する。再生成手順は[backend README](../../services/backend/README.md)と[contracts README](../../contracts/README.md)。全MVP契約の完成とはしない。
  - 自己確認成功：Python API/worker/HTTP代替 **57件**、TS契約/クライアント **28件**、型チェック、OpenAPI/schema/TS型再生成。ToDo本文遮断/同ID再確認、同意取消中の遅着結果拒否、期限後の本文なし状態、同時2件・4呼出上限、HTTP500/timeout/拒否/不正根拠の非公開、日またぎ・zone変更・対象変更・11件選択を含む。独立レビューではない。Python依存由来のdeprecation warning 2件あり。
  - バンドル成功：Web（737KB）、iOS/Android Hermes（各約2MB）。配信用6ファイルの既知キー値混入検査成功。APK/IPA・ネイティブコンパイル・実機・実ASR/実生成の品質確認ではない。
  - 文書・差分の確認成功：49文書416ローカル参照/使用アンカー、`git diff --check`。最終修正後もPython 57件を再確認して成功。
  - 失敗と修正：sandboxの `npm test` はNodeの `uv_os_get_passwd / ENOMEM` で起動失敗。通常環境で同じ28テスト成功。Pythonの初回失敗1件はTestClientのDELETE呼出方法を修正し成功。同意と最新retryはDB列挙順に依存しないよう版で固定した。
  - ブラウザ確認は未完：人工専用loopback API＋別Web（8001/8082）を起動し、390×844でAPIログイン画面まで確認。HTTPのhealth/CORS preflight/人工ログインは成功したが、in-app browserのログインは結果不明。診断toolが約48分応答せず通信の証拠を取得できなかった。LiveのToDo/日次操作成功とはしない。検証プロセス2本とタブを終了し、viewportを戻した。再開手順はbackend README。既存8081の人工デモと混同しない。
  - 残る実装：K03の具体ASR/チャンク、K05の時間対応/統合・共有Context被覆/同一化、認可clip・指摘API、G3/G4とカレンダー、G1/G2の確定/訂正イベントからの自動起動、当日保存/確認点を含むToday全体、3人/グループ境界、画面の戻り位置・実機受入。現在のContextは個人だけで、対応Matchのある記録は二重生成を避けて保留する。**今回の追加をMVP全体やスマホの完成とはしない。**
  - 実行待ち：Supabase/2アカウント/HTTPS/ffprobe、ASR選定・入力/保持/予算、生成の実保持/予算設定、Expo署名・実端末。外部モデル呼出・実音声・公開・課金・commit/push・独立レビューは未実行。次はローカルAPIとLive画面の実接続を確認し、K03/K05へ接続する。

- 共通画面・API基盤の開発（2026-09-14）：ユーザーの「君が開発すすめられるのはすべてすすめて」を受け、主担当が契約・UI・端末adapter・API/workerを実装。基準版 `0591ef0` / main、開始時差分なし。今回の差分は未コミット。他者の選定結果・別PCの実装を受領済みとはしない。**実装は進んだが、スマホ＋実ASRの通し動作とMVP全体は未完成。**
  - K01/K02：`contracts/` に4人工fixture・7状態、JSON schema、受理/拒否テスト、`packages/api-ts/` に生成TS型・HTTPS/APIクライアントを追加。`apps/client/src/` で今日/記録/会話/出典/訂正/保存/ToDo/確認の人工画面、明色・Glass代替、戻る導線を実装。原文相違、時刻不明、片側記録、未許可・期限切れを分けた。日次は原文抜粋で、AI生成ではない。AC06/07/15の表示部分、A条件の操作部分。全43条件の合格とはしない。
  - K03：端末録音・5分停止・保存状態・checksum・原音再生、SecureStore、再接続時の本文再取得、目的別同意からupload/job取得までを実装。Expo Go/Webの実録音は開始不可。FastAPI、PostgreSQL/Storage adapter、非公開DB migration、単一入力ASR worker境界を追加。AC01/02/07/14/19の人工境界と設定。具体ASR/分割・実機確認は残る。
  - K04/K06：コード接続、双方の帰属/参加確認、今回許可、継続許可/解除、範囲の新版確認、取消をAPIとLive画面へ追加。古い継続回答で解除済み許可を復活させず、取消後は新しい双方許可を要求。自分の原文訂正・旧版遮断・入力削除を実装。AC03/04/08/09/10/13/16/18/19の該当境界。共有本文の生成・clip・指摘受信の実経路は残る。
  - K09：本人のSourceを「あとで見る」へ保存し、私用メモ/タグ編集、再確認・解除するAPIとLive画面を実装。訂正・期限・削除後に古い引用/メモを出さない。保存の重複抑止と本文なし状態の7日後削除を確認。ToDoは人工デモで採用/完了/戻すを操作できるが、実G2と永続化は未接続。A03/04/05/06/13/14の関連部分を人工確認。
  - 自己確認成功：`npm run typecheck`、`npm test` **26件**、`./scripts/backend.ps1 test` **32件**、`npm run contracts:generate`、OpenAPI再生成。Node 22.20.0/npm 10.9.3、Python 3.12の独立venvで実行。Pythonの依存由来deprecation warning 2件あり。FastAPI認証・Storageはテスト用代替で、実Supabaseの証拠ではない。
  - バンドル成功：`npm run build:bundles` でAndroid/iOSのHermesとWebを出力。`npm run doctor` **21/21**。`node scripts/check-client-secrets.mjs` で配信用6ファイルにローカル既知キー値の一致なし（値を出力せず検査）。APK/IPA・署名・実機確認ではない。
  - Web操作確認成功：390×844のブラウザ幅で、相違→出典→訂正の破棄→元位置、保存/メモ一覧、ToDo本人採用→完了→未完了、API未設定の表示を確認。開発用Webは `http://localhost:8081/`。iPhone/AndroidのOS動作・文字拡大・読み上げの確認ではない。
  - 失敗を修正して同条件で成功：WebのBackHandler/透明度設定の非対応呼出、録音状態再読込の誤った中断表示、同時uploadの正常音声削除、保存の失効表示がcleanupで延長される問題など。型・APIテスト・ブラウザで該当範囲を再確認。
  - ネイティブ生成は一部のみ確認：作業用コピーのExpo prebuildはテンプレート転送時にWindowsのEIO/Access deniedで停止。展開済みテンプレートへExpoのconfig生成関数を適用し、Androidのマイク/foreground service/backup除外XMLとiOS AppDelegateのbackup除外挿入を確認した。検証用コピーのXcode target/Info.plist警告は残り、通常prebuild・Swift/Gradleコンパイル成功とはしない。Androidテーマの依存不足はexpo-system-ui追加で修正。バックアップ除外は[Android公式仕様](https://developer.android.com/identity/data/autobackup?hl=ja)の端末間転送も考慮したが、実機での実効性は未確認。
  - 実行に必要な残設定：PATH上でDocker/ffprobe/adb/javaを検出できず、Supabaseのローカル起動・2アカウント・HTTPS入口は未構築。ASR provider/model/入力上限/チャンク設定/保持/予算と対象音声、生成予算、Expo project/識別子/署名/端末が未確定。実音声・外部モデル・課金・公開・commit/push・独立レビューは未実行。
  - **残る実装（選定だけで済む部分とは区別）**：ASR adapterと正規化/チャンク再開、2入力の時間対応/統合とG1、認可済みclip・指摘API、ContextView/全文脈manifest・G2〜G5 runner、ToDo/日次の永続化、Google/端末カレンダー、3人/グループの人工認可境界、初回体験と両OS受入。主要response以外の共通schema/OpenAPIも未完。現在の共有許可成立後は統合未設定のfailedを返す。
  - 再開先：[APP_DEVELOPMENT](APP_DEVELOPMENT.md)、[backend README](../../services/backend/README.md)、[contracts README](../../contracts/README.md)。次はK03の具体ASR adapter/チャンクとローカルSupabase/HTTPSの接続を固定し、1端末の保存→個人文字起こしを実条件で検証。そのSourceをK05/K10へ接続する。既存の人工成果を実生成に見せ替えない。デザイン値は今回の実装案で、最終デザイン承認を取得済みとはしない。
  - 文書・差分確認成功：`node scripts/check-docs.mjs` は49文書414ローカル参照/使用アンカー、`git diff --check` 成功。成果物の検査範囲は上記に限定し、独立レビュー・実機の成功を加えていない。

- 外部API書き起こしの構成要件反映（2026-09-14、文書更新完了）：ユーザーが外部APIのモデル利用を明示採用し、ドキュメント更新を依頼。開始版 `555d950` / main、開始時の既存差分は `.env.audio-models.local` のみで保持。主担当が[MVP_SPEC 2.2 §9](../product/MVP_SPEC.md#contracts)と方針・ロードマップ・開発手順・利用条件・調査の採用状態・U03画面見本・README・本記録の計9文書を更新。対象はK01/K03/K05/K06/K07、M01/M03/M04/M06/M08・U02/U03/U06/U07・AC01/02/05/07/13/14/19。スマホ/worker/Supabaseの責務、外部ASR adapter、チャンク/時刻/再送/費用管理、用途別同意と外部保持を反映した。
  - 自己確認成功：`node scripts/check-docs.mjs` は49文書407ローカル参照/使用アンカー、対象9文書の `git diff --check` は成功。現行仕様・契約・画面見本・K03の相互照合も実施。これは静的な文書確認で、製品の受入テスト・実認証/音声送信・実機・独立レビューは未実行。コード/依存・音声評価・モデルの再調査は今回の文書更新の対象外。
  - 残件：外部API利用の判断は完了。具体プロバイダ/モデル、チャンク設定、予算、対象音声の実送信条件はGo君の選定と企画者の判断・対象データの利用確認を実接続前に行う。人工契約/UIは先行できる。旧仕様の証拠はGit `555d950:docs/product/MVP_SPEC.md` に保持し、下記のPC処理/外部ASR未採用という過去記録は2.2で更新した。今回のモデル選定資料の変更は採用状態と残件だけで、調査日当時の比較内容とExcelは保持。
  - 作業中に別の更新でHEADが `e887e14`、`8b986a6` へ進み、認証関連の差分も増えたことを確認。最新ファイルを読み直して保持し、本作業ではcommit/push・認証情報の編集を実行していない。受け渡し時はその時点のHEADと未コミット差分を改めて確認する。

- 音声APIキーファイルのGit除外解除（2026-09-14）：開始版 `8f40f70` / main、開始時差分なし。ユーザーがハッカソン当日用キーのプライベートリポジトリ共有を指定したため、ルートの `.env.audio-models.local` だけを `.gitignore` の例外に追加し、[共有手順](../../credentials/README.md)を更新。以下の暗号化共有時点の「平文はGit除外」を今回変更した。K03/K05/K07の認証準備で、製品M/U/受入条件の変更は対象外。
  - 自己確認成功：`git check-ignore -v --no-index` と `git status --short` で対象ファイルが追加可能、復号鍵・他のenv・クライアント側envは除外継続と確認。`node scripts/check-docs.mjs` は49文書402ローカル参照/使用アンカーが成功、`git diff --check` も成功。キー値は表示していない。commit/push・実API・独立レビューは未実行。次は必要なファイルを追加してcommit/pushする。

- 音声APIキーを含むGit共有（2026-09-14）：ユーザーのpush依頼に対応。開始版 `3e757ea` / main、開始時差分なし。5社のキーをAES-256-GCMで暗号化した共有ファイルと復号用スクリプトを追加。平文とランダム256ビットの復号鍵はGit除外のまま保存。共有手順は[credentials](../../credentials/README.md)。認証準備用の変更で、製品の方式・共有仕様は変更していない。
  - 自己確認：暗号化・復号の一致、異なる鍵・改ざんの拒否、既存環境ファイルを上書きしないことの3テストが成功。実キーの暗号化ファイルとローカル原本の一致も確認した。実認証APIは未検証。
  - 取得作業の続き：Cloud Speech APIを既存Gemini Projectで有効化し、`hackathon-audio-eval` サービスアカウントを作成。権限選択の途中でブラウザ実行環境が停止し、権限付与完了・JSON鍵発行は未確認。両ロールとJSON鍵保存の明示承認は受領済み。ElevenLabsの指定Googleアカウント連携の承認も受領したがログイン完了は未確認。HF本人ログインとGemini発行確認も残る。

- Codex修復・音声APIキー取得の最新状態（2026-09-13、同依頼の継続）：`deny_read_acl_state.json` が22バイトのNULで壊れていることを限定診断で確認。同フォルダへ原本を退避し、Codexによる正常JSONの再生成と通常shell実行に成功。ACLやセキュリティ設定は変更していない。ブラウザ操作の応答停止は別途セッションresetで復帰したが、ElevenLabsのGoogleログイン小窓の操作は未解決。
  - 認証準備（K03/K05/K07）：ユーザーが7社とHFの新規発行・Git除外ファイルへの保存を明示許可。**OpenAI・pyannote・Speechmatics・Deepgram・AssemblyAIの5社で専用キーを新規発行・保存済み**。追加の規約同意とpyannoteの慶應メール利用は、この依頼中に個別の了承を受領。詳細・修復証拠は[発行先と作業記録](AUDIO_API_CREDENTIALS_20260913.md)。
  - 残件：ElevenLabsとHFは本人ログイン待ち。Geminiは初回サイト拒否後に同じprojectで再試行したが、成功・新規キー追加を確認できていない。Cloud STTのADC設定は未実施。実認証API・音声送信・モデル実行・課金契約・独立レビューは未実行。以下の0件は修復前の履歴。
  - 自己確認成功：文書チェック49ファイル399ローカル参照、`git diff --check`、保存済み5変数とGit除外、編集した公開文書3本に実キー値が含まれないことを確認。通常shellと文書編集helperも動作成功。

- 音声APIキー取得の依頼（2026-09-13）：対象版 `c39307a`、前段の調査の既存差分を保持。ユーザーから全候補のキー取得を依頼。対象はK03/K05/K07の認証準備で、方式採用・音声実行とは別。[全候補の発行先と再開記録](AUDIO_API_CREDENTIALS_20260913.md)を追加し、Git除外済みの `.env.audio-models.local` に空欄を作成。取得0件。ブラウザ操作ツールが `failed to write kernel assets` / `os error 3` で初期化失敗し、reset後と別Computer Use経路でも同一。ログイン状態未確認、発行・認証確認・課金・音声送信は未実行。再開条件は操作ツールの初期化復旧。
  - 自己確認成功：文書チェック49ファイル398ローカル参照、`git diff --check`、保存欄10項目すべて空・Git除外を確認。独立レビューと実認証の確認は未実行。

- 音声モデル選定の調査・検証表作成（2026-09-13）：今回の依頼は価格より品質を優先したモデル/構成の比較と評価方法の具体化。開始版 `c39307a`、開始時の未コミット差分なし。対象は音声選定の準備（K03/K05/K07、M01/M03/M04/M06、U03/U06/U07、AC03/05/06/07/14）。編集先は調査資料・記入用比較表・本記録。製品の方式採用・音声adapter接続・実音声評価はこの資料作成とは別。
  - 成果: [調査・検証設計](AUDIO_MODEL_SELECTION_20260913.md)と[Excel比較表](../../outputs/01a099ce-b49b-7e63-ba2b-5ed6cc750314/audio-model-comparison-20260913.xlsx)。23候補項目・12構成パターン・14ケース。追加意向の「1日、複数モデルの得意機能と誤り確認」を反映し、H01基準→H02独立ASR照合→必要ならH03話者処理という導入案を追加。推奨順であり実測順位ではない。
  - 自己確認成功: Excelの空欄/実測0/分母0/DER 100%超/予備行/本人照合率など27確認、数式エラー0、5タブと入力欄の描画確認、保存xlsxのエラーcacheなし・固定行列/選択肢の存在確認。初回の声紋入力確認式の余分な括弧を修正し、同条件の再確認成功。Excelアプリ内での動作確認は未実行。
  - 文書確認成功: `node scripts/check-docs.mjs`（48文書396ローカル参照/使用アンカー）、`git diff --check`。外部URLの現行機能は公式資料を閲覧して調査。独立レビュー、モデルの実行、実音声の採点、アカウント登録/課金、外部音声送信、製品コード変更、commit/pushは未実施。
  - 残件: Go君が実データ/採点版/設定を固定して検証。クラウドASR・声紋処理の追加は現行PC処理からの変更案で、企画者の方式判断と対象データの実送信条件確認が必要。Scribe speaker libraryの登録/利用枠、実行環境、品質閾値も未確定。依存する実経路だけを保留し、比較設計・UIの人工実装は先行できる。


### 同期前のローカル作業履歴（復元）

以下は同期前の判断と検証記録。実装の現在地は上のmain取り込み後の記録と、先頭の復元・統合記録を参照する。

### Setlog案のタイトルにNoto Sans JPを採用（2026-09-15）

- 依頼/段階：「タイトルはそのフォントを使わなくていい、はっきりしたフォントを使って」に従う書体の具体化。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。本文Kosugi Maruの決定と既存案との分離を維持する。
- 決定/成果：[SETLOG_UI_STRUCTURE](../product/SETLOG_UI_STRUCTURE.md)を1.3にし、画面タイトル・見出し・記録カードのタイトルをNoto Sans JP SemiBold 600へ。本文はKosugi Maru Regular 400。[書体見本](../product/prototypes/setlog-ui/kosugi-maru-body.html)に実フォントを適用し、公式配布の可変TTF・ライセンス・メタデータと配布元記録を同梱した。
- 確認：in-appブラウザーで両書体の読込成功と、Noto Sans JPのタイトル／Kosugi Maruの本文を実見。ユーザーが調整していた本文18px／行間1.50を復帰。`npm run verify -- docs` は2/2成功（52文書・542ローカル参照/使用アンカー、16管理ファイルmetadata）。編集対象外99ファイルのSHA-256と既存WORKFLOW履歴が一致し、見本JS構文・末尾空白・差分も確認した。
- 範囲外：大きな時刻・操作ラベルの書体決定、生成画像の再生成、アプリコード・公開API／型・既存仕様の変更は行わない。実機・読み上げ・アプリへの組込みは未検証。commit/push/mergeなし。

### Setlog案の本文にKosugi Maruを採用（2026-09-15）

- 依頼/段階：「Kosugi Maruを本文に使いたい」に従う書体の決定。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。既存案との分離、画像、アプリの未コミット差分を保持する。
- 決定/変更先：[SETLOG_UI_STRUCTURE](../product/SETLOG_UI_STRUCTURE.md)を1.2へ更新し、記録本文・要約・AI回答・説明文にKosugi Maru Regular 400を採用。見出し・大きな時刻・操作ラベルの書体は未決定のまま。既存の生成画像は選定前のものと明記。
- 成果：[実フォントの本文見本](../product/prototypes/setlog-ui/kosugi-maru-body.html)と、公式Google Fonts配布のTTF・ライセンス・メタデータを専用フォルダに追加。標準書体との比較、文章入力、文字サイズ・行間の調整ができる。アプリコード・公開API／型・既存MVP_SPECは変更しない。
- 確認：in-appブラウザーでフォント読込成功と実際の字形を確認し、本文20px・行間1.90への変更、17px・1.75への復帰を確認。寸法は見本の初期値で最終採用値ではない。`npm run verify -- docs` は2/2成功（52文書・536ローカル参照/使用アンカー、16管理ファイルmetadata）。編集対象以外96ファイルのSHA-256と既存WORKFLOW履歴が一致し、見本JSの構文・文書末尾空白・差分も確認した。
- 範囲外/受け渡し：生成画像の再生成、見出し等の書体決定、アプリへの組込み、実機・文字拡大・読み上げの検証は未実施。本文見本のローカル表示を `http://127.0.0.1:64604/kosugi-maru-body.html` で開いた。見本用ファイルは同梱フォントで開ける。commit/push/mergeなし。

### Setlog案の主要8画面を画像化（2026-09-15）

- 依頼/段階：「画像としてアプリ画面を生成して」に従うK02準備の静止画作成。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。既存案とSetlog案のファイル分離を維持し、開始時の既存差分と96ファイルのハッシュを保存した。
- 成果：[Setlog案の画像と生成指示](../product/prototypes/setlog-ui/README.md)。2枚に8画面を収録。01は録音開始前／ルーム一覧／自分の記録／相手ルームの記録、02は録音中／AI／確認一覧と共通録音帯／共有範囲確認。内蔵imagegenを使用し、02は01を見た目の参照にした。imagegenスキルに従い、生成元を残して専用フォルダへコピー。既存画像は変更しない。
- 正本/変更先：[SETLOG_UI_STRUCTURE](../product/SETLOG_UI_STRUCTURE.md)を1.1にし、画像参照と作成済みの範囲だけを更新。専用画像フォルダと本節を追加。UI構成と未決定、既存MVP_SPEC・製品方針・コード・公開API／型・契約・Go君の担当は変更しない。
- 主担当の画像確認：2タブ、録音開始、先頭の自分の記録、自分のみ、通常個人記録／本人待ち／相手待ち、許可範囲だけの共有会話、記録／AI、出典、確認件数1件、共通録音帯、共有前に相手本文を出さないことを実見して照合。色と寸法は案。チェック選択は本人操作後の架空例で、AI参照初期値やコード入力による確認成立を定義しない。
- 検証：`npm run verify -- docs` は2/2成功（50文書・525ローカル参照/使用アンカー、16管理ファイルmetadata）。既存画像・コード・仕様等94ファイルのSHA-256が開始時と一致し、それ以前のWORKFLOW履歴を保持。2画像は生成元とバイト一致、いずれも1536×1024。文書の末尾空白・差分チェックも成功。履歴比較で検出した改行1か所の変化は元に戻し、再確認した。
- 残件/範囲外：空・失敗・期限切れの画像は未展開。アプリ操作・実機・文字拡大・読み上げ・実API・実録音・外部サービスの実行は未検証。今回の独立レビューは未実施。自動処理・AI参照/履歴・外部実行条件の未決定を維持し、commit/push/mergeなし。

### Setlog案と既存案を別ファイルへ分離（2026-09-15）

- 依頼/段階：ユーザーの「setlogと既存のものはファイル分けてほしい」に従い、K02準備の構成案を分離。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。前回の文書反映だけを戻し、それ以前の未コミット差分を保持する。
- 成果：Setlog案を [SETLOG_UI_STRUCTURE](../product/SETLOG_UI_STRUCTURE.md) に独立して保存。録音／ルーム、記録／AI、確認アイコン、未共有記録の状態と保存先、受入観点・未決定を収録した。既存案は [MVP_SPEC](../product/MVP_SPEC.md) と既存画像に保持し、Setlog案で上書きしない。
- 変更先/保全：MVP_SPEC、PRODUCT_CORE、README、ロードマップ、APP_DEVELOPMENTの5文書を、前回反映の直前に保存したコピーの内容へ復元。本書の前回作業記録は経緯として残し、分離先への参照と現在の扱いを明示した。画像・アプリ・API／型・既存の担当/契約は変更しない。
- 確認：`npm run verify -- docs` は2/2成功（49文書・517ローカル参照/使用アンカー、16管理ファイルmetadata）。復元した5文書は前回反映直前のコピーとバイト単位で一致。画像・アプリ・設定・検証等の保全対象89ファイルのSHA-256と、それ以前のWORKFLOW履歴も一致。対象文書の `git diff --check` と新規文書の末尾空白チェックは成功。主担当の文書確認のみで、画像・実機・APIの検証は対象外。
- 残件：既存案との統合・置換、画像作成、アプリ実装は今回の範囲外。自動処理、AI参照の初期値/履歴、外部実行条件等の未決定はSetlog案の末尾に保持。commit/push/mergeなし。

### 録音起点のUI構成と未共有記録の文書反映（2026-09-14、分離前の作業記録）

以下は分離前の作業経緯。既存仕様への反映は上の分離作業で取り消し、現在のSetlog案は専用ファイルに置く。記載された版・変更先・検証数は当時のもの。

- 依頼/段階：ユーザーが提示計画の実行を指定。計画末尾の「今回は構成案まで」に従い、K02準備の文書化のみ。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。開始時にAGENTS/開発手順/仕様/App等の既存変更と、未追跡のUI試作/画像/発表資料/検証入口があった。文書6ファイルの開始時コピーと、アプリ/画像/設定/検証等89ファイルのハッシュを作業用一時領域に保持した。
- 採用内容/正本：[当時のMVP_SPEC §4への追記（現在は別案）](../product/SETLOG_UI_STRUCTURE.md#recording-first-ui)へ録音／ルームの2タブ、録音起動、左上設定・右上確認、先頭の自分の記録、相手別ルーム内の記録／AI切替を反映。[未共有記録の流れ（現在は別案）](../product/SETLOG_UI_STRUCTURE.md#private-records)で本人待ち/相手待ち/統合中/見送り・期限切れを区別し、共有後も元記録を保持。相手のルームは許可範囲の共有会話を表示する。既存M01〜M15/U01〜U15とAC01/03/04/06/07/09〜12/15/16/19、追加構成の受入観点を照合する範囲。
- 変更先：MVP_SPECを2.3へ更新し、§16の人物単位/配置/未決定、§17の本人対応入口、既存U対応とGlass/オフラインの参照を同期。PRODUCT_CORE、README、ロードマップ、APP_DEVELOPMENTと本節へ採用状態/作業境界を反映。公開API/型/正式契約/fixture版は変更しない。旧Home/3タブ案・画像・操作モックは以前の検討資料として保持し、下の過去記録の当時の判断や検証結果を書き換えない。
- 確認：`npm run verify -- docs` は2/2成功（48文書・517ローカル参照/使用アンカー、16管理ファイルmetadata）。主担当が開始時文書との差分と旧起動先/未決定表記を照合し、対象6文書の `git diff --check` も成功。保全対象89ファイルのSHA-256一致、MVP_SPEC §5〜15と本節より前からあるWORKFLOW履歴の本文一致を確認した。今回の独立レビュー・アプリ/画像/実機/API/録音/外部送信は対象外。文書の確認を新UIの動作証拠としない。
- 残件/次の受け渡し：構成案の文書化後、依頼された段階で具体配色/余白と状態別画像を検討する。録音後の自動処理、AI参照の初期値/入力/履歴、外部実行/書出し条件、ルームの正式契約は未決定のまま。判断者は企画者、未決定に依存する正式実装だけを保留する。Go君の担当/技術選定は変更せず、commit/push/mergeなし。

### 本人対応を中心にしたHome一枚の画像案（2026-09-14）

- 依頼/段階：最新の本人対応の洗い出しを踏まえたHomeの静止画設計。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。編集は既存画像フォルダへのG案追加と本節に限定し、旧A〜F画像、同時進行の開発資料/検証入口、既存未コミット差分を保持した。
- 成果：[iOS Homeの画像案](../product/prototypes/design-directions/g-ios-home-attention-v1.png)。確認2件（個人記録に基づく予定時刻の質問、共有範囲の確認入口）と、本人が既に採用した作業1件を表示する人工例。予定の回答と本人の実作業を分け、録音開始を下部の不透明な主色ボタンへ配置。最近の記録/連携一覧/AI処理中/相手待ちは追加しない。
- 正本/受入：AGENTS、MVP_SPEC §4/6/16/17とロードマップのUI検討（K02準備）を照合。確認件数が表示と一致し、次の操作が読み取れること、時刻回答を原文訂正/登録成功と混同しないこと、持ち寄りが未成立のまま共有範囲確認へ進むこと、実作業の完了は本人操作であることを確認観点にした。
- 設計の前提/未決定：14時/15時は日時欄への回答案であり、原文の正解選択や外部登録の許可ではない。「トークで確認」から別の時刻/根拠へ戻る。回答後の外部実行は既存条件と未決定の確認条件に従う。人別の所属は利用者が明示した架空例。Home/トークの2タブ全体・この配置/青の採用、Homeからの回答の保持/遷移、録音後自動処理、ToDo自動採用、AI参照/履歴、外部書出し条件は今回確定しない。AIへの処理同意は追加しない。
- skills/見た目：apple-designの階層/近接/一貫性、baseline-uiの単一主色/余白/局所的な状態表示を適用。RN＋Expoの明色仕様を優先し、スキルのWeb実装指定や広いGlass推奨をアプリへ持ち込まない。390×844pt相当、本文17pt・操作48pt以上を設計目標に生成。Glassの表現は下部ナビだけ、確認面/本文/録音開始は不透明。Android/非対応/透明度低減の通常面は既存仕様を維持し、今回画像には展開しない。
- 生成/保存：内蔵imagegenで1枚を新規生成し、元の生成ファイルを残してリポジトリへコピー。外部APIキー/CLI fallbackは使用していない。旧F画像は目視で配色と情報量を比較したが、生成への参照画像添付はなく、下の指示から新規生成した。画像内に「デザイン検討案・架空データ」。K01の正式契約/fixtureや実動作の証拠ではない。
- 確認/未実行：主担当が画像を実見し、日本語/件数/個人表示/未成立共有/未完了作業/録音開始/ナビを照合。独立担当も画像を実見し、この限定範囲で重大/中の指摘なし。`npm run verify -- docs` は2/2成功（48文書・507参照/アンカー、16管理ファイルのmetadata）、対象の `git diff --check` も成功。画像の濃淡・字形・寸法は実装トークンの確定値とせず、実機の文字拡大/タップ/実Glass/動き/読み上げは未検証。アプリコード/型/正式契約/API/実録音/音声処理/製品データの外部送信は未実行。Go君の担当/選定は変更せず、commit/push/mergeなし。
- 次の小作業/停止条件：このHome案の優先順位と見た目を比較し、採用方向で0件/読込/失敗/録音中を展開する。未定義の自動化/参照/外部操作に依存する正式動作は保留する。

<details>
<summary>Home画像の生成指示全文（内蔵imagegen）</summary>

```text
Use case: ui-mockup
Asset type: one polished iOS mobile app Home screen concept for a Japanese personal conversation recording / AI workspace app.
Primary request: Generate ONE exquisitely designed, realistic flat app screenshot, portrait with the proportions of a 390 x 844 point iPhone screen, rendered at high resolution. Show the entire screen including status bar and bottom navigation. Not a collage, no phone hardware/frame, no desktop web layout, no perspective, no decorative scene. Add only a slim caption BELOW the app viewport reading exactly "デザイン検討案・架空データ".
Visual direction: premium restrained iOS design with the polish of a contemporary running or fashion mobile app and the aligned, readable organization of Slack. Sharp information hierarchy, excellent Japanese typography, substantial breathing room, understated pale gray surfaces, blue as the single accent. Native SF Pro and Japanese system-gothic look. White/offwhite #FAFAFC, text #16181E, secondary gray #626773, blue #1760ED. No gradients, purple, glows, colorful avatars, charts, dashboards, giant hero, streaks, service logo grid, or recent-record list. Thin separators and two elegantly grouped opaque surfaces, minimal shadow. Screen content must be legible at 390px wide: body approximately 17pt, captions 13-14pt, touch targets >=48pt. Keep type realistic and balanced, avoid making all text bold.
Content concept: Home shows only the user's actionable exceptions and one already user-adopted real-world task. There are exactly TWO pending confirmations and ONE real-world task. Ordinary AI processing and waiting for another person are not tasks here. This is a static proposal, no real recording, processing, permission, scheduling or sharing success. Do not add technical warnings inside the app.

Layout from top to bottom, with carefully aligned 20pt side margins:
1) Native iOS status bar at top: time "9:41", normal cellular/wifi/battery icons. Below it, large confident title "Home" around 34pt left, a small dark outlined gear button right with generous tap area. No greeting, date dashboard, app logo or giant summary.
2) Section heading "確認が必要" with a small neutral count "2". Provide 20-24pt breathing room before the content.
3) The dominant but compact OPAQUE white confirmation card with softly rounded 20pt corners, quiet thin border, no glow. A small outline calendar icon and subtle eyebrow "予定の時刻". Below, the question in clear 21pt semibold Japanese, two lines:
"明日の打ち合わせは"
"14時と15時、どちらですか？"
Small supportive line "田中さくらとの記録・個人".
At bottom of this card TWO equal-width 48pt-high answer buttons aligned side by side with light blue opaque fill and blue semibold text "14:00" and "15:00". They are answer options, NOT a claim that a calendar event is already created. Provide a quiet secondary text link "トークで確認" with a right chevron so another time or the original context can be checked. Do not include a "登録済み" or automatic completion assertion.
4) About 12pt below, a quieter compact OPAQUE white row for the second confirmation, with a small outline two-people icon. Title exactly "共有する範囲を確認", supporting text exactly "鈴木 蓮との持ち寄り". A right chevron indicates opening full confirmation. No permission switch, no approve action on Home, no excerpt of the other person's recording, no "共有済み". Align this row text to the first card's left content edge.
5) About 28pt below, a secondary section "あなたが行うこと" using smaller/lighter emphasis than the pending confirmations. One uncluttered task row, separated by a fine rule rather than a bulky card: an empty circular completion control left, text "企画案を見直す" and beneath it "今日 17:00まで" in neutral gray. It is an already adopted personal task, not an AI suggestion or an already completed task. Large 48pt completion hit area; no red urgency.
6) Leave natural whitespace before the bottom controls; do not fill it with unrelated features or explanatory text.
7) Near the bottom, fixed above the tab bar, ONE full-width 56pt-high solid blue rounded button with a crisp white microphone outline and exact label "記録を始める". This is opaque, no Glass/gradient/shimmer, not active recording, no red recording dot. Keep it comfortably reachable by thumb.
8) Bottom tab navigation has exactly TWO destinations with icon+label: active blue house with "Home", inactive gray chat bubble with "トーク". Use a subtle near-white iOS floating frosted-glass navigation capsule with thin edge, ONLY this navigation may look translucent. Include the bottom home indicator and safe area. No third tab, no record-as-tab, no notification badges.

Composition: Make the answer card the obvious first decision, sharing a quiet second row, the real task a separate secondary area. Fit all three items and fixed bottom controls comfortably into the single viewport without clipping or obscured text. No content behind opaque cards. Do not exaggerate shadows or frosted effects. The result should feel like an intentional, modern, calm native iPhone product, not a web dashboard. Text must be accurately rendered in Japanese as supplied, with no invented copy. The slim exterior caption must say "デザイン検討案・架空データ".
```

</details>

### AGENTSの重複整理（2026-09-14）

- 依頼/範囲：AI作業入口の簡潔化。既存差分を保持し、AGENTS本文とこの記録だけを更新。資料参照、作業の進行、人への確認、製品の区別、検証/完了、引き継ぎへ整理した。
- 変更：了承と実行範囲の扱い、検証と完了条件を各節へ集約。録音実験の個別条件は既存VALIDATIONを参照し、入口での再掲を削減した。同じ依頼の了承継承、独立作業の継続、共有/閲覧の境界、既存変更の保護、検証不足を完了にしない条件を保持。本文は改行をLFにそろえた文字数で2,902→2,349（約19%減）。P3の介入計測は追加しない。
- 確認：主担当が整理前後のルールと参照先を照合。`npm run verify:docs` は2/2成功、旧AGENTS見出しへの参照検索で該当なし、対象差分の空白検査成功。アプリ・Skill・検証コード・製品仕様は今回変更していない。読みやすさの整理と静的確認であり、AIの自律性向上を実測したものではない。commit/pushなし。

### 成果単位のAI実行と共通検証入口（2026-09-14）

- 依頼/範囲：開発プロセスレビューのP2二点（小工程ごとの再依頼、検証入口の不足）の修正。HEAD `70e936a` と既存差分を確認。AGENTS・実装/引き継ぎSkill・ロードマップ・開発手順/README/索引、root package scripts、新規検証入口を対象とした。P3の介入回数・削減量の計測は依頼者が不要と指定し、追加しない。
- 変更：人が成果・受入条件・担当範囲を決め、AIは小作業を内部で分割して実装→検証→修正→再確認まで続行。同じ依頼の明示済み範囲を再開時も引き継ぎ、取消・変更と照合する。新しい仕様判断・担当境界変更・既存許可外の実行が必要な部分だけ確認する。調査のみの依頼や未決定の製品仕様を実装依頼へ広げない。
- 検証入口：[verify.mjs](../../scripts/verify.mjs)を `npm run verify` から実行。docs/ui/prototype/toolingを組み合わせ、対象未指定は登録済みの全確認。失敗・起動不能・シグナル終了は成功にせず、残る確認も実行する。完了前の対象選択と再確認をAGENTS・Skillへ接続した。常駐監視/CI・独立レビューの自動起動は追加していない。
- 確認：入口未実装時のテスト失敗→実装後6/6成功。WindowsでNode 24.16.0/npm 11.13.0と、指定Node 22.20.0/同梱npm 10.9.3から `npm run verify` を実行し、双方7/7確認成功（UI 11件・旧試作4件・入口6件、型チェック、文書/Skillと文書検査自己テスト）。npm 10.9.0での再実行は今回行っていない。対象名誤記は確認を開始せず、直接Node起動は終了2、npm 11経由は非0を確認。既存のUI用TSのmodule-type警告は成功結果と分けて保持。
- 保持/限界：アプリコード・画像・依存/lockfileは変更していない。作業中に別タスクが更新したMVP_SPECとHome検討記録も保持した。これは開発手順とローカル検証入口の確認であり、実機・実API・製品機能の完成判定ではない。commit/push/公開なし。

### Homeの本人対応と自動化する範囲の洗い出し（2026-09-14）

- 依頼/段階：ユーザーが「本人の対応が必要なものをHomeへ」「AIでメモ/記録/ToDo管理の手間を減らす」と指定。情報設計。対象は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`、既存の未コミット差分を保持。編集先はMVP_SPEC §4の優先参照と追加の[§17](../product/MVP_SPEC.md#home-attention)、本節のみ。
- 決定/提案：Homeへ本人対応を集める方向を採用。先行するHome/トーク統合案は未採用のまま保留。最新のHomeは本人対応、トークは人別の記録カードとAI対話として検討を続ける。全タブ配置/既存機能の移設は未決定。共有・不足情報・復旧・現実の本人作業を洗い出し、14場面の発生条件/操作/自動化準備とHomeへ出さない状態を正本にまとめた。
- 正本/受入：MVP_SPECのM01〜M15、U02〜U15、§3〜7/14〜16とロードマップUI検討（K02準備）を照合。本人が実行できる用事だけを集約し、相手待ち/処理中/一般の不明/未採用候補を課題化しない。一原因一件の入口、実際の回答/復旧による件数更新、権限と期限、旧内容の遮断、0件と未取得/失敗の区別を受入観点にした。所有者確認/相手共有/外部操作/実作業の完了をAIの推測で代替しない。
- 見直し候補/判断者：録音後と再接続時の自動処理、明確な約束からの作業自動登録、明確な自然言語依頼で外部確認を省ける条件、記録の所属とAI参照初期値。企画者であるユーザーが判断するまで既存条件を変更しない。外部書出しの共有権限/コピー失効、AI履歴の入力範囲も残件。日次/保存の機能削除、実行上限の緩和、新しい処理同意や自動録音・自動催促は追加しない。
- 確認/未実装：主担当が正本と照合。独立レビューの中1件（録音開始前のマイク拒否/容量不足の復旧漏れ）を追記し、再レビューで解消・追加の重大/中指摘なし。`npm run verify -- docs` は2/2成功（48文書・507参照/アンカー、16管理ファイルのmetadata）、対象の `git diff --check` も成功。同時進行の開発プロセス/検証入口の変更を保持し、更新されたAGENTSの検証手順に従った。今回の画像/製品コード/正式契約/実機/API/音声処理/外部送信は未実行。Go君の音声技術選定や追加のAPI/worker担当案は変更しない。commit/push/mergeなし。
- 次の小作業/停止条件：まず録音終了後の自動処理を採用するか決め、共有とは分けて§3/4の実行開始条件へ同期する。その後「共有範囲の確認」「日時一つの回答」「接続復旧」の3件と0件/読込失敗でHomeを比較する。未確定の自動化・所属・参照履歴に依存する正式動作だけ止め、文言/配置案は先行できる。

### 記録カードと参照選択を中心にしたHome再検討（2026-09-14）

- 依頼/段階：ユーザーがHomeの最近の記録とトーク更新順の重複を指摘し、記録をワークスペース内のカードとして投稿、要約/全文の入口、AI参照記録のチェック変更を指定した。情報設計の再検討。編集はMVP_SPEC §16の追加指定/残件と本節に限定し、画像・コード・契約は変更しない。既存差分は保持。
- 今回の指定：MVP_SPEC §16.2へ記録カードとチェック選択を反映。カード表示は本人用AIトークへの配置であり、相手へのDM/新しい共有許可ではない。処理待ち・失敗・原文/要約が利用可能な状態を区別し、カード追加だけで自動処理や成功を作らない。M12本人メモの扱いは維持。
- 推奨案（未採用）：最近の記録のHome一覧は外し、トーク一覧を起動時のHomeとして統合する。人別の更新を見つける、部屋で記録を読む、選んだ記録でAIに聞く、を一つの入口から行う。独立Home/トークの2タブを維持するためだけに新機能を追加しない。下部タブの削除や起動先変更はまだ実装/採用していない。
- Home/起動画面に置く候補：常設は「記録を始める」と設定入口。行き先未設定の記録は存在するときだけ「記録の行き先を選ぶ」へ。対応待ちは、自分の共有確認・送信/保存失敗など本人操作が必要なものがある場合だけ小さな入口を表示し、対象の既存画面へ戻す。相手待ち/通常の処理待ちを本人の用事として並べない。初回だけアクションボタン等の案内を示す案。録音中は共通帯とU02への入口を維持する。
- トークの更新順案：新しい記録のカード追加や本人の新しい質問で上位へ。裏側の再取得・要約更新・再試行だけでは順番を動かさず、同じ記録カードの状態を更新する。厳密な更新イベントは未採用。人アイコンからの履歴は、その部屋の記録だけを探す補助表示として同じ記録を参照する。
- カード/参照チェック案：「日時・記録名・個人/共有・処理状態」と「要約」「全文」。入力欄付近に「参照中：3件／変更」、参照シートには記録ごとのチェックを置く。チェック変更は次の質問から適用し、0件なら選択を促す案。閲覧可能でも未選択の記録を、過去のAI回答経由で暗黙に参照しないための履歴設計は未定義で、依存する実装を保留する。期限切れ/権限外/未準備を選択可能な正常記録に見せない。
- 機能を足さない判断：最近の記録、予定一覧、ToDo、連携先一覧、AI質問集をHomeに並列配置する案は推奨しない。Google Calendar/Drive/Notionへの実行は既存どおりトークから。将来の「次の会話の準備」は有用性を検討できるが、予定読込・人物照合・新しい横断AIを追加採用する理由にはしない。
- 判断待ち/停止条件：Home統合と表示優先順位、記録の所属先がない場合の振分け、チェック初期値/新規追加時/変更の適用、AI履歴と入力範囲。今回のUI指定から自動帰属・自動共有・自動処理を推測しない。既存F画像は今回のカード/チェックをまだ表現しておらず、以前の構成比較の成果として保持する。
- 根拠：apple-designの階層/近接とbaseline-uiの簡潔な状態表示を継続。[Appleのタブ設計](https://developer.apple.com/design/human-interface-guidelines/tab-bars?changes=l_1__4&language=objc)でも、タブは移動先を分けるもので操作ボタンの代用ではない。Homeを統合する判断は本製品の役割重複からの提案で、ガイドが統合を必須にしているわけではない。
- 確認済み/未実装/次の小作業：主担当が現行の個人/共有・処理状態・M12メモ・AI参照の残件と照合。独立レビューで今回の限定文書差分に重大/中の指摘なし。`node scripts/check-docs.mjs` は48ファイル・498参照で成功、対象文書の `git diff --check` も成功。画像更新/実機/録音/API/外部送信は未実行、commit/push/mergeなし。次はHome統合案の採否と行き先未設定の扱いを決めて、記録カード1件と参照選択の遷移を比較する。


### 全ページの画像展開（2026-09-14、デザイン検討案）

- 依頼/段階：ユーザーの「今の段階ですべてのアプリ画面をskillsで画像生成」に従うK02準備の静止画設計。従来の「Home一枚→承認後に全画面」という画像生成順序は今回の明示依頼で更新した。製品実装への着手・デザインの採用を意味しない。対象版は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。既存差分と並行した資料整理を保持し、今回の編集先は画像フォルダのF系列・閲覧用HTML・本節。
- 正本/受入：AGENTS、下の最新構成案、MVP_SPEC §3〜7/9/15/16、ロードマップのUI検討（K02準備）を照合。ユーザー決定のHome、人名→AIトーク/アイコン→人別記録、トーク内の外部依頼を反映。M01〜M09/M12〜M15とU01〜U09/U14に相当する主要導線・補助画面を比較でき、個人/共有、原文/AI、相違両候補、本人訂正/他者指摘、待機/失効を混同しないことを画像の受入観点にした。旧ToDo/日次/独立連携タブは追加しない。
- 成果：**17枚・68画面例**。[画像一覧と生成指示](../product/prototypes/design-directions/f-screen-gallery.html)で修正版だけを順に閲覧できる。PNGは同じ既存画像フォルダに保存。以前のA〜E系列とF系列の修正前版は削除せず、採用候補は以下のリンク先に限定する。17の本人記録/範囲選択は06の本人確認の前に通る補助画面。

| 番号 | 現在の画像 | 収録画面/代表状態 |
|---|---|---|
| 01 | [Homeとトーク](../product/prototypes/design-directions/f-01-home-talk-v1.png) | Home／人の一覧／AIトーク／設定 |
| 02 | [録音から個人記録へ](../product/prototypes/design-directions/f-02-recording-v2.png) | オフライン／録音中／端末保存済み・未送信／保存失敗 |
| 03 | [記録を探す](../product/prototypes/design-directions/f-03-archives-v1.png) | 人別テキスト／人別音声／全記録／条件0件 |
| 04 | [原文と出典を確かめる](../product/prototypes/design-directions/f-04-sources-v2.png) | 個人の書き起こし／共有の相違／双方の出典／自分の訂正 |
| 05 | [保存と書き出し](../product/prototypes/design-directions/f-05-saved-export-v2.png) | 他者への指摘／保存一覧／本人メモ／PC向けテキスト |
| 06 | [一緒にまとめる](../product/prototypes/design-directions/f-06-sharing-setup-v3.png) | コード表示／コード入力／相手と範囲の確認／共有許可 |
| 07 | [共有の待機と失効](../product/prototypes/design-directions/f-07-sharing-states-v2.png) | 相手待ち／確認期限切れ／範囲の再確認／利用不可 |
| 08 | [AIトークの状態](../product/prototypes/design-directions/f-08-ai-states-v1.png) | 出典の参照／参照なし／生成中／失敗 |
| 09 | [外部への依頼もトーク内で](../product/prototypes/design-directions/f-09-chat-services-v2.png) | Notion作成確認／Drive成功表示例／予定登録確認／結果不明 |
| 10 | [設定と共有管理](../product/prototypes/design-directions/f-10-settings-v2.png) | 接続サービス／アクションボタン／共有管理／保持期間 |
| 11 | [初回利用と共通状態](../product/prototypes/design-directions/f-11-entry-recovery-v2.png) | 初回Home／マイク拒否／読込／原音期限切れ |
| 12 | [指摘への対応と中断](../product/prototypes/design-directions/f-12-review-interruption-v1.png) | 届いた指摘／対応判断／中断後の保存／文字期限切れ |
| 13 | [Androidの通常表示](../product/prototypes/design-directions/f-13-android-v2.png) | Home／AIトーク／不透明な出典／録音中 |
| 14 | [アカウントと補助画面](../product/prototypes/design-directions/f-14-account-filters-v2.png) | ログイン入口／ログアウト確認／絞り込み／あとで見る |
| 15 | [進行中と再接続](../product/prototypes/design-directions/f-15-progress-connection-v3.png) | 共通録音帯／端末保存中／書き起こし失敗／接続して戻る |
| 16 | [取り消しと削除の確認](../product/prototypes/design-directions/f-16-confirmations-v2.png) | 本人記録削除／保存解除／今回共有取消／サービス切断 |
| 17 | [持ち寄る記録と範囲](../product/prototypes/design-directions/f-17-record-scope-v2.png) | 本人記録選択／範囲と発言位置／無効・期限切れコード／発言0件 |

- skills/生成方法：apple-designの階層・近接・一貫した操作と、baseline-uiの余白・単一主色・局所エラーを共通指示へ適用。imagegen skillに従って内蔵画像生成を画像ごとに実行し、01を視覚的な参照として展開、修正にも同ツールを使用した。CLI/APIキー経由の画像生成や、HTMLによる代用画像は使っていない。HTMLは生成PNGの閲覧用のみで、アプリの操作モックではない。生成指示と最終修正指示を同HTMLへ収録し、別の管理資料は追加しない。
- 共通プロンプトの要点：390×844相当の縦画面4つ、白/薄灰/濃い文字と青の主操作、システム書体、本文17pt/48×48操作域を設計目標とした。実際のPNGの寸法・字形・濃淡は実装トークンの確定値ではなく、装飾用のグラデーション/発光は採用しない。赤は録音/破壊操作/失敗、相違等は文字でも説明する。Glassは主タブ/U02操作面/録音帯だけ、本文/出典/通常シートは不透明。Android/非対応/透明度低減の通常面は13で比較する。
- データ/未定義の境界：全画像に「デザイン検討案・架空データ」「実動作未確認」を表示。K01の正式schema/fixtureは未完成で、保存済み・共有済み・Drive作成済み等は状態を見分けるための架空例。AIの参照単位・選択・履歴保持、相手未設定の記録を扱うAIルーム、共有記録の外部書出し許可と外部コピーの失効、実行前確認の条件は確定していない。08は出典表示/配置の案、09の外部書出しは本人記録の例であり、人別ルームへの自動分類や共有データの外部送信を許可する決定にしない。未定義に依存する正式遷移/契約/実装は停止したまま。
- レビュー/修正：主担当は全画像を実見。独立担当2名が分担して全ボードの表示を正本と照合した。オフラインの共有タイトル、録音の赤表示/保存状態、持ち寄り時の本人・声・範囲と共有許可の分離、タグ/文字数、取消理由の推測、未定義の通知/背景保存保証、本人と相手の誤用、架空記録の種別/時間、音声位置の推定、取消対象を修正。最後に本人録音03:42に対して双方の参加終了/共有範囲を03:36に揃え、本人/相手の参加終了を分離した。修正後の独立再レビューが完了し、限定範囲で重大・中程度の未解消指摘なし。静止画での確認であり、正式契約や製品動作の検証ではない。
- 自己確認：画像一覧の17参照が全て存在し、外部リソース参照はなし。本文の一般的な日本語と主要な表示境界を目視確認。PNGの参照、`node scripts/check-docs.mjs`（48文書・498ローカル参照/使用アンカー）と対象の`git diff --check`は成功。HTMLの実ブラウザ表示/操作は未検証。
- 未実装/未実行：アプリコード・型・API・正式契約の変更、実機操作、Dynamic Type、タップ領域実測、実Glass/アニメーション、アクセシビリティ実測、録音/音声処理/技術選定、製品データの外部送信。Go君の音声選定や他担当案の確定へ進んでいない。commit/push/mergeなし。
- 判断待ち/次の小作業：まず01のHome/トークの配置・青の方向と、名前/アイコンの異なる入口をユーザーが比較する。次に未定義のAI参照/外部書出し条件を決め、採用した部分をMVP_SPECへ同期してから、選択画面の長文/文字拡大/入力時・実端末の動きへ進む。今回の静止画をそのまま完成UIや全状態の組合せ検証として扱わない。


### 不要な移管資料の削除（2026-09-14）

- 依頼/段階：57ファイルの必要性を評価した前の判断に基づき、ユーザーが不要分のリポジトリからの削除を指示。`hackathon-planning/` 17、`hackathon-consultation/` 23、`codex-research/` 4、初回移管用CJS 2本の計46ファイルを削除し、`hackathon-pitch/` の11ファイルを保持した。現行仕様・アプリコード・他の未コミット変更は対象外。
- 変更/証拠：削除対象を前回の移動一覧と照合し、全46ファイルのSHA256が一致するZIPバックアップを今回タスクのリポジトリ外の出力先に保存してから削除。READMEとCodexガイドの参照を整理。履歴中の旧資料への言及は当時の記録として残す。下の57ファイル移動記録は、この削除より前の状態。
- 確認：削除対象の不存在と発表準備11ファイルのSHA256不変、`node scripts/check-docs.mjs` の47文書・412ローカル参照/使用アンカー、発表コーチの `-Check`、`git diff --check` は成功。アプリ実装の変更・音声処理・commit/pushは未実行。Codexアプリのプロジェクト参照先の残件は別件として維持する。

### 参考調査に基づくUI/UX・画面構成案（2026-09-14、未採用）

- 依頼/段階：参考サービスを踏まえた画面構成の提案。対象はHome、人ごとのAIトークと記録、出典、外部保存。編集先は本節のみ。直下の調査、MVP_SPEC §4〜7/16、直近のユーザー決定を照合し、同時進行の資料整理と既存差分を保持する。完了条件は画面の責務・主操作・入口/戻り先・状態・未決定依存を読み取り比較できること。採用仕様/API/契約/コード/画像は変更しない。
- 継承する決定：会話のコンテキストを外部へ渡すハブ、Homeへの改名、人の名前/行→AIトーク、アイコン→その人との記録、テキスト/音声の分離。Google Calendarへの依頼による予定登録、Drive/Notionへの要点＋全文の新規保存、PC向けテキスト書出し。追加のユーザー指摘に従い、外部連携はAIトーク内の自然言語操作に含め、独立した連携タブを設けない。下記の2タブ全体、配置、補助入口、実行確認の方法は提案であり、了承済みの範囲を広げない。

| 下部タブ案 | 一つの主な役割 | 最初に見せるもの |
|---|---|---|
| Home | 記録を始め、直近の記録を開く | 上にHomeと設定、不透明な「記録を始める」、最近の記録を例として3件。タイトル/日時/個人または共有/必要な状態を一行〜二行で整列 |
| トーク | 人ごとの記録を使ってAIと話す | 決定済みの人物一覧。名前/行はAIトーク、アイコンはその人との記録へ。主要導線を別のタブへ移さない |

起動先はHomeの案。主タブはアイコン＋文字、録音ボタンを擬似的なタブにしない。外部操作の進行/結果は依頼したAIトーク内に置き、接続先の管理は通常設定へ。独立した連携結果一覧は追加しない。Home/人別の記録は同じ対象への入口とし、記録や状態を複製しない。

| 画面 | 配置・主操作の案 | 入口/戻り先と境界 |
|---|---|---|
| Home | 記録開始＋最近の記録。未送信/失敗/確認待ちは必要なときだけ対象行の近くに表示。連携ロゴ一覧、AI質問集、日次/ToDoカードを常設しない | 最近の行は個人U03、共有U06へ。初回空は説明と同じ開始操作一つ。録音中は新規開始を隠し、全タブ共通の録音帯からU02へ戻る |
| 録音 U02 | 状態、経過/残り時間、停止を中心にする | アプリ内開始と設定済みアクションボタンは同じ本人録音へ合流。停止後は端末保存の成否を示し個人U03へ。停止と保存/処理成功を同一視しない |
| AIトーク | 上部に相手のアイコン/名前、「AIと話す」、参照記録の入口。中央に質問/AI回答、下に不透明な入力欄。外部操作カードは依頼時だけ表示 | アイコンは人別記録、回答の出典は個人/共有記録の該当箇所へ。閉じると直前の質問/位置へ戻る案。AI参照対象の決め方と履歴保持は未決定 |
| 人別記録 | 人物名、「テキスト／音声」の切替、日時順の記録 | 音声は入力所有者を明示し、人物名から話者を推定しない。共有未成立を共有本文として開かない |
| 全記録の補助画面 | Homeの最近の記録の横に「すべて見る」を置き、相手未設定/個人のみの記録も探せる共通一覧へ | 独立した記録タブを増やさず、同じ詳細へ合流。人物に分類できない記録を消したり、仮のAIルームへ自動投入したりしない |
| 記録詳細 U03/U06 | 原文を主体、AIの要点は折り畳み。個人/共有・相違・不明・出典を表示。PC向けテキスト書出しを補助操作にする | U03「一緒にまとめる」→U04→U05→成立後U06を維持。外部サービスで使う入口は対象記録を明示したAIトークへ合流する案。相手未設定の記録をどのAIトークで扱うかは未決定。相手との共有許可とは別の操作。戻ると呼出元の一覧/AIトークの位置を維持 |
| 出典/訂正 U07/U08 | 高い不透明シートで双方の原文を読み比べる。自分は「文字を訂正」、他者は「気になる点を伝える」、原音再生は補助操作 | 文字拡大/長文では全画面相当まで広げる案。閉じると対象発言へ。原音期限切れでも有効な文字まで空表示にしない |
| AIトーク内の外部操作 | 自然言語の依頼→必要な確認カード→実行中→実際の結果リンク/失敗を同じトーク内に表示する案。Drive/Notionは対象/保存先/題名/要点＋全文、Calendarは予定項目/登録先を示す | 独立した操作ページや結果一覧を増やさない。Calendarへ全文を送る案ではない。取消/失敗でも依頼を残し、結果不明なら成功/未実行と断定せず状態確認へ。確認カードを出す条件は採用待ち。結果/履歴の保持、外部コピーの取消後の扱いは未決定 |
| 設定 U09の連携管理 | Google Calendar/Drive/Notionの接続/解除と接続アカウント。未接続/切断時はトークから同じ接続設定へ開く | 接続後は元の依頼へ戻す。接続成功を保存成功に置き換えない。PCへのテキスト書出しは記録からのファイル操作として保持し、PC同期サービスを追加しない |

- 優先順位は利用仮説：時間を逃さず操作できる録音を最優先、人ごとのAI対話/履歴閲覧を次にし、外部保存は対象を選んだ後、接続設定は初回/切断時に置く。外部へ渡す価値と設定操作の頻度を同一視しない。名前とアイコンの異なる遷移は維持し、初見での発見性を検証する。
- 状態：読込は対象領域のスケルトン、初回空は次の操作一つ、条件0件は条件解除、失敗は対象近くで再試行。相違は両候補、話者/順序不明は不明のまま。共有前の相手待ちは個人側、成立後の再確認は既存規則どおり本文を伏せる。期限/取消で使えない本文・出典・AI派生を古い成功表示から復活させない。人別記録が空である理由を初回録音前と混同しない。
- 見た目：Granolaの余白、Nikeの重要情報の強調、LINE/Slackの整列した一覧をapple-design＋baseline-uiで統一する案。白/淡い無彩色面、濃い文字、主色1色。本文17pt、48×48以上を設計目標にし最終色はHome画像で判断。Glassは主タブ/U02操作面/共通録音帯だけ。開始ボタン/本文/AI回答/出典/通常シートは不透明。
- 動き：押下の反応は即時、短いフィードバックは200ms以内を目安にする案。操作結果は実際の成否に対応。iOSは標準的な画面遷移/シート、Androidは標準の戻る操作と通常明色面。演出中も停止/戻るを妨げず、動き低減は静的切替、透明度低減は不透明面。常時アニメーション/装飾用グラデーションは追加しない。
- 受入の読み取り：Home→録音→保存失敗/未送信→個人、人→AI→出典→同じ質問、人→アイコン→テキスト/音声、個人→相互確認→共有、AI/記録→外部保存→結果の5導線で役割と戻り先を確認。UI検討用データで録音/共有/API/外部保存の成功を代替しない。
- 判断待ち/停止条件：Home/トークの2タブ全体、Homeの最終優先順位、補助入口、外部実行の確認方法は採用待ち。AI参照範囲/保持、相手未設定の記録を使うAIトーク、共有記録の外部書出し可否/コピーの扱いは意味の決定が必要で、その依存動作だけ保留。MVP_SPECの旧構成との採用同期は別の仕様変更。新しいAPI/worker/MCP担当をGo君に自動割当しない。
- 確認済み/次の小作業：主担当が外部操作をAIトークへ集約した最終案を再確認し、独立担当が本節の5導線と個人/共有・出典・Glass・未決定の境界を紙面で照合して限定範囲で指摘なし。`node scripts/check-docs.mjs`は47ファイル/412ローカル参照・使用アンカー、対象の`git diff --check`は成功。操作性/実動作の証拠ではない。提案確認後、まずHome一枚を画像化し、デザイン承認後に全遷移先/状態を画像化する。未実装/未実行は画像生成、製品コード/契約/API、実機/実Glass、外部送信、commit/push/merge。

### 参考サービス・モバイルUIの調査（2026-09-14）

- 依頼/段階：参考にすべきサービスとアプリUIの調査。対象はHomeの情報量、人ごとのAIトーク、元記録/出典への戻り方、外部への引き渡し。成果は以下の比較と次の画像設計への提案で、編集先は本節のみ。既存差分と同時進行の資料整理を保持する。公開された公式ガイド/画面例を読み、取り入れる点と仕様へ持ち込まない点を分けた時点で調査を終了する。
- 比較の前提：直近のユーザー決定である「会話のコンテキストを他アプリ/AIへ渡すハブ」「Homeへの改名」「人の行→AIトーク、アイコン→その人との記録、テキスト/音声の分離」「Google Calendarへの依頼による予定登録、Drive/Notionへの要点＋全文の新規保存、PC向けテキスト書出し」を使用。先行節/MVP_SPECに残る旧タブ、ToDo/日次/自動登録等の同期は別の仕様整理作業とし、本調査で採用済みの範囲を増やさない。MCPの採用方式、Home/トーク/連携の全タブ構成、外部実行の確認手順は未確定。
- 方法：apple-designの階層/近接/即時の反応/一貫した戻り先、baseline-uiの単一主色/空状態の明確な操作/局所エラーを評価軸とした。Web向けの実装指定や広いGlass推奨はRN＋ExpoとMVP_SPECの採用範囲を上書きしない。公式画面の閲覧と操作ガイドの読解であり、各アプリのログイン後の実操作・利用頻度・使いやすさの実測ではない。

| 参考対象と一次資料 | 確認した内容 | 今回の製品への応用案/境界 |
|---|---|---|
| [Granola モバイル](https://docs.granola.ai/help-center/ios/getting-started) | 公式iPhone画像は予定/過去ノートの短い一覧と下部のAI質問/新規ノート操作。ガイドではノートを使うAIチャットを説明 | Homeで主操作と直近の内容を絞る参考。予定一覧や独自書体は必須にしない。現行ガイドではChatはiPhoneのみ、Notion等の連携はデスクトップが必要。スマホ内の外部保存が検証された例とは扱わない |
| [LINE トーク構成](https://guide.line.me/ja/update/chat-renewal2025.html) | 2026-08-12更新のガイド/掲載図で、同じトークタブ内にトークと友だちの切替を置き、Homeとの往復を減らす | 人を起点にAIと記録へ戻る構成の主要参考。今回のアイコン→記録は本製品独自の指定で、LINEと同じ挙動と説明しない。発見しやすさは後で検証。広告/付随サービス/人間へのDMを追加しない |
| [Plaud 書き出し](https://support.plaud.ai/hc/en-us/articles/50835453223705-Export-recordings-transcripts-and-summaries) | 2026-09-09更新。記録詳細の共有入口→対象内容→形式→書出し。原音/文字起こし/要約を区別し、文字起こしの時刻/話者ラベルを選べる。掲載画像でSources/Notesと本文下のAI質問入口を確認 | 外部へ渡す内容を先に明らかにする参考。今回の初期値はユーザー決定の要点＋全文、PCはテキスト。多数の形式やマインドマップは追加採用しない |
| [NotebookLM 公開モバイル例](https://blog.google/innovation-and-ai/products/notebooklm-app/)・[現行チャットガイド](https://support.google.com/gemininotebook/answer/16179559) | 2025-05-19のモバイル紹介は資料への質問とOS共有からの追加を説明。現行ヘルプはGemini Notebook表記で、参照する資料の選択と引用から元箇所へ戻る機能を説明し、モバイルの機能差も注記 | AI回答の近くに出典、上部に参照記録の入口を置く参考。古い紹介画面を現行の全機能として扱わず、教材生成等を本製品へ増やさない。AIが全履歴を読む規則は未採用 |
| [Apple ボイスメモの録音](https://support.apple.com/ja-jp/guide/iphone/iph4d2a39a3b/ios)・[文字起こし](https://support.apple.com/ja-jp/guide/iphone/iph00953a982/ios) | 録音/停止と進行中表示、記録選択後の文字起こし/コピー、テキストから音声位置への対応をガイドで確認 | 録音開始/停止の明確さと記録から内容を段階的に開く基準。AppleのASR、ライブ文字起こし、iCloud同期は追加採用しない |
| [ChatGPTのアプリ呼出し](https://help.openai.com/en/articles/12584461) | チャットでアプリを指定し、書込操作は権限/文脈に応じて確認する設計。参照した開発者向けMCPの案内はWeb限定 | 外部依頼→操作内容→実際の結果をチャット内に残すUXの参考。全操作に一律の確認が必須という根拠にはしない。独自RNアプリの接続/スマホ上のMCP動作確認と混同しない |
| [Nike Run Club](https://www.nike.com/nrc-app) | 公式ページ内のアプリ紹介図で、白地に距離を大きく、補助数値を小さく配置する視覚的な階層を目視 | 強調する情報を一つに絞り、余白と文字サイズで差を作る見た目の参考。録音時間をHomeの主役にする決定、写真/成績/ランキング機能の追加ではない。掲載図と現行実機は別 |
| [Slack モバイル](https://slack.com/help/articles/29788684062739-Customize-the-Slack-mobile-app) | ガイドではHomeの入口の表示/並べ替えと、会話一覧を最近の活動順にする選択肢を説明 | 整列した一覧と必要な項目の優先表示を補助参考にする。業務用の多数の入口/通知を本製品のHomeに並べる根拠にはしない |

- 調査からの提案（未採用）：主参考はGranola（記録→活用）、LINE（人を中心とした移動）、Plaud（外部書出し）。出典の確認はNotebookLM、録音の明確さはボイスメモ、文字/余白の強弱はNike、一覧の整理はSlack、外部依頼の見せ方はChatGPTを補助にする。一社の全体構成を複製せず、各操作がどこに属するかを揃える。
- Homeへの示唆：最初の比較案は「録音開始＋最近の記録」を基本に、録音中は同じ主領域を進行/停止へ切り替える。未送信/失敗等は該当するときだけ近くに示す。連携先のロゴ一覧、AI質問集、複数の成果カードを常設しない。何行見せるかやトーク再開の入口は画像で比較する。使用頻度は仮説であり、未計測の数値で順位を断定しない。
- 維持する境界：採用済みの人→AIトーク/アイコン→記録を変更しない。個人/共有、AI生成/原文、相違両候補、話者/順序不明、期限/取消、自分の訂正/他者への指摘を装飾で隠さない。Glassは主タブ/録音操作/録音帯のみ、本文/出典/開始ボタンは不透明。先行画像の承認や新しい色の決定と扱わない。
- 確認済み：主担当が公式資料を読解し、Granola/LINE/Plaud/Nikeの掲載画面を目視。独立担当が本節と既存仕様、Granola/OpenAIの公式端末差を照合し、限定範囲で指摘なし。主担当もCalendarの予定登録とDrive/Notionの要点＋全文保存を明確に区別して再確認した。独立担当による画像の再目視/実機操作は未実行。`node scripts/check-docs.mjs`は47ファイル/416ローカル参照・使用アンカー、対象の`git diff --check`は成功。外部URL/製品動作はこの文書検査の対象外。未実装/未実行：画像生成、製品UI/型/API/契約変更、実機/実Glass/文字拡大、実音声、外部接続/製品データ送信、commit/push/merge。
- 判断待ち/次の小作業：今回の推奨を材料にHomeの表示優先順位を決め、まずHome一枚を画像化する。人名とアイコンの異なる遷移を初見で発見できるかを検証項目にする。連携を下部タブにする価値、AI参照範囲、共有記録の外部書出しと失効後の扱いは引き続きユーザー判断。意味が未定義の部分だけ止め、確定した領域の画像検討は続けられる。

### プロジェクト配下への資料移動（2026-09-14）

- 依頼/段階：ユーザー指定により、親の `myApp` 直下に作成した関連資料を `opeai-hackathon` 配下へ移動。資料整理と参照先修正であり、K/M/Uの採用仕様や製品実装は変更しない。対象版は `codex/rn-expo-parallel-handoff` / HEAD `70e936a`。開始時のアプリ・仕様・画面案の未コミット変更を保持。
- 変更：`codex-research/`、`hackathon-consultation/`、`hackathon-pitch/`、`hackathon-planning/` と初回移管用CJS 2本、計57ファイルを同名で移動。READMEへ入口を追加し、資料・登録済み発表コーチの絶対パスとCodexガイドの参照を更新。旧企画資料と初回共有スクリプトは履歴として保持し、現行の `docs/` を上書きしない。
- 自己確認：57ファイルすべての移動直後のSHA256一致を確認。その後の差分は移動先の参照修正を行った7ファイルに限定し、他50ファイルは同一内容。移動資料31文書の105ローカル参照、`node scripts/check-docs.mjs` の47文書・416ローカル参照/使用アンカー、CJS 2本の構文確認、発表コーチの `-Check`、`git diff --check` は成功。アプリ機能テスト、実音声処理、独立レビュー、commit/pushは未実行。
- 対象外：`audio-validation-local/` は既存の音声保管条件に従って共有リポジトリ外に保持。別Git作業ツリー `opeai-hackathon-mvp-pr/` と `opeai-hackathon-platform-merge/`、他プロジェクトは移動しない。
- 残件：CodexのプロジェクトAPIでは既存プロジェクトの参照先を変更・読み戻し済み。ただし起動中のデスクトップアプリが保存済み設定を旧パスで上書きし、アプリ側の一覧はまだ `myApp` を表示する。終了後に対象プロジェクトの参照先だけを修正する `Finish-CodexProjectMove.ps1` を今回タスクの出力先に用意し、読み取り専用の `-Check` で対象と変更先を確認済み。アプリ終了後の適用・再起動後の表示確認と、既存タスクの作業ディレクトリ変更は未実施。

### 機能の重複を整理する情報構造案（2026-09-13）

- 依頼/段階：ユーザーの「機能を構造的にMECEに整理すれば使いやすくなるのでは」という指摘を受けた情報設計。対象はM01〜M15とU01〜U15、M15の部屋。既存変更を保持し、本節だけに構成案を記録する。機能/タブ/権限の削除や採用変更、画像/コード作成は行わない。
- 整理基準：機能は「何を対象に、何を変える/得るか」で主担当を一つにする。以下はM01〜M15を各一度だけ対応付けた機能棚卸しであり、7タブを作る提案ではない。画面への入口は利用場面に応じて複数置けるが、同じ内容を別のリスト/状態として管理しない。

| 機能の責務 | 対応する既存機能 | 主な操作場所/得られるもの |
|---|---|---|
| 記録を取得する | M01 | U02/U03。本人の録音開始/終了と端末記録。今日/記録/アクションボタンは同じ機能への入口 |
| 共同の会話を成立させる | M02/M03/M04 | U04/U05、結果はU06。入力の持ち寄り・本人/範囲/共有確認・統合。個人記録とは別の成立条件を保持 |
| 内容を理解・検証する | M05/M06/M13 | 個人はU03、共有はU06/U07、訂正はU08。U15は確認作業の一覧で、各対象の確認/訂正場所へ戻す |
| 記録を見つける | M14 | U01の日付/確認済み相手フィルタと、U14内の既存保存項目の絞込み。既存対象を選ぶ機能で、別の記録コピーを作らない |
| 再利用する内容を保存・注釈する | M12 | 保存操作→U14内の保存項目管理。SavedItem/タグ/本人メモ。AIの質問やAI会話履歴とは分ける |
| 記録から得た内容を使う | M09/M10/M11/M15 | 予定はU10、ToDoはU13、日次はU12、AI会話はU14の部屋。それぞれ予定/本人の作業/日次結果/AI応答という異なる成果を扱う |
| アクセスと保持を管理する | M07/M08 | U09の共有取消/継続解除/保持説明、対象記録の削除。取消・削除・期限とその派生物への反映 |

設定U09/U11、認証/マイク権限、処理の準備/失敗/再試行は各機能を支える共通要素。通常/空/読込/失敗/相違/話者・順序不明/確認待ち/期限切れは機能の分類とは別の状態として扱い、状態ごとの新しい主タブを作らない。共有未成立は個人側のU03〜U05、共有成立後の内容検証はU06/U07で、一般の確認一覧を共有許可の代わりにしない。

- 画面の責務案（未採用）：今日U12は日次と必要な操作への入口、記録U01は原本の履歴/閲覧/検証の入口、保存U14は保存内容の管理と人ごとのAI活用の入口とする。今日へ別タブの全機能カードを複製せず、必要な要約/リンクから同じ対象・主操作画面へ開く。ToDoはU13に一つのリストを持ち、今日や会話詳細から同じ項目へ遷移する。設定は共通の補助導線。3タブの改名/削除は未採用。
- 優先順位の決め方：時間を逃すと価値が下がる録音開始、進行中の録音状態/停止、その場の失敗回復や次へ進むための共有確認は該当場面で近くに置く。履歴閲覧・日次・AI対話は各目的の画面へ、設定や管理は必要時に開く。これは利用仮説で頻度の実測ではない。MECEの分類だけでホームの最優先や使いやすさの検証が完了したとは扱わない。
- 受入/確認：全15機能の主担当が一つずつ対応し、ToDo/保存/原本の独立した重複管理を作らず、複数入口から同じ操作/状態へ合流すること。独立担当が本節をMVP_SPECのM01〜M15/U01〜U15/§16と照合し、限定範囲で指摘なし。主担当も対応と境界を再確認。`node scripts/check-docs.mjs`は47ファイル/411ローカル参照・使用アンカー、`git diff --check -- docs/development/WORKFLOW.md`は成功。分類の網羅性の確認であり、操作性/実機/実APIの検証ではない。画像・コード・採用仕様の変更なし、commit/push/mergeなし。
- 判断待ち/次の小作業：人ごとの区切り、AI参照範囲、今日ホームの優先順位は引き続き未決定。次は「すぐ録音」「過去の内容を確かめる」「保存内容でAIと話す」の3用事について、最初の入口→主操作→完了/戻り先を紙面で追い、迷う分岐と余分な画面移動を修正してから画像化する。人物の振り分けや正式契約に依存する部分だけ止める。新しい機能を追加したり、既存機能を削ったりして分類の穴を埋めない。

#### LINEの構成を参考にした追加案（未採用）

- 調査/範囲：ユーザーの「LINEのアプリの構成を参考にするとどうなる？」への比較提案。2026-09-13に公式の[トークタブ更新](https://guide.line.me/ja/update/chat-renewal2025.html)（更新2026-08-12）で、トーク内の「トーク/友だち」切替によりホームとの往復を減らした構成を確認。[アルバムの入口](https://guide.line.me/ja/communication/create-albums.html)と[ノートの入口](https://guide.line.me/ja/communication/create-notes.html)は、トーク上部メニューから開く。これは公式資料の読取で、現行LINE実機の操作検証ではない。編集は本項のみ。
- 応用案：下部は「今日/記録/AIトーク」の3つ。「AIトーク」は現行「保存」の改名案で、起動先の今日/順序/既存機能を変える決定ではない。今日は日次とToDo/確認への小さな入口、記録は日付/相手から元会話を探す場所、AIトークは人ごとの部屋一覧を中心にする。保存項目全体の管理はAIトーク一覧の補助入口として残し、人物未分類の内容を失わない。人物の分類/部屋作成の意味はM15の確認待ちのまま。
- 部屋の案：上に人物名と「記録をもとにAIと会話」、参照内容を開く入口、中央に自分とAIのやり取り、下に不透明な入力欄。出典を押すと個人はU03、共有はU06/U07へ戻る。参照内容の確認は直接開けるようにし、保存項目のタグ/本人メモ等の管理は補助画面へ置く。LINEの部屋内メニューを参考にするが、共有ノートや相手へのDM、友だち登録必須、通話/スタンプ等を追加採用しない。人物の発言や録音スクリプトとAI回答を同じ履歴へ混ぜない。
- 録音/見た目：今日/記録の録音開始とアクションボタンは既存U02へ合流し、録音中の帯は全タブで維持。LINEの情報構造を参考に、見た目とOS差はapple-design/baseline-ui、RN＋Expo/明色/既定Glass範囲で設計する案。LINEの緑や付随サービスまで採用したとは扱わない。重要度/頻度と使いやすさは未実測。
- 受入/判断待ち：各タブの目的、人→AIルーム→参照記録の流れ、M12の保存/本人メモの継続、個人/共有と人間/AIの区別を主担当と独立担当が読み取り照合し、限定範囲で指摘なし。`node scripts/check-docs.mjs`は47ファイル/411ローカル参照・使用アンカー、対象差分の`git diff --check`は成功。操作性・実機・APIは未検証。改名/配置・人物の単位・AI参照範囲・履歴は未確定。次はこの案と現行名を比較し、入口と戻り先を確認して画像案へ渡す。検討案のためMVP_SPEC/画像/コード/契約は変更せず、commit/push/merge/製品データ送信なし。

### 保存したコンテキストを使う、人ごとのAI会話（2026-09-13）

- 依頼/段階：ユーザーが保存ページをコンテキストの活用場所とし、AIとの会話を中心に選択。その後、人ごとのDMのようなワークスペースを指定。M15として体験の方向を追加採用する仕様設計。人物の意味と参照範囲を確かめる段階で、画像承認/実装完了ではない。
- 対象/編集先/受入：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`、既存未コミット変更を保持。MVP_SPECのM15/U14/旧除外/新§16、PRODUCT_COREの判断変更、ロードマップの追加依存、本節を編集。[MVP_SPEC §16](../product/MVP_SPEC.md#saved-context-chat)が正本。人を選ぶ→AIと話す→参照内容/原文へ戻る構成、本人へのDMとの区別、個人/共有・相違/不明・保持/権限を確認する。
- 決定/案：保存したコンテキストに基づく、人ごとのAIワークスペースを採用。上部に人物名/AI表示/参照入口、中央に会話、下部に不透明な入力欄を置くのは配置案。apple-design/baseline-uiを継続し、ToDo/日次等のカードを同じ一覧へ増やさない案とした。入力欄/回答/参照シートをGlass対象に加えない。現在のタブ名変更は未採用。
- 確認済み/未実装：既存M12/SavedItem・本人メモの非送信・§15.4の失効と今回の追加機能を照合。旧仕様の自由質問の一律除外を限定的に更新し、既存の計43受入だけでは追加機能まで完成としないことを明記。独立担当が新M15/旧除外/U14/§16、PRODUCT_COREの追加段落、ロードマップの追加段落を既存保存/失効規則と読み取り照合し、限定範囲で指摘なし。主担当も対象箇所を再確認。`node scripts/check-docs.mjs`は47ファイル/411ローカル参照・使用アンカー、`git diff --check`は成功。今回コード/型/API/契約/画像/依存は変更せず、AI生成/実音声/外部送信/commit/push/mergeは未実行。アプリテスト・操作性検証は実施していない。
- 判断待ち/影響/判断者：ユーザーへ「人」は会話した相手か録音所有者かを確認中。参照を保存した発言/整理に限るか元の会話も使うか、部屋への追加/解除、質問/回答の履歴・保持・次の質問への入力、件数/費用/再試行上限も未決定。人物の紐付けと参照内容/履歴の契約に依存する部分だけ停止する。全履歴の自動利用や既存本人メモのモデル送信を推測で追加しない。
- 次の小作業：人物の区切りの回答を受け、保存対象と部屋へ入れる操作を具体例一つで決める。その後に一覧→部屋→参照シートの画面案を確定。今日ホームの優先順位/情報量の再設計と承認は別の未完了事項として保持。デザイン承認→全遷移先の画像→実装の順序を維持し、API/worker等の追加担当をGo君に自動で割り当てない。

### iPhoneアクションボタンからの録音開始（2026-09-13）

- 依頼/段階：ユーザーが、iPhoneのアクションボタンへの割当から1回の操作で録音を始めたいと追加指定。仕様設計としてM01の開始入口へ採用。OSの実操作は長押し1回で、設定後に追加のアプリ内開始操作を不要にする。ホームの情報優先順位の回答/配置承認とは別の追加要件として扱う。
- 対象版/編集先：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`。既存未コミット変更を保持し、MVP_SPECのM01/U09/§4/関連AC、PRODUCT_COREの旧将来候補、ロードマップK03、本節だけ更新。既存画像/アプリコード/正式契約/依存/OS設定は変更せず、commit・push・mergeなし。
- 正本/決定：[MVP_SPECの追加開始入口](../product/MVP_SPEC.md#action-button-recording)。U09で設定案内、ホームに設定カードを増やさない。アプリ内開始と同じ本人帰属・5分・停止/保存/中断・オフライン条件を使い、開始ショートカットでASR/共有/外部送信を追加しない。開始要求中/録音中は重複を作らず、開始操作を停止トグルにしない。既存のアプリ内開始/停止も残す。
- 技術確認：Apple公式で長押しとショートカット割当、AudioRecordingIntentで録音中Live Activityを維持する要件、Expo公式でネイティブ拡張とdevelopment buildを確認。実装候補はiOS App Intents＋共通録音adapter、必要なLive Activityには状態/経過時間とU02導線のみ表示。提供者選定やGo君の既存音声探索には進まず、ネイティブ接続の実装担当は未確定としてロードマップに明記。
- 確認済み：資料の状態/境界を自己照合し、独立担当がM01/U09/§4/追加AC、PRODUCT_COREの更新行、ロードマップK03の追加箇所を読み取り確認、限定範囲で指摘なし。`node scripts/check-docs.mjs`は47ファイル/406ローカル参照・使用アンカー、`git diff --check`は成功。コード変更がないためアプリテストは再実行していない。これはOS資料の確認と仕様更新で、アクションボタンから本アプリの実録音に成功した証拠ではない。
- 未実装/判断待ち：設定案内、App Intents/Live Activity、録音adapter接続、対応機種/OS/ビルドでの起動/ロック/再起動後/権限/オフライン/二重呼出し/開始遅延の実測。マイク/本人帰属/OS制約を満たさない時は失敗・必要操作を返し、画面起動だけを成功としない。ホームの機能優先順位と再設計画像は引き続き検討中。
- 次の小作業/停止条件：追加入口を前提にホームを再整理し、U09設定案内とU02への合流も後の全画面画像の対象に含める。録音に関する実装/実機検証はK03で担当・対象端末・実録音の実行範囲を照合して着手。今回は実録音/ネイティブコード/外部送信へ進まず、画像から実装する既定の順序を保持する。

### 「今日」の情報量と優先順位の再検討（2026-09-13）

- ユーザー指摘：前案は一画面に機能が多く、直感的に使いにくそう。重要度/使用頻度を加味した設計かを確認された。前案のデザイン承認は受領していない。画像の誤字/表示整合レビューと、使いやすさの検証を区別する。
- 再評価：主担当は仕様項目の収容を優先し、録音開始・会話閲覧・日次生成・確認・ToDo・保存を近い強さで並べた。振り返る前から対象選択を全面表示し、保存タブと保存一覧も重複している。実測の使用頻度やユーザーテストを根拠にした配置ではない。apple-design/baseline-uiによる表面の整えだけでは、機能の優先順位は決まらない。
- 根拠/仮説：PRODUCT_CORE §1/D01/D04の「写真を撮るように自然に会話を記録」を根拠に、録音開始は時間を逃せない最優先、会話閲覧は記録後/再訪時、日次は一日の区切り、ToDo/保存は用事がある時、という利用仮説を置く。頻度の実測値/確定したユーザー行動とは扱わない。機能の重要度とホームへの常時露出を同一視しない。
- 配置の再提案（未採用）：U12起動/3タブを維持し、ホームは録音開始・今日の会話・振り返り入口を中心にする。日次の会話選択は入口を押した後の不透明シートへ段階的に表示し、対象/件数を確認してから生成する。自動生成へ変えず、0件/未準備/11件以上/未許可の扱いは維持。ToDoと確認は小さな一覧入口へ圧縮し、保存内容のホーム重複は除き既存の保存タブを使う案。低頻度でも共有確認など操作を進める条件は該当場面で必須のまま、原文相違の品質表示と混同しない。
- 判断待ち/停止範囲：ホームの最優先を「すぐ録音」か「振り返り・やること確認」に置くか、利用イメージを本人へ確認中。上記はMVP_SPEC §4/U12の情報配置と導線を改める提案で、採用仕様はまだ変更していない。機能削除や権限緩和として実装しない。画像の装飾修正・全画面生成・コード実装へはまだ進まない。
- 次の小作業：回答を踏まえて機能の優先順位/最初に見せる範囲/必要時に開く内容を決め、その構成で「今日」1枚を再設計する。録音開始に迷わないか、個人/共有の記録を開けるか、日次の対象確認を理解できるかを次の確認課題にする。これはユーザビリティテストの実施済み報告ではない。

### iOS寄りの「今日」ホームとOS別の表現方針（2026-09-13）

- 依頼/段階：Slack参考案にapple-designとui-skillsのbaseline-uiを併用し、デザインとエフェクトの実装方針を具体化する画像設計。ユーザーに対象を確認し、起動先U12「今日」1画面を選択。iOS/Androidの表現を分けてよいが、今回はiOS画像1枚のみ。デザイン承認→全遷移先/必要状態の画像化→画像に基づく実装、というユーザー指定の順序を守る。
- 対象版/編集先/受入：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`。未コミット変更と既存A〜D画像を保持し、既存design-directionsへの画像追加と本節を編集。正本はMVP_SPEC §4のU12/共通UI/Glass、§6の状態表示、§15.2/15.3、AC15/A10〜13、ロードマップK02/K09。日付・対象選択・生成前の入口・確認/ToDo/保存・記録開始・3タブを読み取れ、個人/共有と日次生成/録音開始を混同しないことを確認する。
- 画像の前提：ログインと日次タイムゾーンの初回確認が済んだ通常利用を示す9月13日の人工例。個人「帰り道のメモ」18:30と共有「週末の展示の相談」14:10は別の利用可能なContextViewで2件選択、日次は未生成。未完了ToDoと保存は本人が既に追加した場合の表示例で、自動採用を意味しない。K01正式契約/共有fixtureではなくUI検討用の架空データ。初回タイムゾーン確認・他状態は今回の1画面には含めない。

以下は今回の画像に対応する**実装方針案**。既存の機能/Glass仕様は確定済みだが、配色・配置・動きの最終採用は画像承認後とする。

| 対象 | iOSの案 | Androidの案/共通条件 |
|---|---|---|
| 情報と実装の分け方 | RN＋Expoを継続し、共通データ/権限/状態/宛先とOS別の見た目を分離 | 同じ3タブ・内容・意味・操作を保持。OSごとに製品機能を作り分けない。変更が必要な部品だけOS別表示にする |
| 配色・面 | 背景`#F6F6F8`、本文面`#FFFFFF`、本文`#1C1C1E`、補足`#646469`。主色はSlack参考案の深い紫`#611F69`、淡い選択面`#F0EAF3` | 同じ配色で不透明な面を使用。赤/黄/緑は既存の状態用に限り文字/アイコンを併記。装飾グラデーション・発光・大きな装飾画像なし |
| 文字・余白 | システム書体。大見出し34pt、節18pt、本文17pt、補足14pt。左右20pt、間隔8/12/16/24pt、面の角丸18pt、ボタン16pt | システム書体、大見出し28sp・本文17spを起点。操作領域は両OS48×48以上、開始ボタン高さ52以上。文字拡大で行高/余白を増やし、本文を固定高で切らない。独自の字間調整なし |
| アイコン・下部固定 | iOS標準に沿う線画アイコンと大見出し。開始操作と3タブをセーフエリア内に分ける | Android標準に沿う線画アイコンとナビゲーションバー。各OS内では系統を統一。ラベルと選択状態は共通、ジェスチャー/3ボタンナビ領域を避ける |
| Glass | 今回は下部3タブの背景だけに明色regular。実装時はMVP_SPECのOS/API/コンパイル/透明度低減の全条件で判定 | Android/Web/非対応iOS/透明度低減では不透明面と境界線。録音操作/録音帯は別画面で既存仕様の範囲に限る。ヘッダー・本文・開始ボタン・出典は不透明。Glass自体や親面のぼかし/不透明度を独自にアニメーションしない |
| タップ・タブ | 押下開始時に即座に反応、離して確定、外へずらして取消可。主ボタンの縮小は0.98、戻り120ms、タブは選択表示の短い切替 | Androidは局所的な標準rippleを使い、追加の縮小を重ねない。独自の反応は200ms以内、transform/opacityのみ。文字や選択状態の更新を演出の完了待ちにしない |
| 遷移・シート | OS標準の戻る/進むと対称な出入りを使い、途中のジェスチャーを妨げない。大きな面の独自バウンドは加えない | Androidの戻る操作に追従。動き低減では追加の移動/拡縮を省き静的切替。今後のシートも不透明。標準遷移の時間を120msのタップ反応と同一視しない |
| 読込・失敗・空 | 読込は項目と同形の静的skeleton、失敗は対象操作の近くに理由/再試行。0件は次の操作1つを明示 | shimmerや常時ループで飾らない。未生成/未準備/失敗/0件は別表示。共有失効などの本文遮断はエフェクトより先に行う |
| 音・触覚・支援機能 | 装飾音は付けない。触覚は実処理が成功/失敗したイベントに限る設計とし、今回の画像/仮データでは成功触覚を発火させない | 触覚は端末/OS設定に従い、なくても文字で分かる。設定アイコン、会話選択、各タブへ名称/選択/無効状態を付け、戻った際の読上げ位置を保持する方針 |

- U12の導線案：日付選択→対象会話のチェックと件数→近接する淡色の「この日を振り返る」。チェック領域は選択変更、右のタイトル/矢印は個人U03/共有U06へ進む独立した48pt以上の操作領域にする。確認一覧はU15、相違行は対応するU07、ToDo行/一覧はU13、保存行/一覧はU14へ。ToDo行の記号は一覧アイコンで完了ボタンではない。「未完了ToDo」に「以前の分も含む」を併記。各節は最大3件＋一覧、件数増加/文字拡大時は本文をスクロールし、固定開始ボタンとタブの高さ分を確保する。日次0件/未準備/11件以上は§15.2どおりで、自動生成や対象の勝手な除外を追加しない。
- skillの適用境界：apple-designの階層/近接/即時反応とbaseline-uiの節度/安全領域/単一主色/短い反応を併用。両skillにあるWeb用Tailwind・motion/react・DOM/ARIAの指定はRN＋Expoの採用仕様に合わせてRNの配置/アニメーション/アクセシビリティへ対応付ける。Web用ライブラリ導入やRNからWebへの変更はしない。広い半透明化・字間変更・ぼかしアニメーションの例は本アプリのGlass制限とbaseline-uiを優先して使わない。
- 技術参照：[Expo GlassEffect公式](https://docs.expo.dev/versions/latest/sdk/glass-effect/)でiOS 26以上/非対応View/可用性判定とopacityの制約、[Android公式](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)で48dp操作領域と操作名を確認。これらのAPIを現manifestへ導入した証拠ではない。追加依存と実際の標準遷移はコード実装時にExpo互換性を確認する。
- 成果：[iOS「今日」ホーム・最終候補](../product/prototypes/design-directions/e-ios-today-v3.png)。1画面の画像として出力し、全遷移先/Android画像はまだ生成していない。初稿と中間修正版は保持。表の数値/色指定は実装時の基準で、生成画像の各pixel/文字寸法を保証するものではない。
- 確認済み/残件：初稿の独立レビューでP2=注記の可読性、P3=開始ボタンの色むらを検出。注記を明色の余白へ移し、v2再確認でP2解消。ボタンは2回の局所修正で均一化できず、端末枠を外したflat UIとして再生成。主担当と独立担当が最終v3を実見し、文言/個人共有/対象選択/未生成/各操作/注記の表示に新規指摘なし。**P3の薄い色むらは画像で未解消**であり、画像の完全合格とはしない。実装では下記の単色指定を使う。表現方針/OS差/段階/導線の限定文書レビューは追加指摘なし。`node scripts/check-docs.mjs`は47ファイル/403ローカル参照・使用アンカー、`git diff --check`は成功。コード変更がないためアプリテストは再実行していない。
- 生成方法/プロンプト：組み込みimagegenで生成/修正。「単一のiOS U12、390×844相当、SF系システム書体、白/深い紫、日付と2会話の選択、生成前の日次入口、確認/未完了ToDo/保存、固定開始操作、Glassは3タブのみ、正確な日本語、架空データ表記」。最終生成は端末の外枠/撮影風照明を取り除き、flat UI出力と単色指定を強調した。全文は本タスクの生成呼出しに保持。画像の色むらをGlassや装飾グラデーションの採用根拠にせず、実装のボタンは`#611F69`の単色とする。
- 未実装/判断待ち/停止条件：今回のデザイン採用、Android画像、全遷移先/全状態の画像、RN反映、実機での操作領域/文字拡大/読み上げ/Glass/動き。画面画像は保存・共有・録音・音声処理・APIの成功を代替しない。ユーザーのデザイン承認まで全画面画像化とコード反映へ進まない。機能仕様の意味に矛盾が新たに見つかればその依存部分だけ確認する。Go君の音声選定やAPI/worker担当案は今回決定しない。
- 次の小作業：今回の「今日」画像と上記表現方針をUI/UX担当が確認。承認後に全遷移先と必要な状態を画像で揃え、OS差がある画面も比較し、その画像を基に明示された実装範囲へ進む。今回アプリコード/正式契約/依存の変更、実音声処理、製品データ送信、commit・push・mergeなし。

### Slackを参考にしたモバイル画像案（2026-09-13）

- 依頼/段階：ユーザーがSlackをUIデザインの参考に指定。画像から方向を決める進め方を継続し、ロードマップ「UI検討（K02準備）」のU01/U06/U07を1枚の比較画像にした。参考方向の指定と、この画像の配色・配置の最終採用は区別する。
- 対象版/編集先：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`。既存の未コミット変更・A/B/C画像を保持し、既存design-directionsフォルダへの画像追加と本節だけを編集。MVP_SPEC・公開型/契約・アプリコード・依存の変更、録音/音声処理/API接続、commit・push・mergeなし。
- 参照/受入：[Slack公式のモバイル再設計記事](https://slack.design/articles/re-designing-slack-on-mobile/)と掲載画像を確認。2023年の設計事例を参照しており、最新版アプリの実機確認ではない。apple-designの階層・近接・操作の一貫性を適用し、MVP_SPEC §4/6の画面・状態・Glass、AC06/07/15の表示観点を維持。個人/共有、相違の両候補、話者不明と入力所有者、自己訂正/他者指摘が区別できることを受入条件とした。
- 成果：[Slack参考のモバイル案・修正版](../product/prototypes/design-directions/d-slack-mobile-v2.png)。白い本文面と深い紫、コンパクトな見出し、区切り線の記録一覧、発言ごとの読みやすい配置、高い不透明な出典シートを提案。記録は個人18:30の回答待ちと共有14:10、会話は土曜/日曜の相違と話者不明、出典は双方の原文と各操作を載せた。Slackのチャンネル/DM/投稿欄等の機能は追加していない。
- 表現の境界：390×844相当・本文17pt・操作48×48以上を設計目標とし、画像内に「デザイン検討案・架空データ」を明記。主画面は通常の明色タブ、別添の小図で同じ3タブのGlass表現案/通常面を比較。本文・出典は不透明。K01正式契約は未完成で、架空データはUI検討用に限り、保存・共有・訂正・指摘・録音・再生・APIの成功を代替しない。
- 確認済み：主担当と独立担当が初稿を目視し、U07の自分の原文冒頭が「原示」と読める誤字1件を検出。組み込みimagegenで「展示は土曜にしよう」へ修正し、双方が最終v2を実見。独立担当は誤字の解消と所有者/両候補/各操作の保持を再確認し、限定範囲で新規指摘なし。初稿v1と生成元も保持。`node scripts/check-docs.mjs`は47ファイル/402ローカル参照・使用アンカー、`git diff --check`は成功。コード変更がないためアプリテストは再実行していない。
- 未実装/判断待ち：この方向の最終的な配色・配置と全状態の画面展開。静止画では操作領域/遷移・文字拡大・読み上げ・実Glass・実機性能を確認済みにしない。機能の状態・共有・Glassに関する追加判断は下記の仕様確定を引き継ぎ、再び未定義扱いにしない。Go君の音声技術選定とAPI/worker等の担当案は今回確定しない。
- 次の小作業/停止条件：UI/UX担当がSlack参考案の見た目を確認し、その方向で通常・空・読込・失敗・相違・話者/順序不明・確認待ち・期限切れを該当画面へ展開する。個人→U03、共有→U06→U07を維持。画像からのコード反映は方向確認後。仕様の意味の矛盾が新たに見つかった場合だけ、その依存部分を止めて確認する。
- 生成方法/プロンプト：組み込みimagegenを使用。指示は「同倍率の日本語モバイル3画面、Slackモバイルに見られるcompact header/flat list/readable transcript、白・深い紫、通常ウェイトの本文、同じ架空の記録/相違/原文、主タブ3つ、原文ごとの自己訂正/他者指摘、本文/出典不透明、Glassの小さな比較図」。修正はU07 A原文の字形のみを指定。全文は本タスクの生成呼出しに残し、新しい管理文書は作成しない。

### 状態・共有・Glassの仕様確定（2026-09-13、追加判断確定）

- 依頼/段階：ユーザーがMVP_SPECの状態・共有ルール・Glass適用範囲を決め切るよう指定。現行MVP内の全画面に共通する意味・優先順位・許可境界を設計し、必要な製品判断を本人へ確認する。
- 対象版/編集先：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`。着手時のApp/APP_DEVELOPMENT/WORKFLOW/src/画像の未コミット変更を保持。採用仕様はMVP_SPECへ、関連方針/依存をPRODUCT_CORE・ロードマップへ同期し、既存wireframesの処理説明も更新。後続のユーザー指示により外部ASR利用方針を反映するが、提供者の選定、コード・正式contracts・実音声・外部実行は範囲外。
- 参照/受入：MVP_SPEC §3〜9/14/15、PRODUCT_CORE D03〜D17/S01〜05/O02〜09、ロードマップの着手判定。状態の同時発生、個人/共有の導線、許可/期限/旧版の遮断、Glass対象と代替が一意に読めることを確認する。技術性能の未検証を仕様未定義と混同しない。
- 確定済み：Glassは主タブ/録音中操作/録音帯に限定し開始ボタンは不透明（MVP_SPEC §4）。オフライン新規録音・本人への端末保存・未送信と保存失敗の区別・復帰後の認証を具体化（§3/4/8）。状態の別軸/表示優先順位/U06の0件と順序不明の区別、継続許可の片方解除を統一（§6）。OpenAI文字処理と外部文字起こしを利用し、外部ASR提供者はGo君の選定待ち。相手との共有許可は独立して必要。
- 処理同意の扱い：ユーザーが「処理同意はアプリ利用時点で承諾済みなのでアプリ内の判定実装は不要」と指定。同意取得フローを廃止し、MVP_SPEC §3/4/7/9/15とAC19から処理同意の画面・状態・レコード・API・manifest依存を除去。常にtrueのフラグ等へも置き換えない。U03の処理ボタン、認証/所有者/期限/upload ticket、共有許可、OSマイク権限、カレンダー許可は維持。PRODUCT_CORE・ロードマップ・既存wireframeを同期した。K01正式契約は未作成なので、既存製品APIの変更・migrationではなく仕様の修正。
- 時間規則の追加確定：ユーザーが残る2案を「両方それでok」と承認。接続成立からの共有確認24時間と、サーバーでの共有取消成立から最大5秒以内の画面反映をMVP_SPEC §6/9へ採用し、PRODUCT_CORE O05も同期。新承認回/音声期限上限/旧回答無効、要求開始からの表示期限/遅着応答/通信断/復帰を具体化し、§8の既存ACに受入観点を追加した。これは仕様の確定であり時間上限を実機で達成した証拠ではない。
- 確認済み/未実装：既定ACへ状態の組合せとGlass代替の受入観点を追記。文書参照検査は47ファイル/401ローカル参照・使用アンカー、差分空白検査は成功。同意判定を要求する旧モデル/API/manifest項目・目的別許可条件は現行仕様から除去し、その変更時にApp/src/APP_DEVELOPMENT/VALIDATIONの8ファイルのSHA-256一致を確認。公式Expo SDK 57資料でGlassの利用可否/透明度低減の個別判定を確認。K01正式契約、今回の状態/Glass/時間規則/外部処理方針の製品実装・人工時計テスト・実機・API・音声の検証は未実施で、従来モックはUI検討用の人工データのまま。今回もアプリコード/既存画像は変更せず、commit・push・mergeなし。
- 独立レビュー：外部ASR/同意と状態/Glassの限定レビューに加え、同意判定削除を§3/4/7/9/15で別途確認。日次A11に残った「目的別許可不足」の指摘1件を本人の選択対象と現在の所有/共有権限の検査へ修正し、独立担当がA11/AC19を再読して解消を確認。先行の広い共有監査は中断したため合格証拠にしない。そこで残った時間規則2点は今回の回答で確定し、独立担当が§6の期限/取消反映、§8追加4観点、§9.4のsnapshotを読取確認して限定範囲で指摘なし。主担当も最終差分を照合した。文書レビューと全機能・実機・実APIの検証は別。
- 判断待ち/依存停止：UI/UXの前提として確認していた状態・共有・Glassの追加判断は解消。見た目はA/Cの選択と状態別の配置・文言・操作導線の確認が残る。K01正式契約、Go君の外部ASR選定/保持条件、実接続の予算・環境等は後段の残件で、確定仕様に基づく画像検討は先行できる。API/worker等の担当案を確定したとは扱わない。
- 次の小作業：UI/UX担当がA/Cの方向を選び、その方向でU01/U06/U07の全状態を画像へ展開する。確定した状態と受入をK01の人工fixture設計にも渡す。画像での確認とRN実装・実操作・実Glassの検証は分ける。

### A/Cのモバイル画像再設計（2026-09-13）

- 依頼/段階：承認されたapple-design適用計画の画像制作。A/Cを同じ情報・機能のまま別々に再構成し、U01/U06/U07を各1枚の比較画像にした。採用仕様はMVP_SPEC §4とUI共通ルール、範囲はロードマップ「UI検討（K02準備）」。配色・配置は引き続き提案。
- 対象版/保持：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`。着手時のApp・APP_DEVELOPMENT・src内5ファイルと初回A/B/C画像の計10ファイルはSHA-256一致で保持を確認。既存WORKFLOWの結果を残し、改訂画像2枚と本節だけ追加した。ブランチ切替・commit・push・mergeなし。
- 成果：[A / SPORT MINIMAL 改訂版](../product/prototypes/design-directions/a-sport-minimal-v2.png)、[C / SOFT MODERN 改訂版](../product/prototypes/design-directions/c-soft-modern-v2.png)。Aは青の主操作と細線の一覧、Cは白い記録カードと一つにまとめた補助領域。両案とも本文の太さを抑え、出典を高い不透明シートにし、自己訂正と他者指摘を全幅で区別した。初回画像と生成元は保持。
- 共通の設計目標：390×844相当、本文17pt、操作領域48×48以上、システム書体。個人の相手待ち/共有会話、相違の土曜・日曜両候補、話者不明/入力所有者、3タブを保持。画像には「デザイン検討案・架空データ」、主タブのGlass表現案と同じ操作の通常面代替を付記した。本文・出典は不透明。寸法・タップ領域・Glass品質を静止画から実測保証するものではない。
- 確認済み：主担当と独立担当が日本語・情報の階層・状態/所有者・操作の区別と主要操作の見切れを目視確認。Aの本文が太い指摘とCのA原文冒頭の誤字を修正し、双方が最終2枚を再確認、明確な新規指摘なし。独立レビューは画像に限定し、実機・実操作の確認とは分ける。`node scripts/check-docs.mjs`は47ファイル/401ローカル参照・使用アンカー、`git diff --check`は差分空白検査が成功。
- 未実装/未確認：K01正式契約、選択案の全状態展開、RNへの反映、実Glass・文字拡大・読み上げ・操作領域/遷移の実測。架空データは保存・共有・録音・再生・APIの成功を代替しない。今回API/型/契約/アプリコード/依存の変更、実音声処理・外部への製品データ送信なし。コード変更がないためアプリテストは再実行しない。
- 判断待ち/次の小作業：UI/UX担当が改訂A/Cの方向を確認後、その方向で通常・空・読込・失敗・相違・話者/順序不明・確認待ち・期限切れを該当画面に展開する。個人→U03、共有→U06→U07を維持。U06の空状態と正式状態の対応など未定義の意味に依存する部分は保留。Go君の音声選定とAPI/worker等の担当案を今回確定しない。
- 生成方法/プロンプト：組み込みimagegenを使用（CLI/APIキー経由ではない）。共通指示は「日本語のモバイル3画面を正面・同倍率で比較、本文の可読性と状態の意味を保持、出典は高い不透明シート、主タブのGlass/通常面を併記」。Aへの指示は「白・青・区切り線の一覧、太字は主要見出し、本文は通常ウェイト」。Cへの指示は「白い記録面と余白、紫は主操作、装飾アイコン・大きな紫面・発光を取り除く」。最終編集はAの本文ウェイト/枠/U01ホームインジケーターとCの原文「展示は土曜にしよう」の字形訂正。全文は本タスクの画像生成呼出しに残し、新規管理文書は作らない。

### 画像から決めるモバイルデザイン（2026-09-13、初回3案）

- ユーザー指定：前回のWebアプリ的な見た目から、ランニング/ファッションアプリのようなシンプルで洗練されたモバイル専用の方向へ。すぐコードを作り替えず、画面画像の複数案→方向確認→状態別の正確な画面画像→実装の順にする。
- 対象/参照/編集先：U01/U06/U07、MVP_SPEC §4の画面構成/UI共通ルール。画像を既存prototypes配下へ保存し、本書のみ結果追記。前回の未コミットのモック/データ/テスト・開発手順を保持し、アプリコード・仕様・依存・音声/APIを変更しない。
- 比較案：Aはスポーツ的な太い文字と青の主操作、Bはファッション的な余白とモノトーン、Cは曲線と淡い紫の面。同じ個人待機行/共有会話/相違両候補/出典の自己訂正と他者指摘を載せる。明色、3タブ、本文/出典は通常面。これらは静止画のデザイン提案であり、採用/実動作/Glass品質の検証結果ではない。
- 成果画像：[A / SPORT MINIMAL](../product/prototypes/design-directions/a-sport-minimal.png)、[B / QUIET EDITORIAL](../product/prototypes/design-directions/b-quiet-editorial.png)、[C / SOFT MODERN](../product/prototypes/design-directions/c-soft-modern.png)。各画像はU01/U06/U07の3画面。生成元は保持し、比較用の最終3画像をリポジトリへコピーした。新規管理文書なし。
- 確認：主担当と独立担当が3画像を目視し、個人/共有・相違両候補・話者/入力所有者・自己訂正/他者指摘・3タブの意味と読める文言を照合。Bの出典リンクを再生風から文書アイコンへ、Cの折畳みを右矢印から下矢印へ修正し、両担当が再確認、明確な新規指摘なし。参照検査47ファイル/399ローカル参照・使用アンカーと差分空白検査が成功。全状態・実操作・実機の確認ではない。今回はコード変更なしのためアプリテストは再実行しない。
- 判断待ち/停止範囲：A/B/Cの方向をUI/UX担当が選ぶまで画像からのコード変更を止める。前回モックの2配色を最終候補として固定しない。次の小作業は選択案のU01/U06/U07を状態別に画像化し、文言と操作位置を確認すること。

### UI検討（K02準備）着手 2026-09-13

- 担当・小作業：UI/UX担当のU01/U06/U07状態別操作モック。最終デザイン・K02正式実装の完了判定は今回の範囲外。
- 基準版・既存差分：`codex/rn-expo-parallel-handoff` / HEAD `70e936a`、開始時未コミット変更なし。origin/mainをfetchして`c39307a`（PR #5）を確認。HEADとmainのtree差分なし、PR #5以降のmain追加コミットなし。ブランチ切替・mergeは行わない。
- 編集先：`apps/client/App.tsx`の開発用入口、`apps/client/src/{screens,ui,data,navigation}/`の検討用コード・確認、既存の本書/APP_DEVELOPMENT。依存・lockfile・共通設定・contracts・API/worker・音声adapterは変更しない。
- 参照・受入：MVP_SPEC §4〜8（M03〜08/M14、U01/U06/U07、AC06/07/15の表示部分、AC03/04/10/13/16の遮断/遷移部分）、§9.3の4fixture期待結果、§9.4、§15.2/15.4の根拠と失効。ロードマップ「UI検討（K02準備）」。個人→U03、共有→U06→U07、相違/不明の保持、空/読込/失敗/確認待ち/期限の区別を確認する。
- 未決定・停止範囲：contractsは存在せずK01未完成。データはUI検討用で正式schema/enumではない。配色/配置は比較案、UI/UX担当の採用前に固定しない。API/worker等の推奨担当は了承未確認。未定義の意味・矛盾が見つかればその依存部分だけ記録して確認し、独立部分を続ける。保存/共有/再生/録音/APIの成功、実機Glassの成立を模擬しない。

### UI検討の結果（2026-09-13）

- 成果：[起動・比較方法と状態別の表示/導線](APP_DEVELOPMENT.md#ui-study)。RNの開発用操作モックでU01/U06/U07、18状態＋U07内の読込/失敗/出典なし/版更新、2配色を比較できる。依存・lockfile・設定・正式契約・音声領域は変更なし。新しい管理文書は作っていない。
- 局所選択：UI専用repositoryと宛先関数へ分離し、公開型/サーバーenumを追加しない。固定人工ID/版/Unicode code point範囲と判定時刻を検証する。個人行はU03、共有行はU06。未実装宛先は戻れる仮画面。主タブ/本文/出典は通常明色面で、Glass導入済みとは扱わない。
- 確認済み（自己確認）：`node --experimental-strip-types --test apps/client/src/data/ui-study.test.mjs` 11/11、`npm run typecheck`成功。実行環境はWindows / Node 24.16.0 / npm 11.13.0で、指定のNode 22.20.0 / npm 10.9.0とは異なる。依存版は変更せず、指定toolchainでの再現は未確認。Nodeのmodule-type自動判定警告あり。
- ブラウザ確認：Expo開発サーバー `http://localhost:8093`。18状態、フィルタ0件/解除、個人U03/共有U06、整理→根拠→U07、訂正/指摘の宛先、原音未接続/期限、文字期限/旧版遮断、Escapeと出典を閉じた際の位置保持を確認。1280×720、390×844、320×568で目視し、狭幅の開始ボタン・タブ・配色操作、横はみ出しなし、U01操作領域48px以上を確認。初回の小画面パネル重なりを修正。これはRN Webの確認でiOS/Android実機の証拠ではない。
- 環境上の制約：fetchは通常sandboxの通信制限で失敗後、許可されたfetchで成功。Expoの最新DevTools取得はdotslashキャッシュ書込権限で失敗し同梱fallbackを使用、Metro/Web描画は成功。製品通信/実音声/外部送信の検証ではない。
- 独立レビュー：初回P2（出典の版更新後に旧版が再表示）/P3（日付降順の不一致）を修正。旧版をU01/U06/U07で遮断し、個人18:30→共有14:10に修正。同じ独立担当がコード/文書を再確認し2件解消・新規指摘なし。主担当も差分とブラウザ結果を照合した。独立担当は実ブラウザ/実機/APIを再実行していない。
- 文書確認：`node scripts/check-docs.mjs`は47ファイル/396ローカル参照・使用アンカー、`pwsh -NoProfile -File scripts/check-aidd-lite.ps1 -RepoRoot .`は16管理ファイルのmetadata/参照が成功。`git diff --check`成功。開始時の既存ファイル変更はAppの開発入口追加と既存2文書の追記のみで、API/録音/保存処理・依存・lockfile・設定の差分なし。
- 未実装：K01正式契約と共有fixture、K02正式接続、保存/共有/取消/訂正/指摘/録音/再生/生成/API、U03等の遷移先本体。実Glass、OS文字拡大、VoiceOver/TalkBack、両OS実機、production bundleは今回未実行。commit・push・mergeなし。
- 判断待ち：UI/UX担当が案A（青）/案B（深緑）と配置/余白を比較して選ぶ。U06の0件は空表示案のみで、終端成功/処理待ち/失敗のどれに対応するかを仮決定しない。K01担当が正式状態を具体化する際、未定義なら企画者に意味を確認するまで対応付けを停止する。API/worker/共通契約等の担当は引き続き推奨案で、Go君の了承・音声方式選定結果は未受領。
- 次の小作業：UI/UX担当がこのモックの配色・配置案を確認。その後、両担当が担当範囲/基準版とK01-aの対応表を確認し、K01-b受領後にK02-aで正式fixtureを接続する。今回のローカル差分を別PCへ共有済みとは扱わない。

### PR #5までの基盤・資料整理

- 公開準備（2026-09-13）：ユーザーからここまでのpush・マージを依頼。main d7c7d61を取り込み、今回の採用仕様と担当を維持して資料競合を解消。main由来の大会リンク・Supabase手順/スクリプトを保持し、元PCの開発環境記録は[履歴](../history/WORKFLOW_20260912.md#main統合時に保持した開発環境の記録)へ保存。以下の「未実施」は各文書作業時点の記録。

- **MVP 2.1のA/B/C採用・整理後の独立レビュー完了。** RN＋Expo統一、明色＋Glass、既存資料と基盤の統合は今回のユーザー決定。
- `apps/client` は既存MVP作業ツリー f461ab7 から取り込んだExpoスターター。製品機能・K01以降は未実装。
- 最新の分担：Go君が音声技術選定、企画者がUI/UX（ユーザー報告）。[並行作業](MULTIPLATFORM_DELIVERY_PLAN.md#parallel)に、fixtureで進めるUIと実音声処理の合流点を定義。API/worker等の担当案はGo君との最初の受け渡しで確認する。
- UI/UXはU01/U06/U07の状態別画面案から先行可。正式な契約テストはK01、同じfixtureによる画面完成確認はK02。音声選定の結論を待って全UIを停止しない。
- 今回は資料整理・スターター統合・検証まで完了。製品の実音声・実API・外部書込・配布・commit/pushは未実施。

## 担当更新（2026-09-13）

- 並行着手の具体化：入口は[着手判定と小作業](MULTIPLATFORM_DELIVERY_PLAN.md#readiness)。今すぐはUI状態別画面案とGo君の音声選定。正式実装は担当/対象版の確認→K01-a/b→K02-a〜d。未定義の契約・担当了承・デザイン・実設定を推測で確定しない。未決定はその依存部分だけ止める。
- 今回追加した着手条件・fixture期待結果は、45ファイル379ローカル参照/使用アンカー、16管理ファイルmetadata、対象差分の空白検査が成功。独立レビューはP1/P2なし。K01着手可能の表現を限定し、同担当が修正版を再確認、指摘残件なし。K01/K02のコード・画面・新しい契約テストは未実装で、並行開発の実動作を保証する検証ではない。

- 今回は資料の担当・並行作業を更新。製品コード・画面配置・音声技術の最終選定は変更していない。旧Go君UI/Mac workerの割当を最新方針で置き換えた。
- 音声方式の従来案を選定済みと誤認しないよう§9を更新。処理場所・保持・共有/送信条件は維持。
- Go君の選定結果・進捗・追加担当の了承は未確認。今回他の人へメッセージを送っていない。
- 確認結果：45ファイルの374ローカル参照/使用アンカー、16管理ファイルのmetadata検査、差分の空白検査が成功。独立レビューでP1/P2なし。状態定義の表現とカレンダーadapter編集先のP3を修正し、同じ担当が再確認、指摘残件なし。以下のビルド/旧レビュー結果は直前の基盤整理時の証拠で、今回の資料変更ではアプリビルドを再実行していない。

## 整理・保持の確認

開始版は ca6d317 と既存未コミット16ファイル。初期差分を退避してから基盤だけを選択統合した。旧資料は履歴へ移し、現行Markdownを26本から16本へ削減。主要な参照先はAGENTSの8役割に整理した。

旧状態は[前回WORKFLOW](../history/WORKFLOW_20260912.md)、[仕様2.0](../history/design/MVP_SPEC_2_0.md)、[旧製品方針](../history/design/PRODUCT_CORE_20260912.md)から参照できる。履歴16文書は開始時コピーと照合し、リンク再配置以外の本文欠落なし。取り込んだスターター19ファイルは元作業ツリーとバイト一致。既存の状態遷移コード・テスト・serve・15画面見本の4ファイルも開始時と一致。旧操作試作は旧仕様の根拠を維持する。

## 検証結果

ローカルWindows / Node 22.20.0。依存導入はnpm 10.9.3、最終の型チェック・バンドル・Doctorは作業用キャッシュに用意したnpm 10.9.0から実行。既存lockfile・SDK・依存バージョンは変更していない。

| 確認 | 結果と限界 |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache` | 887 packages導入成功。初回の既定キャッシュ書込失敗後、作業用キャッシュで再実行 |
| `npm run typecheck` | 成功 |
| `npm run doctor` | 21/21成功。外部の公式metadata照合を含む。製品API・音声送信ではない |
| `npm run build:bundles` | Android/iOSのHermes bytecodeとWebを `apps/client/dist` に出力成功。APK/IPA・実機確認ではない |
| `node scripts/check-docs.mjs --self-test` | 欠落ファイル/アンカー検出、コード例の除外を確認 |
| `node scripts/check-docs.mjs` | Markdown/HTML・skill・履歴のローカル参照と使用アンカーを確認。外部URL・意味・AI挙動は対象外 |
| `pwsh -NoProfile -File scripts/check-aidd-lite.ps1 -RepoRoot .` | 16管理ファイルのmetadata/対応するローカルファイル参照が成功 |
| `node --test docs/product/prototypes/sharing-state.test.mjs` | 既存旧試作4/4成功。製品の共有認可テストではない |
| `git diff --check` | 最終差分の空白確認。未追跡の移動先は別途参照/保持確認を実施 |

バンドルは初回にsandboxのExpoホーム書込・Hermes実行権限で停止。検証用にtelemetryを無効化し、Expoホームを作業キャッシュへ指定、実行権限を確保して成功した。製品設定の変更ではない。Glass・録音・ASR・生成・カレンダー・両端末動作は未検証。

## 独立レビューと入口確認

- 仕様/情報保持担当（docs_review）：初回P2 1件（カレンダー節の旧採用状態と実送信表現）を修正。第2回で解消・新規P1/P2なし。音声一般条件と既存4録音限定例外、実験/製品の保持起点も確認。
- 実装引き渡し担当（readiness_review）：初回P1/P2なし。P3のfixture保存先をcontracts/fixturesへ明記し、第2回で解消・新規P1/P2なし。
- 会話履歴なしのAI（fresh_entry）：AGENTS/READMEから必要な正本だけを読み、K01/K02・担当・受入・後段条件へ到達。統合契機/本人帰属、M09採用の時制、Mac担当の呼称を明確化し、再確認で3件解消・重大な欠落なし。
- 主担当は指摘と最終差分を照合。これらは文書の読み取りレビューで、製品動作・実機・実送信の成功ではない。過去版のレビュー結果を現版へ流用していない。

## 後段の条件

署名・対応OS・実APIのHTTPS/認証・実モデル予算・目的別データ利用条件は、ロードマップの該当Kで確認する。K01/K02人工実装の全体ブロッカーではない。音声探索の過去結果は[VALIDATION](VALIDATION.md)から必要時だけ参照する。

## 結果の記録

各作業の結果は「対象版/既存差分、KとM/U/受入ID、変更・人間の判断、確認コマンド/条件と成功・失敗・未実行、証拠、残件と次の受け渡し」を短く残す。完了済みの詳細は履歴へ移し、ここに仕様・担当表を複製しない。模擬・実生成・実音声・外部登録、自己確認・独立レビューを区別する。
