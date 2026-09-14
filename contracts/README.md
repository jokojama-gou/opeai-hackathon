# 共通契約と人工入力

参照仕様は[MVP_SPEC 2.2 §9](../docs/product/MVP_SPEC.md#contracts)。契約版 `mvp-2.2-k01-v1`。

`schema.mjs`から`mvp-v1.schema.json`を生成し、同じJSONから`packages/api-ts/src/schema.ts`を生成する。`npm run contracts:generate`で再生成、`npm run test:contracts`で構造と意味を検証する。入力は全て人工で、判定時刻と閲覧者を固定している。

| 仕様 | コードへの対応 |
|---|---|
| §6 録音/送信/統合の独立状態 | Recording.capture_status/upload_status、Conversation.status。成功へ相互変換しない |
| §9.3 版/出典/文字位置 | EvidenceRef。Unicode code point、整数ms半開区間。時刻不明は両端null |
| §5 相違/順序/話者 | ScriptItem.kind、order_status、speaker_labelを独立保持。本文は出典から復元 |
| §9.4 未共有snapshot | ConnectionSnapshot。相手の原文/録音日時を含まない |
| AC07/10/13 | expiredの3例。音声のみ期限/文字期限/共有失効を別応答として保持 |

JSON schemaは構造、`validate.ts`は版・範囲・参照・期限・未成立本文の整合を確認する。サーバー認可・実音声の検証を代替しない。外部ASRの応答形式とモデル・分割設定はこの契約では採用しない。追加機能のAPI型は実装対象ごとに別途定義し、K01の4fixtureだけでMVP全契約の完成とはしない。
