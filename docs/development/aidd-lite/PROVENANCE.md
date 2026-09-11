# AIDD-Lite v1 の意図と出自

参照版はAIDD-FW 3.1.1、コミット `59d7e9985eaf99674b51a90ac06482b9ed88c49a`。利用許諾確認済みというユーザーの決定を反映しています。本体の一括コピーではなく、調査済み手順から今回向けに書き直しました。上流の最新版への自動追従はしません。

| 構成 | 分類・参照元 | 改変理由 |
|---|---|---|
| research | 上流から改変：[aidd-research](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-research/SKILL.md) | 一律の並列調査・保存・commitを除き、問いと根拠を残す |
| design | 上流から改変：[aidd-new-epic](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-new-epic/SKILL.md)、[aidd-epic-design](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-epic-design/SKILL.md) | Story・受入条件・分割を残し、Issue・全階層・codegraph必須を除く |
| implement | 上流から改変：[aidd-epic-impl](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-epic-impl/SKILL.md)、[aidd-impl-acceptance](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-impl-acceptance/SKILL.md) | 証拠を残し、未実行PASS・Issueゲート・自動closeを採用しない |
| review | 上流から改変：[aidd-review](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-review/SKILL.md) | 根拠を伴う指摘を残し、一律の多人数起動・点数・自動修正を除く |
| handoff | 上流から改変：[aidd-doc-drift](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/skills/aidd-doc-drift/SKILL.md) | 文書との差を検出し、既存WORKFLOWへ接続する |
| researcher / reviewer | 上流を参考に新規構成：[researcher](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/aidd-framework/agents/researcher.md)、[qa-engineer](https://github.com/spikestudio/aidd-fw/blob/59d7e9985eaf99674b51a90ac06482b9ed88c49a/aidd-framework/agents/qa-engineer.md) | モデルやFW階層を固定せず、読み取り専用の委任用役割に限定 |
| GUIDEの判断境界・記録・変更反映 | 既存規則の手順化：[開発手順](../DEVELOPMENT_PLAYBOOK.md)、[採用方針](../../decisions/AIDD_FW_ADOPTION.md) | 正本を重複せずskillから使う |
| PROJECT_CHECKS | 既存規則の手順化：[製品正本](../../product/PRODUCT_CORE.md)、[VALIDATION](../VALIDATION.md) | 製品固有の見落としを防ぐ索引 |
| Codex UI・利用試験・静的検査 | 今回新規提案 | 呼び出し可能性と判断の実際を分けて確認する |
| デモと2人の受け渡しへの接続 | 既存方針を今回の手順に具体化 | 大会条件や権限を創作せず、成果と証拠を共有する |

## この構成を選ぶ理由

5つの短い入口に分けることで、既存文書だけの運用に対して参照漏れ・再調査・判断の取り違えを減らすことを期待します。2役割に絞ることで主担当の統合責任を保ちます。全作業にskillやagentを要求しません。

これは期待効果です。速度・精度・費用の比較実測はありません。[利用試験](ACCEPTANCE.md)は限定された挙動確認であり、優位性の証明ではありません。実利用で具体的な不足が見つかったら該当手順を修正し、関連ケースを再確認します。新しいskillやagentは既存構成で扱えない繰り返す仕事が明らかになったときに検討します。
