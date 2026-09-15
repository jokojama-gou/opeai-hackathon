# AI IDEからSupabaseを操作する

2026-09-15、このPCのリポジトリルート `.env.supabase.local` に、ユーザーが提供した `SUPABASE_ACCESS_TOKEN` を保存して認証を確認しました。既存の `.gitignore` の `.env.*` で除外されています。ユーザーはハッカソン用認証情報のGit格納も許可していますが、この作業では既存の除外設定を保ち、commit/pushは実行していません。アプリの公開環境変数やbundleへは入れません。他PCの保存場所・認証状態は別に確認してください。

PowerShellを実行できるAI IDEは、リポジトリルートから次でアクセスできます。MCPの登録やIDEの再起動は不要な、Management API経由の方式です。

```powershell
# 接続確認・プロジェクト一覧
$projects = & ./scripts/supabase-api.ps1
$projects | Select-Object id, name, status

# 特定プロジェクトの確認
& ./scripts/supabase-api.ps1 -Path '/v1/projects/nmidnmqnrhogehzehkjh'
```

スクリプトはプロセスの `SUPABASE_ACCESS_TOKEN` を優先し、未設定なら認証ファイルを読みます。別の保存先は `-CredentialFile` で指定できます。Supabase公式ホストだけへ送信します。`-Method` と `-BodyFile`（JSONファイル）で更新APIも呼べます。実際の変更はその時点のユーザー依頼の範囲で行ってください。APIの応答には秘密情報を含むエンドポイントもあるため、出力項目は作業に必要なものだけ選びます。

2026-09-12初回確認：プロジェクト一覧の認証成功、1件、状態 `ACTIVE_HEALTHY`。ネットワーク制限のあるAI環境では外部通信の実行権限が必要です。他PCには認証ファイルはGitで配布されません。

## 操作テスト結果（2026-09-12）

ユーザーの「もろもろ全部できるかテスト」の依頼により、主要な管理操作を実行。10チェックすべてPASS、スクリプト終了コード0。実行証拠は本タスクのJSON出力、再現用は [test-supabase-access.ps1](../../scripts/test-supabase-access.ps1)。

| 項目 | 実際に確認した範囲 | 結果 |
|---|---|---|
| プロジェクト | 指定IDの取得、稼働状態 | PASS / ACTIVE_HEALTHY |
| Auth | 設定取得 | PASS |
| Storage | 設定取得 | PASS |
| Realtime | 設定取得 | PASS |
| REST / PostgREST | 設定取得 | PASS |
| Edge Functions | 関数一覧取得 | PASS |
| TypeScript型生成 | publicスキーマからDatabase型を生成 | PASS / 5,043文字 |
| SQL読取 | SELECT 1の値を照合 | PASS |
| DB書込・DDL | 専用スキーマ・テーブル作成、INSERT/SELECT/UPDATE/DELETEの値照合、インデックス作成、RLS有効化・ポリシー作成と存在確認、テーブル・スキーマ削除 | PASS |
| 後片付け | トランザクションをROLLBACK後、別リクエストで専用スキーマ不存在を照合 | PASS / 残存0 |

```powershell
& ./scripts/test-supabase-access.ps1
```

テスト用データのみを扱い、専用スキーマの変更は1トランザクション内でロールバックしました。既存データ・既存サービス設定の更新はしていません。設定レスポンスの秘密情報はログに残していません。

この段階では管理APIとSQLの操作を確認しました。ここで未検証だったログイン・ファイル転送・Realtime・関数デプロイ・ユーザー権限の動作は、下記の追加テストで確認済みです。既存のPowerShellラッパーはJSONリクエスト用で、追加テストではNode.js標準のHTTP・WebSocket・multipart送信を使用しています。

## サービスの実動作テスト（2026-09-12）

ユーザーの「全部機能するか確認」により、18:15〜18:16 JSTに実行。14チェックPASS、失敗0、終了コード0。[機械記録](SUPABASE_E2E_RESULT.json)と[再現スクリプト](../../scripts/test-supabase-e2e.mjs)を保存しました。記録には認証キー、パスワード、セッショントークンを含めません。

| 機能 | 実際に実行・照合した内容 | 結果 |
|---|---|---|
| 認証情報 | PATで必要なプロジェクトAPIキーを取得し、プロセス内だけで使用 | PASS |
| Auth | テストユーザー2人作成、メール送信なしのパスワードログイン、本人情報取得 | PASS |
| セッション | refresh、ログアウト、ログアウト後のrefresh拒否 | PASS |
| DB永続化 | 専用テーブルとRLSをコミット後、別API要求で存在確認 | PASS |
| REST / RLS | 通常ユーザーで追加・読取・更新・削除、他人・匿名の閲覧拒否、他人名義の追加と他人の行の更新を拒否 | PASS |
| Realtime Broadcast | 2つのWebSocket接続間で送信した内容を受信・照合 | PASS |
| Realtime Presence | 片方の在席通知をもう片方で受信 | PASS |
| Realtime DB通知 | テストテーブルへのINSERTを購読し、追加したIDのイベントを受信 | PASS |
| Storage | 非公開バケットで通常ユーザーによるファイル作成・取得・更新・削除と内容照合、別ユーザー・公開URLからの取得拒否 | PASS |
| Edge Functions | テスト関数をデプロイ、認証付きで実行して戻り値を照合、認証なしの実行は401 | PASS |
| 後片付け | 関数、バケットとファイル、Storageポリシー、テーブル、ユーザー2人を削除し、それぞれ不存在を確認 | PASS |

```powershell
node scripts/test-supabase-e2e.mjs
```

Node.js 22の標準機能のみを使用し、追加パッケージは不要です。再実行時も一意のテスト資源を作り、最後に削除します。実際のクラウド操作なので通信・サービス利用枠を消費します。実行途中でプロセスを強制終了した場合は、機械記録の `resources` にあるテスト資源を確認して後片付けしてください。

実データ・製品のテーブルや関数には触れていません。Realtimeのpublicationにはテストテーブルだけを追加し、そのテーブルの削除で所属も除去しています。作成・操作・削除のサービス側ログは残り得ます。

確認範囲はこのプロジェクトでの基本的なサービス操作です。React Native/Swiftの実画面との結合、メール・SMS配送、外部OAuth/MFA、負荷・長時間運用は今回の対象外です。課金変更、プロジェクト停止・削除、既存キーのローテーションはテストしていません。テスト用RLSの動作確認は製品の共有ルールの実装・検証を意味しません。

実装時の一次資料：[Auth REST仕様](https://github.com/supabase/auth/blob/master/openapi.yaml)、[Realtimeプロトコル](https://supabase.com/docs/guides/realtime/protocol)、[Storageアップロード](https://supabase.com/docs/guides/storage/uploads/standard-uploads)、[Management APIからの関数デプロイ](https://supabase.com/changelog/33720-deploy-and-update-edge-functions-using-the-management-api)。

認証仕様・各操作は[Supabase Management API公式資料](https://supabase.com/docs/reference/api/introduction)を参照。
