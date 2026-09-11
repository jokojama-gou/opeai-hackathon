# AIDD-Lite v1 の使い方

2人と各AIが同じ正本から必要な仕事を進めるための手順です。5つのskillは工程の強制ではありません。製品仕様を事前に固定せず、判断と検証を支えます。

## 入口と選択

リポジトリルートをCodexのプロジェクトとして開き、必要なskillを明示します。

| 依頼 | skill | 例 |
|---|---|---|
| 根拠を調べる・検証を計画する | [research](../../../.agents/skills/aidd-lite-research/SKILL.md) | $aidd-lite-research でV01の検証計画だけ整理して |
| 仕様・MVP候補を比較する | [design](../../../.agents/skills/aidd-lite-design/SKILL.md) | $aidd-lite-design で候補と未決定を整理して |
| 変更・修正と確認 | [implement](../../../.agents/skills/aidd-lite-implement/SKILL.md) | $aidd-lite-implement で指定箇所だけ修正して |
| 欠陥・証拠を点検する | [review](../../../.agents/skills/aidd-lite-review/SKILL.md) | $aidd-lite-review で差分を読み取り専用レビューして |
| 引き継ぎ・文書の不一致 | [handoff](../../../.agents/skills/aidd-lite-handoff/SKILL.md) | $aidd-lite-handoff で現在地を整理して |

名前による選択ができない場合は、表のSKILL.mdを明示して「この手順を読み、今回の依頼に適用」と伝えます。これは明示読込であり自動発見の確認ではありません。グローバル配置、プラグイン、hook、カスタムagent登録は不要です。自動発見は新しい会話のskill一覧に現れた場合に確認済みとします。

## 共通の判断と出力

[AGENTS](../../../AGENTS.md)、[開発手順](../DEVELOPMENT_PLAYBOOK.md)、[採用方針](../../decisions/AIDD_FW_ADOPTION.md)が正本への入口です。入力は開発手順の共通入力、出力は[WORKFLOW](../WORKFLOW.md)の結果様式を使います。小さな依頼は短い文章で十分です。製品に無関係な作業にD/S/O/Vを要求しません。

未知は採用方針のHUMAN-DECISION／VALIDATION／IMPLEMENTATION／LATERで整理し、依存する部分だけ保留します。過去の「今回」「次の作業」やskillの選択は、新しい実行許可ではありません。既に得た判断は再質問しません。

結果はケースごとに成功／失敗／未実行／実施不能／対象外（理由必須）を区別します。探索的な観測には測定結果と限界を記録し、製品合格とは呼びません。同条件で同じ失敗が続く場合は、根拠なく再試行せず、原因・再開条件を提示して独立作業を続けます。

## 判断が変わったとき

1. 明示された決定・理由と関係する正本を特定する。
2. 仕様・受入条件・テスト・説明資料のどこが影響を受けるか照合する。
3. 現依頼で許可された箇所だけ更新し、必要な再確認を行う。許可外は反映待ちを報告する。
4. 過去の証拠は対象版付きで保持し、新しい結果と区別する。

製品のMVP候補は比較できても最終確定はD14に従い技術検証後。技術的・利用価値の不確実性に必要な検証を選び、全Vの完了を要求しません。

## 2つのagentを使う

[researcher](agents/researcher.md)と[reviewer](agents/reviewer.md)はサブエージェントへの指示として渡す役割定義です。ファイルの存在だけでは別agentは起動しません。現在の依頼で委任が許可され、利用可能な起動機能がある場合だけ、主担当が必要な役割を起動します。

主担当は原要求、限定した仕事、対象版・未コミット変更、必要な正本、禁止事項、終了条件を渡します。期待する結論は渡しません。両役割は読み取り専用、再委任なし、モデル固定なし。結果を受け取り、主担当が根拠と最終対象版を照合します。変更や変更を伴う試験は主担当の責任です。

機能が使えない場合は役割を主担当が参照して確認できますが、独立レビューとは呼びません。通常作業で常時委任する規則ではありません。

## 確認方法と限界

リポジトリルートから次を実行できます。PowerShell 7を使用し、外部パッケージは不要です。

~~~powershell
pwsh -NoProfile -File ./scripts/check-aidd-lite.ps1 -RepoRoot .
~~~

これは今回の単純なfrontmatter・UI設定・ローカル参照の静的確認です。任意のYAMLやGitHubの描画、外部URL、AIの挙動は保証しません。利用試験と結果は[ACCEPTANCE](ACCEPTANCE.md)、必要な製品観点は[PROJECT_CHECKS](PROJECT_CHECKS.md)、意図と由来は[PROVENANCE](PROVENANCE.md)を参照します。

配置・静的確認、明示読込での利用、2役割の起動、自動発見、相手PCでの利用は別々に報告します。最後の2点が未確認なら、その環境で導入完了とは呼びません。
