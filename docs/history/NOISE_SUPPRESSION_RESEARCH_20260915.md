# 音声の雑音除去モデル候補（2026-09-15）

## 依頼・対象版・範囲

- 依頼：「雑音削除するためのモデルってなんかある？」。音声を想定し、候補と用途の違いを答える調査。終了条件は一次情報に基づく候補整理まで。
- 対象版：HEAD `3a5890e`。開始時にclient、backend、OpenAPI、WORKFLOWの既存変更とbackend移行/競合修復の未追跡記録・テストあり。既存変更を保持。
- 担当：主担当のみ。変更先は本記録とWORKFLOWの参照。K/M/U/受入IDの完了判定、契約/fixture変更は対象外（方式未採用の質問回答）。

## 候補と根拠

2026-09-15に各公式リポジトリ・著者資料を閲覧。最新コミットや依存関係の動作までは検証していない。

| 候補 | 確認した特性 | 一次情報 |
|---|---|---|
| DeepFilterNet / DeepFilterNet3 | 音声の雑音抑制。リアルタイム処理を想定し、録音ファイル処理用CLI/Python経路もある | [公式リポジトリ](https://github.com/Rikorose/DeepFilterNet)、[2023年論文](https://arxiv.org/abs/2305.08227) |
| RNNoise | 信号処理とニューラルネットを組み合わせた小さく高速なリアルタイム雑音抑制。C実装 | [公式リポジトリ](https://github.com/xiph/rnnoise)、[著者解説](https://jmvalin.ca/demo/rnnoise/) |
| Resemble Enhance | 雑音除去と、歪みの復元・帯域拡張による音質改善を分けて提供。雑音除去のみの実行も可能 | [公式リポジトリ](https://github.com/resemble-ai/resemble-enhance) |

提案：録音後の比較候補はDeepFilterNet3、端末での軽量な常時処理候補はRNNoise。適合性についての推奨であり、本アプリでの性能順位や端末動作の実測ではない。ASR用途では原音と処理後を同じ文字起こし経路で比較するのが次の候補。音の聞きやすさだけで認識精度向上と判定しない。

## 確認・限界・次の判断

- 成功：一次情報の閲覧、WORKFLOWの端末直接ASR方針確認。
- 環境上の失敗：通常のGit読取は所有者差異で拒否。対象ディレクトリだけのコマンド単位のsafe.directory指定で読取成功。永続設定変更なし。
- 文書検証成功：`npm run verify:docs` が2/2 PASS。98 Markdown/HTML・1009参照と、6 skills・18管理ファイルを検査。外部URLの内容・意味・モデル動作を保証する検査ではない。
- 未実行：モデル導入、人工/実音声処理、ASR比較、端末性能測定、独立レビュー。調査のみの依頼のため実装・仕様採用・外部書込なし。
- 残る確認：消したい音が環境音か別の人の声か、録音中か録音後か。目的の人の声だけを残す場合は目的話者抽出等を別途調べる。

## 継続質問：APIとキー取得先（2026-09-15）

- 依頼：「Apiあるのは？ apiキーおれがもらってくるよ」。APIを提供する候補と取得先の案内まで。対象版 `307d1a6`、開始時差分なし。主担当が本記録とWORKFLOWのみ更新。K/M/U/受入・契約/fixture変更なし。
- 第一候補：[ElevenLabs Voice Isolator](https://elevenlabs.io/docs/overview/capabilities/voice-isolator)。[API](https://elevenlabs.io/docs/api-reference/audio-isolation/convert)は `POST /v1/audio-isolation` にファイルを送る。[キー取得先](https://elevenlabs.io/app/developers/api-keys)は公式quickstartから確認。録音の雑音除去からASRへ渡す比較候補であり、認識精度の改善は未検証。
- 第二候補：[Resemble Audio Enhancement](https://docs.resemble.ai/audio-tools/audio-enhancement)。非同期で送信・状態確認・音声取得。`remove_noise`、`normalize`、`studio_sound`を個別指定できる。[認証手順](https://docs.resemble.ai/getting-started/authentication)のAccount → APIからキーを取得。先のOSS Resemble EnhanceとホストAPIの使用モデルの同一性は確認していない。
- その他：[Audo API](https://www.audo.ai/api)は録音後の雑音除去APIを提供し、公式サイトにRequest Access導線がある。即時発行は未確認。
- 既存[直接ASR](../development/DIRECT_ASR.md)にはElevenLabs `scribe_v2`経路がある。既存キーの再利用は権限・残高次第。今回キー自体を読取・発行・認証確認していない。
- 一次情報を2026-09-15に確認。価格はResembleの製品ページとAPI文書に請求単位の相違があるため、今回は料金の断定を避ける。WebからのCORS、実スマホ、処理遅延、原音/処理後のASR比較は未検証。
- 実API実行・音声処理・導入・製品仕様採用・外部書込・独立レビューは依頼対象外。文書確認は `npm run verify:docs` の実行出力を証拠とする。
