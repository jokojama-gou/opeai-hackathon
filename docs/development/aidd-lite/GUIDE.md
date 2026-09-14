# AIDD-Liteの索引

作業規則は[AGENTS](../../../AGENTS.md)、現在地は[WORKFLOW](../WORKFLOW.md)、担当・実装順は[ロードマップ](../MULTIPLATFORM_DELIVERY_PLAN.md)。手順・仕様をここで再定義しません。

| 仕事 | 必要な場合だけ使うskill |
|---|---|
| 調査 | [research](../../../.agents/skills/aidd-lite-research/SKILL.md) |
| 設計 | [design](../../../.agents/skills/aidd-lite-design/SKILL.md) |
| 実装・修正 | [implement](../../../.agents/skills/aidd-lite-implement/SKILL.md) |
| レビュー | [review](../../../.agents/skills/aidd-lite-review/SKILL.md) |
| 引き継ぎ | [handoff](../../../.agents/skills/aidd-lite-handoff/SKILL.md) |

名前で選べない場合は対象SKILL.mdを明示して読ませます。全skillの連続実行・追加インストール・全資料通読は不要です。[製品チェック索引](PROJECT_CHECKS.md)から該当受入条件へ進みます。

判断変更の反映・レビュー・出力はAGENTSに従います。委任が許可された時だけ[researcher](agents/researcher.md)／[reviewer](agents/reviewer.md)の役割を渡します。役割定義は読み取り専用・再委任なしで、主担当が対象版と根拠を照合します。

[採用原則](../../decisions/AIDD_FW_ADOPTION.md)、[由来](PROVENANCE.md)、[過去の利用確認](ACCEPTANCE.md)は必要時の参考です。自動発見・相手PCでの利用・製品動作は別々に確認します。

文書・Skillの変更後はルートで `npm run verify:docs` を実行します。skill metadataとローカル参照・使用アンカーをまとめて検査し、失敗・起動不能を成功扱いにしません。UI等も変更した場合は[検証入口](../APP_DEVELOPMENT.md#verification)から該当対象を併用します。意味の正しさやAIの参照行動を保証するものではありません。
