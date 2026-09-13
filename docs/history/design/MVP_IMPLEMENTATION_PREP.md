<!-- archive: historical evidence; not current implementation instructions -->

> 履歴資料。2026-09-13に現行入口から分離。本文は当時の判断・状態であり、現在の実装指示ではありません。現行入口は[AGENTS](../../../AGENTS.md)。

# MVPの画面・データ/API契約・実装タスク案

最新の実装に渡す推奨仕様は[MVP_SPEC](MVP_SPEC_2_0.md) §9/§11。本書のdraft-0.1/T01〜T09は設計過程として保持し、API・原音再生・保持等の差異は最新仕様の提案を参照する。採用済みへの昇格ではない。

2026-09-12 / contract draft 0.1。状態: **設計準備済み・採用と実装は未完了**。[MVP案](MVP_DEFINITION_DRAFT.md) Q1〜Q3は回答待ち。資料にある方式を採用済みにせず、契約はHTTP/JSONの論理案として定義する。製品コード・環境導入・音声処理は今回開始しない。

## 1. 画面フロー

| 画面/シート | 操作と表示 | 次の状態・失敗時 |
|---|---|---|
| ホーム/履歴 | 「記録を始める」、閲覧可能な会話、処理中の自分の記録 | 通常開始に相手指定不要。履歴はタイトル・件数も閲覧者で制限。権限外の会話の存在を示さない |
| 記録中 | 経過時間、「自分の記録を終了」 | 録音/中断/保存中/保存失敗を分離。保存前に完了表示しない |
| 自分の記録詳細 | 自分の文字起こし、処理状態、「一緒にまとめる」 | 相手接続前に他者の内容を出さない。共有拒否でも自分の記録へ戻れる |
| 持ち寄り確認 | 自分の入力範囲、接続先、同一会話・帰属・参加範囲の個別確認 | 人の確認済みと自動判定済みを別表示。確認不足/不一致なら保留 |
| 共有確認 | 相手、確定対象区間、今回許可、任意の継続承認 | 双方未成立なら「まだ共有していません」。閉じる=未回答。既存FEATURE_SPEC_DRAFT §8を継承 |
| 会話詳細 | 内容/理由/決定/未決定の整理、発言順スクリプト、出典数、不明 | 原文/推定/解釈/人の訂正を表示。「見本」は画面上で継続表示。生成待ちと共有待ちを混ぜない |
| 出典比較 | A/B入力の該当部分、前後の許可された文脈、時間とその精度 | 原音未保持なら再生ボタンを出さない。全録音URLを区間閲覧者へ渡さない |
| 訂正/指摘 | 自分の入力訂正または他者入力への指摘、変更前後、保存 | 競合は再読込。再生成中は旧派生結果を止める。訂正で本人・権限を変更しない |
| 自動共有管理 | 有効/未成立/解除の反映待ち、解除 | 解除完了はサーバー確認後。過去の個別共有は別操作 |

グループ画面はQ1で追加採用された場合に接続する。通常の開始画面にグループ選択を必須化しない。共通の情報構造と文言はGo君、SwiftUIでの表示は依頼者。色・配置・OS操作の詳細はGo君の画面見本で具体化する。

## 2. データの責務と最小フィールド

IDは推測困難な不透明文字列。日時はUTC、録音内位置は整数ミリ秒、区間は半開区間 `[start_ms, end_ms)`。端末時計の一致を会話対応・権限の証拠にしない。以下の列名/enumは提案であり既存実装の説明ではない。

| オブジェクト | フィールド案 | 制約 |
|---|---|---|
| Recording | id, installation_id, owner_id, mode(normal/group), group_id?, started_at, duration_ms?, capture_status, storage_status, version | owner_idは認証から設定。端末所有者を全発言の話者としない。group_idだけで通常入力をグループ化しない |
| SourceSegment | id, recording_id, start_ms?, end_ms?, timing_kind(estimated/verified/unavailable), original_text, speaker_label?, version | ASR原文は訂正で上書きしない。時刻不明を0に変換しない。点位置しかなければ範囲確定としない |
| SourceCorrection | id, source_id, base_version, author_id, replacement_text, created_at | 本人入力訂正案。旧版を追跡。削除/履歴保持方針はO07決定後 |
| MatchProposal | id, recording_refs, mapping_version, mappings, status(pending/confirmed/disputed), confirmations | mappingsは録音位置→会話内位置の区分対応。似た話題やコード一致をconfirmedの根拠にしない |
| Attribution | speaker_label, account_id?, status(unknown/human_confirmed/automatic_candidate), evidence_refs | 自動候補は本人確定ではない。発言内容の訂正とも別オブジェクト |
| Participation | conversation_id, account_id, ranges, status, evidence_refs, version | 通常の開始は初発言。録音時間と別。推定範囲を共有許可に変換しない |
| ShareRequest | id, parties, scope_ranges, mapping_version, participation_version, expires_at, responses | pending/allowed/denied/expired。各人が自分の応答のみ書込。範囲/相手変更は再確認 |
| ContinuingGrant | id, pair, approval_round, both_approved_at?, revoked_at?, version | 同じ承認回で双方が承認して成立。片側の旧承認を将来の承認と組み合わせない |
| ConversationView | id, mode, title, script, highlights, revision, access_revision, processing_status, data_origin | 閲覧者別projection。全員共通の全区間レスポンスをクライアントで隠す方式にしない |
| ScriptUtterance | id, text, content_kind(source_excerpt/context_inference/ai_interpretation/human_correction), speaker_account_id?, evidence_refs, uncertainty[], order_status | 一つにまとめても候補差を保持。異なる種類は発言や注を分ける。原音逐語正解とは表示しない |
| Highlight | id, category(content/reason/decision/unresolved), text, content_kind, utterance_ids, evidence_refs, uncertainty[] | 記載なしを未決定なしへ変換しない。根拠のない決定を生成しない |
| Job | id, kind, input_versions, mapping_version, authorization_version, processor_version, status, stage, error?, result_revision? | queued/processing/needs_confirmation/completed/failed/cancelled。completedだけで共有許可は成立しない |
| GroupMembership | group_id, account_id, joined_at, left_at?, version | S04の加入期間と現在所属を使う。会話参加の初発言条件を流用しない。再加入は未決定 |

evidence_refsは `{source_id, source_version, start_ms?, end_ms?}`。各参照が存在し、入力版と一致し、閲覧区間内であることを検査する。削除後の墓標には本文を残さない案。保持すべき監査情報の具体範囲は保存前に決める。

## 3. APIの操作契約案

API v1の候補。以下の経路は未実装。ローカルfixtureは同じ入出力形を返すが、実API/認証/統合とは表示しない。認証済み主体を利用し、リクエストのuser_idで権限を決めない。

| 操作 | 入力 | 出力/失敗 |
|---|---|---|
| POST /v1/recordings | installation_id, mode, group_id?, capture metadata, request_key | 201 recording。group権限なしは拒否。録音作成と音声送信は別 |
| POST /v1/match-proposals | 本人のrecording_id/ranges、接続トークン | 201 proposal_id + 自分向け状態のみ。他者の録音ID/本文一覧を検索させない |
| POST /v1/match-proposals/{id}/confirmations | mapping_version, 自分の同一会話/帰属/参加区間の個別回答, request_key | 200 pending/confirmed/disputed。古い対象版は409。未回答を補わない |
| POST /v1/share-requests | confirmed proposal_id, exact scope/version | 201 pending。確認未完了はCONFIRMATION_REQUIRED。新規接続だけで本文を返さない |
| POST /v1/share-requests/{id}/responses | decision, continuing_opt_in, expected_version, request_key | 200 自分向け今回/継続状態。本人だけの応答で相手の許可を更新しない |
| POST /v1/continuing-grants/{id}/revoke | expected_version, request_key | 200 revoked + access_revision。片方が解除可。送信失敗は完了扱いにしない |
| POST /v1/conversations/{id}/merge-jobs | input_versions, mapping_version, request_key | 202 job。共有対象は認可を通した入力範囲からサーバー側で選ぶ。任意録音を列挙させない |
| GET /v1/jobs/{id} | 認証のみ | status/stage/error/retryable/result_revision。所有・許可なしは存在も隠す |
| GET /v1/conversations | cursor?, limit | 閲覧者の範囲から作ったtitleとstatusの一覧。全体件数から権限外を漏らさない |
| GET /v1/conversations/{id} | 認証のみ | ConversationView。権限版変更時は再取得。更新中はpendingを返し旧本文を載せない |
| GET /v1/conversations/{id}/sources/{source_id} | 閲覧者の許可区間内の参照 | 原文と許可内の前後。原音再生URLは別契約・未決定 |
| POST /v1/sources/{id}/corrections | base_version, replacement_text, request_key | 本人入力のみ201、版競合409。他者入力は拒否。関連派生物をstaleにして再生成 |
| POST /v1/conversations/{id}/issues | target utterance/source, comment, base_revision | 201 未確認指摘。対象の閲覧権限が必要。共有本文を自動置換しない |
| DELETE /v1/recordings/{id} | expected_version, request_key | 方針採用後202 deleting。新規提供を遮断し、削除・派生再計算の完了を別表示。既存他者入力は別評価 |

アップロード、音声URL、グループ招待、ログインの具体プロバイダーは今回の契約に架空の成功経路を作らない。実装前に該当Oを解決する。認証なしのデモ用主体はローカル人工adapter内に限定し、製品APIへ残さない。

共通エラーは `{code, retryable, request_id}` と必要最小限の表示情報。INPUT_INVALID(422)、VERSION_CONFLICT(409)、CONFIRMATION_REQUIRED(409)、SOURCE_UNAVAILABLE(410)、PROCESSING_FAILED(処理結果)、SERVICE_UNAVAILABLE(503)。権限外/不存在は同じ404応答で区別させない。エラー本文・ログへ認識文や相手情報を出さない。

request_keyは主体・操作・対象・payload hashに結び付け、同一要求の再送は同じ結果、違う本文での再利用は409。二重押しとタイムアウトでジョブを重複作成しない。ジョブ中の訂正・解除は公開直前に最新版と照合し、古いジョブ結果を公開しない。

## 4. 統合処理adapterの境界

入力: 許可済みSourceSegment/Correctionの版、確認された時間対応、話者の帰属状態、対象区間、processor_version。出力: script/highlights/evidence_refs/uncertainty/stage/error。依頼者側の処理担当はこの形でGo君の共通APIへ接続し、独自の認可やDBを増やさない。

処理順案:

1. APIが対象・許可・版を確認し、許可範囲だけ切り出す。共有許可前の個人処理は本人の入力だけ。
2. 各入力の時間対応から発言候補を並べる。対応不明は確認待ちにし、同じ語句だからと重複削除しない。
3. 重複・片側のみ・矛盾を扱ったスクリプト案を生成する。相違は候補と出典を残す。話者不明は埋めない。
4. 許可されたスクリプト/入力だけから整理項目を作る。推定・解釈を区別する。
5. 構造検査: 出典存在・版・区間・種別、参照切れ、時刻の逆転等。検査成功を意味正確性の保証にしない。
6. 公開直前に入力版・権限版を再確認。古ければ破棄/再生成し、成功した古い結果を後着で戻さない。

手で作った完成スクリプトはfixture adapter専用。実生成adapterでは入力差し替えで出力と出典が変わる必要がある。ASR/LLMの特定モデル・配置先は未採用。今回adapterを実装/起動せず、既存ASR環境を再構築しない。

## 5. 共有判定の不変条件

通常共有は「同一会話の確認」「対象者の帰属・参加範囲」「今回の双方許可または有効な双方継続承認」を別々に満たす。どれかが不明ならその区間は共有不可。入力所有者の申告だけで他者全員の帰属を確定しない。確認範囲を超える人数・未識別者が混じる場合も保留する。

継続承認が有効で全条件が明確なら、会話ごとの追加共有ボタンなしでジョブを開始できる契約とする。初回MVPの手動持ち寄りは自動発見の代替であり、D06の共有許可を毎回要求する仕様変更ではない。

グループ共有は明示的なグループ用記録だけ。欠席した現メンバーは加入期間内、途中加入は加入後、退出後は過去分もグループ経由で不可。通常共有の別の有効な許可は独立評価。Cへの制限でA/Bの既存権限を消さない。

認可は本文だけでなく一覧タイトル、整理、根拠、前後文脈、ジョブ情報に適用。検索・AI回答・書出しを後日追加するときも同じ。権限外の文脈を生成入力へ渡してから出力だけ隠さない。機密レスポンスは共有キャッシュに置かない案とし、端末の派生キャッシュは権限版変更・退出・ログアウトで破棄する。取得済みコピーや記憶の回収を約束しない。

## 6. 人工契約ケース（これから実装する素材）

全例は架空。既存録音の語句・時刻・人物を転記しない。fixture版と期待結果を別々に保存し、手書き正解を本番処理の出力にしない。

| ID | 入力/操作 | 期待結果 |
|---|---|---|
| F01 | Aに「展示は土曜にしよう」、Bに同じ発言と「会場はまだ決めていない」。対応は人工条件で確認済み | 重複は一発言、Bのみの内容も含む。土曜は提案、会場は未決定。両入力の出典をたどれる |
| F02 | Aは「土曜」、Bは「日曜」。どちらが正しいか不明 | 両候補と相違を残し、確定日を作らない |
| F03 | 整理項目の出典が不存在/版違い | 完成として公開しない。SOURCE_UNAVAILABLE等を返す |
| F04 | A許可、B未回答/拒否/期限切れ | 他者由来の本文・補完・タイトル・要点・出典を出さない |
| F05 | 双方今回許可、継続は片方のみ | 今回の確定区間のみ共有。次回自動共有は未成立 |
| F06 | 双方継続有効、帰属または範囲が不明 | 共有は確認待ち。許可を根拠に帰属を埋めない |
| F07 | Cの初発言を人工時刻60000msに設定 | Cは60000ms以降だけ。A/Bは以前も保持。境界直前/一致/直後で要点と出典も確認 |
| F08 | グループへの加入が60000ms、後に退出 | 加入前不可、加入後の欠席者可、退出後は過去もグループ経由不可。通常記録は流れない |
| F09 | ジョブ中に継続解除、古い結果が到着 | 新規公開時に再判定。別の今回許可がなければ公開しない。過去の個別許可を自動削除しない |
| F10 | 本人訂正後に旧版の更新/ジョブが到着 | 409または旧結果棄却。旧派生結果を最新として表示しない |
| F11 | 通信断・二重押し・120秒経過 | 保存/共有/解除を成功にしない。同じjobへ再接続し重複処理しない。時間値はQ3採用後 |
| F12 | 自分の入力を削除し、他者の独立入力は残る | 削除した根拠と派生を遮断し、別の有効入力は別評価。全員分消去と表示しない |

最初の表示用JSON例。APIレスポンスの最小形であり、schema/fixtureの実ファイルはT01で作る。

```json
{
  "schema_version": "draft-0.1",
  "data_origin": "synthetic_fixture",
  "id": "demo-conversation-01",
  "mode": "normal",
  "revision": 1,
  "access_revision": 1,
  "processing_status": "completed",
  "title": "展示の相談（見本）",
  "script": [{
    "id": "utterance-01",
    "text": "展示は土曜にしよう",
    "content_kind": "source_excerpt",
    "speaker_account_id": null,
    "order_status": "confirmed_for_fixture",
    "uncertainty": ["speaker_unknown"],
    "evidence_refs": [
      {"source_id": "source-a-01", "source_version": 1},
      {"source_id": "source-b-01", "source_version": 1}
    ]
  }],
  "highlights": []
}
```

## 7. 担当別の着手可能な単位

今回完了するのは以下のタスク定義まで。未決定に依存する本実装を開始したことにしない。見積時間は稼働不明のため創作しない。各タスクは変更先・入出力・終了条件を一つに絞り、両担当への送信は今回行わない。

| ID/順序 | 担当・変更先案 | 入力→成果/完了条件 | 依存と未達時 |
|---|---|---|---|
| T01 最初 | Go君: contracts/fixtures、contractsの短いschema | 本書F01/F02/F04→元入力・表示結果・エラーの人工JSONを別ファイル化。参照ID/版が揃い、架空表示があり、認証/実生成を装わない。両担当が使う契約版を付ける | 文書準備から独立して着手できる最初の成果。モデル・クラウド不要。仕様案の範囲と明記 |
| T02 T01後 | Go君: design、apps/mobileの履歴/詳細 | 同じJSON→履歴→スクリプト→A/B出典を開ける1経路。読込失敗と相違も表示。通常ホームに相手選択を追加しない | RNのローカル起動方式/依存採用は初回に固定。API待ちはfixture adapterで表示。「見本」を消さない |
| T03 T01とデザイン後 | 依頼者: apps/ios-swiftの同じ画面 | 同じJSONをdecodeし、同じ本文・出典・不明をSwiftUIで表示。表示差とiOSビルド結果を返す | Xcode/配布確認はMac担当。RN提出準備を妨げる演出は追加しない |
| T04 T01後 | Go君: services/backendの認可/domain案 | F04〜F09の人工主体・区間を関数/テスト化。通常/グループ、今回/継続を別判定し出力全体を制限 | API技術採用が必要。人工主体の成功を本人識別成功としない |
| T05 T01後 | 依頼者: worker/processing adapter | F01/F02/F03を入力→統合スクリプト/相違/出典検査。fixture adapterと生成adapterを分離し入力差し替えを確認 | モデル/処理先未決定の間はschema・人工adapterまで。実生成未接続は未達と表示。録音再評価に戻らない |
| T06 T02/T04後 | Go君/APIとRN、依頼者/Swift | 共有確認→保留/成立→継続解除まで同じ人工状態遷移。二重押し/通信断/対象版変更を確認 | 実相手への接続は認証・O04/O05の具体判断後。UIだけの成功を製品認可実績としない |
| T07 T02/T04/T05後 | Go君/API・RN、依頼者/Swift・処理 | 自分の入力訂正→旧派生遮断→再生成→出典履歴。F10/F12を通す | O07の訂正/削除/保持仕様採用後に永続化。競合は上書きせず再読込 |
| T08 条件解決後 | Go君/RN録音、依頼者/Swift録音・iPhone支援 | 開始→停止→保存状態を接続。各OSで中断・失敗・再試行を確認 | O03/O06/O07/O08と音声処理実行範囲の具体化後。今回の追加録音禁止を越えない |
| T09 T05〜T08後 | 両担当、共通APIはGo君 | 許可された実入力→統合案→出典→訂正をRN Android/iPhoneで通し、同契約へSwift接続 | 未達は実装/処理別に記録。人工成功で代替しない。提出判断は既存ロードマップの方針を維持 |

T01/T02でグループ全画面・認証SDK・クラウドDB・音声エンジンを同時導入しない。T04の人工権限ケースにはS04を残す。Q1の回答でグループを初回に含める場合は、その画面/管理タスクを追加する。

## 8. 技術候補と採用状態

RN Android/iPhone・SwiftUIの役割は決定済み。既存ロードマップの推奨候補はExpo/TypeScript、FastAPI/Pydantic/OpenAPI、Supabase Auth/PostgreSQL/Storage/Queues、Python worker、Render。**この準備ではいずれも新たに採用・導入しない。** 候補の現在の互換性・料金・運用成立も今回再検証していない。

推奨する採用順は、まず両クライアントの人工JSONとローカル起動に必要な部分、次に共通API、最後に送信・保持要件を満たす保存/AI経路。根拠となる既存一次資料と技術候補の詳細は[MULTIPLATFORM_DELIVERY_PLAN](../process/MULTIPLATFORM_DELIVERY_PLAN_20260912.md) §3/§11へ集約し、採用時に対象版と適合を確認する。

ローカル共通API準備は製品全体の端末内処理の決定ではない。人工データはGitに置けるが、実音声・転記・秘密情報をfixtureへ混ぜない。実音声は既存の個別許可から製品外部送信許可を導かず、接続先・データ種別・保持/削除を別途決める。

## 9. 当時の着手案（履歴）

当時はT01として人工入力・期待表示・エラーと最小schemaの作成を提案した。旧T01をそのまま依頼するテンプレートは撤去し、現在の着手は[MVP_SPEC §11](MVP_SPEC_2_0.md#11-実装順と最初のチケット)と[開発開始ガイド](../process/DEVELOPMENT_START.md)に従う。旧案の未回答を採用にしない。
