# Backend development

FastAPI、Python worker、Supabaseの認証・非公開保存adapter。処理同意の旧API・必須入力・判定を撤去し、AC19の認証・所有者・版・期限・送信先検査を維持する。端末直接ASR結果の共有保存と2入力統合は未接続。実装と残件の正本は[WORKFLOW](../../docs/development/WORKFLOW.md)。実データの扱いは[VALIDATION](../../docs/development/VALIDATION.md#音声の利用処理条件)を参照する。

## 人工データで確認する

Python 3.12を使う。Windowsではリポジトリのルートから実行する。

```powershell
./scripts/backend.ps1 setup
./scripts/backend.ps1 test
./scripts/backend.ps1 schema
```

PythonがPATH上にない場合、setupの `-Python` へPython 3.12の実行ファイルを指定する。仮想環境は `.npm-cache/backend-venv`。依存の直接指定はrequirements.txt、今回のWindows環境の固定版はrequirements.lock.txt。テストはMemoryStore/MemoryBlobs、明示した人工ASR/生成adapter、HTTP MockTransportを使い、実音声・外部APIへ送信しない。保存・取消・期限・競合のAPIをFastAPI TestClient経由で検証する。これは実PostgreSQLやSupabase Authの検証ではない。

macOS等では、このディレクトリで仮想環境を作り、`pip install -r requirements.lock.txt` → `python -m pytest -q` を実行する。別OSでの再現は未確認。

## 実サービスの準備と起動

ローカル構成の作業元PCでは、2026-09-15にDocker/Supabase・2アカウント・ffprobe・HTTPSを準備し、人工音声のAuth/DB/Storage往復を確認した。[結果と再起動方法](../../docs/development/LOCAL_CONNECTION_PREP.md)を参照する。現在のcheckoutや別PCでの再現・実機・ASRの完了とはしない。

1. 開発用Supabaseを用意する。2026-09-15に既存クラウドプロジェクトへ下記の手順でDB/Storageを接続した。隔離したローカル構成を使う場合はDockerとSupabase CLI、[config.toml](../../supabase/config.toml)を使う。初期DDLは[migration](../../supabase/migrations/202609140001_mvp_storage.sql)。既存DBへ適用する前に状態を照合する。
2. Supabase側で開発用の2アカウントを用意する。製品APIは新規登録・管理者操作を提供しない。
3. [.env.example](.env.example)を参考に、このディレクトリのGit除外された `.env` に接続設定を入れる。プロセスの環境変数が優先。`UPLOAD_TICKET_SECRET` は32文字以上のランダム値。音声保存先を示す `PC_DESTINATION_ID` も実際の送信先を指定する。音声APIキーの暗号化保管庫は自動では読み込まない。
4. 実音声の受入前に、`ffprobe` をPATHへ配置する。現在の形式検査はAAC、48kHz、mono、25MiB以下、5分以下。このPCでは `backend.ps1` がローカルのffprobeを検出する。音声変換・分割・ASR呼出は別のworker処理として接続する。
5. 次の2プロセスを起動する。

```powershell
./scripts/backend.ps1 serve
./scripts/backend.ps1 worker
```

serveは `127.0.0.1:8000` に待受し、アクセスログを抑止する。スマホから使うHTTPS入口、証明書、到達経路は別途必要。CORSは `.env` で指定したWeb originだけを許可する。TLS検証を無効化する設定は用意しない。

未設定時のAPIは503を返す。`/health` は設定項目の存在を表示するもので、DB・認証・ASRの接続成功を証明しない。APIは設定不足や通信失敗でMemoryStore/人工結果へ切り替わらない。

### クラウドSupabaseの初回準備

2026-09-15に `nmidnmqnrhogehzehkjh` へ非公開の `private.app_entities` と `recordings` bucket、専用DBユーザー `conversation_mvp_backend` を作成した。接続情報はこのPCの `.env`。同ユーザーの権限はアプリテーブルに限定し、anon/authenticatedによる直接参照を許可しない。Supabase Auth/Storageの既存APIキーはバックエンドだけが使う。

新しい空の対象へ同じ構成を準備する場合は、このディレクトリで `python provision_supabase.py --project <確認したref>` で状態を確認し、許可された対象にだけ `--apply` を付ける。Management APIの認証は環境変数 `SUPABASE_ACCESS_TOKEN` またはルートの `.env.supabase.local`。既存オブジェクトや `.env` がある場合は停止する。既存設定の上書き・DB初期化・不明な処理の自動再試行はしない。初期化はManagement APIのSQL経由であり、Supabase CLIのmigration履歴は自動登録していない。

クラウド接続は[公式CA証明書](../../supabase/certs/README.md)と `sslmode=verify-full` を使う。Windowsの日本語フォルダーではlibpq用に同じ証明書への相対パスを使い、transaction pooler向けにprepared statementを無効にする。別PCへ設定を移すときは `.env` のCAパスをそのPCに合わせる。

実DB/Storageの検証は `python check_supabase.py --run`。人工のDB行を読み書きしてロールバックし、Storageへ人工バイト列を書込・読込・削除する。モデルや実音声を使わない。この実接続チェックは通常のpytestには含まれない。

開発用2アカウントは、作成が許可された空のAuthに対して `python provision_accounts.py --apply` で準備できる。架空の `example.invalid` を使い、メール送信はしない。パスワードはルートの `credentials/development-accounts.local.json` に保存する。既存ユーザーと既存の認証ファイルがある場合は停止する。作成の実施状態は[WORKFLOW](../../docs/development/WORKFLOW.md)を参照する。

## 今回の実装範囲

- 本人の録音metadata、送信先設定を固定した期限付きupload ticket、checksum/形式検査、非公開保存、所有者の原音/文字取得。
- ASR adapter境界と単一入力worker。ジョブの二重作成を防ぎ、1job最大2呼出・設定したjob当たり費用枠を検査。結果不明・再起動後の処理中jobを自動再送しない。部分結果は公開しない。
- 接続コード、相互確認、今回許可、継続許可/解除、確認し直し、取消。相手の本文は統合の公開条件が未成立なら取得不可。
- 自分の原文訂正、旧版の無効化、個人Sourceの保存/メモ/タグ、再確認、保存解除。メモをモデルへ渡す処理はない。
- 音声/文字の期限と削除worker。個人の保存本文・メモを即遮断し、本文なしの表示も7日後に除去する。相手の独立入力を削除しない。
- 個人ContextView、全文脈のmanifest、G1/G2/G5 runner、本人によるToDoの採用/編集/完了/再確認、日次選択とタイムゾーン設定。個人版は統合済みと表示しない。対応するMatchがある記録はK05の被覆表ができるまで生成を保留する。
- OpenAI Responses生成adapter。実呼出は明示設定が揃うまで無効。人工adapterとHTTP MockTransportで接続処理・上限・失効を確認する。

**ASRの具体provider adapter、チャンク処理、2入力の時間対応/統合、共有ContextViewの被覆表、共有clip、指摘API、G3/G4、Google/端末カレンダーは未実装または未接続。** 共有許可が揃っても、現在は統合未設定のfailed状態を返す。人工fixtureを統合結果として返さない。保存APIのtargetは現在、本人のSourceに限定する。

ASRを接続する際は[adapters.py](app/adapters.py)のAsrAdapterを実装し、[main.py](app/main.py)のfactoryへ明示的に渡す。モデル/設定版、入力上限、timeout、保持設定、呼出/費用上限を固定し、分割境界・結果不明の照会/再送を追加検証する。単にキーをenvへ入れてもASRは有効にならない。

## 個人の生成・ToDo・日次

実接続モードの自分の記録では、送信先/保持条件と処理設定の状態を表示する。アプリ内で処理同意を取得・保存・取消する導線はない。原音の7日期限後も文字が有効で処理設定が完了していれば生成を要求できる。「内容を整理する」「ToDo候補を確認する」からG1/G2を要求する。現在は本人の操作で起動し、文字起こし確定/訂正イベントからの自動起動は後続。

「ToDo」でaction/本人の作業/期限を確認して採用する。期限未定、日付、日時とIANA zoneを区別する。本人編集・完了を生成結果で上書きしない。「今日」で固定zoneを初回確認し、会話の開始日で対象を選ぶ。11件以上は自動選択せず、最大10件を明示選択する。G5には選択した原文と、存在する有効なG1整理だけを渡し、保存メモやToDo本文を入れない。

生成結果は入力に渡した全Source/Context/Match/権限と処理設定の版に依存する。引用していない背景の訂正でも旧本文を遮断し、ToDoは同じID・完了状態を維持して現行候補から再確認する。通信断/背景化でLive画面をアンマウントし、復帰時に再取得する。表示中は15秒間隔で再確認し、期限時は消去する。別端末からの変更をpushで即時反映する仕組みは未実装。

[.env.example](.env.example)の `GENERATION_*` を実設定で埋める。`GENERATION_ENABLED=true`、専用キー、モデル版、送信先、確認済み保持説明、入出力/timeout、予算ID・上限・1呼出の予約額のすべてが必要。モデル初期値は採用済みの `gpt-5-mini`。キーはbackendだけに置き、rootのキーは自動で読まない。今回は値を設定せず実APIも呼んでいない。

予算の単位はmicro USD（1 USD = 1,000,000）。予約額はモデル/入出力上限/推論出力を含む最悪費用に合わせて運用者が確認する。全actor/worker共通のDB台帳で呼出前に予約し、自動返金/自動リセットしない。これは設定額の実行制限で、プロバイダ実請求額の照合ではない。全worker同時2件、本人のqueued上限10件、1run最大2呼出、手動retryは1roundのみで同じ基底キー最大4呼出。通信の結果不明やworker中断は自動再送しない。

Responsesへの送信は `store:false`、toolなし、切詰めなし、構造化出力。拒否/未完了/不正根拠/11件以上の候補は公開しない。`store:false`だけで外部保持条件の確認が済んだとは扱わない。実装時の参照：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)（2026-09-14閲覧）。アカウント可用性・日本語生成品質・実課金は未検証。

UI確認用に、`services/backend`から `python tests/serve_artificial.py --artificial-only` を実行できる。loopback 8001に揮発性の人工APIを起動する専用entryで、本番factoryには入らない。クライアントは当該プロセスだけ `EXPO_PUBLIC_API_URL=http://localhost:8001` を指定し、`npm run web -- --host localhost --port 8082` で起動する。検証用ログインは `demo@example.invalid` / `artificial-only`。初期の記録は2026-09-14。2026-09-15にブラウザfetchのreceiverを修正し、ログイン→録音待機→ルーム→本人の文字起こし→保存→録音へ戻る操作を確認した。クラウドAuth・実録音・実モデルの検証とは別の人工確認である。

## 保存方式と公開契約

[store.py](app/store.py)はDB transaction中だけadvisory lockを取り、APIとworkerの公開判定を直列化する。外部通信中はlockを保持しない。現在は2人の開発用で、JSONB全件読込を使う。大規模データ・複数組・運用向けの性能設計は未実施。

DBのprivate schemaと音声bucketは、匿名/クライアントから直接読めるpoliciesを追加していない。APIの所有者確認を通して提供する。端末へservice-role keyやStorage全体のURLを返さない。認可エラー本文に入力されたprivate text/passwordを含めない。

[OpenAPI](../../contracts/openapi.json)は実装済み経路と入力モデルの生成物。主要型は[共通JSON schema](../../contracts/mvp-v1.schema.json)、個人Context/ToDo/日次/runの応答は[追加schema](../../contracts/derived-v1.schema.json)で検査する。追加responseはFastAPIのPydanticからschemaを出し、共通TS型を生成し、端末でも失効本文の混入を拒否する。`./scripts/backend.ps1 schema` → `npm run contracts:generate` の順で再生成する。OpenAPIの全response model・§15全体の共通schemaはまだ揃っておらず、契約全体の完成とはしない。

## 処理同意を持たない契約への移行（2026-09-15）

- APIとクライアントを一緒に更新する。`processing-consents` / `generation-consents` は削除済み。upload要求は `request_key/expected_version/checksum`、transcription要求は `request_key/expected_version`。旧 `consent_id` 入力は422になる。[OpenAPI](../../contracts/openapi.json)が実装契約。
- ticketは保存先と設定版、ASR jobは宛先・provider/model/設定版を保持し、実行前と保存前にも一致を検査する。未設定では呼び出さない。既存の所有者・checksum・期限・共有権限は維持する。
- 既存DBの同意行は履歴として残り、今回のコードは読み書きしない。JSON保存方式なのでDDL変更は不要。古いticketは新規発行が必要。設定snapshotのない旧ASR jobは外部送信せずfailedにする。旧manifestはhashが変わるため、再取得・既存の再確認/再生成操作が必要。旧ジョブの結果不明状態を自動再送しない。
- クライアントは処理operation keyの世代を更新し、旧端末保存の同意状態を再利用しない。`generation_allowed` は生成adapter・宛先・保持/予算設定の準備状態を表す。相手への共有許可を意味しない。
- この更新はローカル実装と人工テストのみ。稼働中API/workerの再起動、クラウドDB操作、APK再配布、実機・実音声・実生成は行っていない。[変更と検証](../../docs/history/BACKEND_PROCESSING_MIGRATION_20260915.md)。
