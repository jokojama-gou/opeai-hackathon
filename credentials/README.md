# 音声APIキーの共有

取得済みAPIキーはルートの `.env.audio-models.local` に保存しています。2026-09-14のユーザー指定により、ハッカソン当日用のキーをプライベートリポジトリで共有するため、このファイルをGit除外から外しました。

`audio-models.env.enc.json` は既存の暗号化ファイルです。AES-256-GCMとランダムな256ビット鍵を使います。復号鍵 `.env.audio-models.encryption-key.local` は引き続きGit除外です。

2026-09-14時点でOpenAI・ElevenLabs・pyannote・Gemini・Speechmatics・Deepgram・AssemblyAIの7社とHugging Faceのモデル読取トークンを保存済みです。Google Cloud Speech用の認証JSONは `.env.audio-google-service-account.local.json` に保存しています。ユーザー指定のprivateリポジトリへ、これらの認証ファイルを共有します。実認証・モデルの利用可否は未検証です。[取得状態](../docs/development/AUDIO_API_CREDENTIALS_20260913.md)を参照してください。

## 別のPCで使う

1. `.env.audio-models.local` を含むコミットをpushした後、別PCでリポジトリを取得・更新します。
2. ルートの `.env.audio-models.local` を評価用バックエンドから読み込みます。キー値をクライアント用の公開環境変数には入れないでください。読み込みランナーは未接続です。
3. Google Cloud用の `GOOGLE_APPLICATION_CREDENTIALS` はリポジトリ直下のJSONを指します。別の作業ディレクトリから起動する場合はそのPCの絶対パスに解決します。`GOOGLE_CLOUD_LOCATION` はモデル・言語に対応したリージョンを実行前に設定します。

### 暗号化ファイルから復元する場合

平文ファイルが手元にない場合は、既存の復号手順も利用できます。

1. リポジトリを取得します。
2. 元のPCの `.env.audio-models.encryption-key.local` を、Gitとは別の安全な経路で受け取り、リポジトリ直下の同じ名前で保存します。このファイルを持つ人はAPIキーを復号できます。
3. Node.jsで次を実行します。既存の `.env.audio-models.local` がある場合は上書きせず停止します。

```sh
node scripts/audio-credentials.mjs open
```

復号先は `.env.audio-models.local` です。

## キーを追加・更新した後

```sh
node scripts/audio-credentials.mjs seal
node scripts/audio-credentials.mjs verify
```

`seal` はローカルの環境ファイル全体を暗号化し、既存の暗号化ファイルを更新します。元のキーは残します。復号鍵がない初回だけ鍵を生成します。`verify` はファイルの改ざん検出と元データとの一致を確認し、キー値は表示しません。

Gitへ追加するのは `.env.audio-models.local`、`.env.audio-google-service-account.local.json` と、更新した暗号化ファイルです。暗号化ファイルには環境ファイルの内容だけが入り、Google CloudのJSON本体は入りません。復号鍵を失うと、この暗号化ファイルからキーを復元できません。
