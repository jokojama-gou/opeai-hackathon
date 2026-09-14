# Backend development

MVP 2.2のFastAPI、Python worker、Supabaseの認証・非公開保存adapter。実装と残件の正本は[WORKFLOW](../../docs/development/WORKFLOW.md)。実データの扱いは[VALIDATION](../../docs/development/VALIDATION.md#音声の利用処理条件)を参照する。

## 人工データで確認する

Python 3.12を使う。Windowsではリポジトリのルートから実行する。

```powershell
./scripts/backend.ps1 setup
./scripts/backend.ps1 test
./scripts/backend.ps1 schema
```

PythonがPATH上にない場合、setupの `-Python` へPython 3.12の実行ファイルを指定する。仮想環境は `.npm-cache/backend-venv`。依存の直接指定はrequirements.txt、今回のWindows環境の固定版はrequirements.lock.txt。テストはMemoryStore/MemoryBlobsと明示した人工ASR adapterだけを使い、実音声・外部APIへ送信しない。保存・取消・期限・競合のAPIをFastAPI TestClient経由で検証する。これは実PostgreSQLやSupabase Authの検証ではない。

macOS等では、このディレクトリで仮想環境を作り、`pip install -r requirements.lock.txt` → `python -m pytest -q` を実行する。別OSでの再現は未確認。

## 実サービスの準備と起動

1. ローカルSupabaseを起動できるDocker環境とSupabase CLIを用意する。設定は[config.toml](../../supabase/config.toml)、初期DDLは[migration](../../supabase/migrations/202609140001_mvp_storage.sql)。既存DBへ適用する前にその状態を照合する。今回、このPCではDockerを検出できず、DB適用は未実行。
2. Supabase側で開発用の2アカウントを用意する。製品APIは新規登録・管理者操作を提供しない。
3. [.env.example](.env.example)を参考に、このディレクトリのGit除外された `.env` に接続設定を入れる。プロセスの環境変数が優先。`UPLOAD_TICKET_SECRET` は32文字以上のランダム値。PC転送の同意に表示する `PC_DESTINATION_ID` も実際の送信先を指定する。rootの音声APIキーは自動では読み込まない。
4. 実音声の受入前に、`ffprobe` をPATHへ配置する。現在の形式検査はAAC、48kHz、mono、25MiB以下、5分以下。ffprobeは今回のPCでは未検出。音声変換・分割・ASR呼出は別のworker処理として接続する。
5. 次の2プロセスを起動する。

```powershell
./scripts/backend.ps1 serve
./scripts/backend.ps1 worker
```

serveは `127.0.0.1:8000` に待受し、アクセスログを抑止する。スマホから使うHTTPS入口、証明書、到達経路は別途必要。CORSは `.env` で指定したWeb originだけを許可する。TLS検証を無効化する設定は用意しない。

未設定時のAPIは503を返す。`/health` は設定項目の存在を表示するもので、DB・認証・ASRの接続成功を証明しない。APIは設定不足や通信失敗でMemoryStore/人工結果へ切り替わらない。

## 今回の実装範囲

- 本人の録音metadata、3用途別同意、期限付きupload ticket、checksum/形式検査、非公開保存、所有者の原音/文字取得。
- ASR adapter境界と単一入力worker。ジョブの二重作成を防ぎ、1job最大2呼出・設定したjob当たり費用枠を検査。結果不明・再起動後の処理中jobを自動再送しない。部分結果は公開しない。
- 接続コード、相互確認、今回許可、継続許可/解除、確認し直し、取消。相手の本文は統合の公開条件が未成立なら取得不可。
- 自分の原文訂正、旧版の無効化、個人Sourceの保存/メモ/タグ、再確認、保存解除。メモをモデルへ渡す処理はない。
- 音声/文字の期限と削除worker。個人の保存本文・メモを即遮断し、本文なしの表示も7日後に除去する。相手の独立入力を削除しない。

**ASRの具体provider adapter、チャンク処理、2入力の時間対応/統合、共有clip、指摘のAPI、ContextView・生成runner、ToDo/日次の永続化、Google/端末カレンダーは未実装または未接続。** 共有許可が揃っても、現在は統合未設定のfailed状態を返す。人工fixtureを統合結果として返さない。保存APIのtargetは現在、本人のSourceに限定する。

ASRを接続する際は[adapters.py](app/adapters.py)のAsrAdapterを実装し、[main.py](app/main.py)のfactoryへ明示的に渡す。モデル/設定版、入力上限、timeout、保持設定、呼出/費用上限を固定し、分割境界・結果不明の照会/再送を追加検証する。単にキーをenvへ入れてもASRは有効にならない。生成の具体予算も未設定なのでgeneration_configuredはfalseのまま。

## 保存方式と公開契約

[store.py](app/store.py)はDB transaction中だけadvisory lockを取り、APIとworkerの公開判定を直列化する。外部通信中はlockを保持しない。現在は2人の開発用で、JSONB全件読込を使う。大規模データ・複数組・運用向けの性能設計は未実施。

DBのprivate schemaと音声bucketは、匿名/クライアントから直接読めるpoliciesを追加していない。APIの所有者確認を通して提供する。端末へservice-role keyやStorage全体のURLを返さない。認可エラー本文に入力されたprivate text/passwordを含めない。

[OpenAPI](../../contracts/openapi.json)は実装済み経路と入力モデルの生成物。応答の主要型は[共通JSON schema](../../contracts/mvp-v1.schema.json)で検査する。OpenAPIの全response model・§15全体の共通schemaはまだ揃っておらず、契約全体の完成とはしない。
