# 音声APIキーの共有

`audio-models.env.enc.json` は取得済みAPIキーの暗号化ファイルです。AES-256-GCMとランダムな256ビット鍵を使います。平文の環境ファイルと復号鍵はGitに含めません。

2026-09-14時点の保存対象はOpenAI・pyannote・Speechmatics・Deepgram・AssemblyAIの5社です。APIの実行確認は未実施です。残件は[認証準備の記録](../docs/development/AUDIO_API_CREDENTIALS_20260913.md)を参照してください。

## 別のPCで使う

1. リポジトリを取得します。
2. 元のPCの `.env.audio-models.encryption-key.local` を、Gitとは別の安全な経路で受け取り、リポジトリ直下の同じ名前で保存します。このファイルを持つ人はAPIキーを復号できます。
3. Node.jsで次を実行します。既存の `.env.audio-models.local` がある場合は上書きせず停止します。

```sh
node scripts/audio-credentials.mjs open
```

復号先はGit除外の `.env.audio-models.local` です。キー値をクライアント用の公開環境変数には入れず、評価用バックエンドだけで読み込んでください。

## キーを追加・更新した後

```sh
node scripts/audio-credentials.mjs seal
node scripts/audio-credentials.mjs verify
```

`seal` はローカルの環境ファイル全体を暗号化し、既存の暗号化ファイルを更新します。元のキーは残します。復号鍵がない初回だけ鍵を生成します。`verify` はファイルの改ざん検出と元データとの一致を確認し、キー値は表示しません。

Gitへ追加するのは暗号化ファイルだけです。復号鍵を失うと、この暗号化ファイルからキーを復元できません。
