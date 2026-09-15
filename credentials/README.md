# 音声認証情報の保管

## 当日の設定共有（2026-09-15）

ユーザー承認により、現在の端末にあるOpenAI・Expo・pyannote・Supabase・Vercelの5つのローカル設定を `hackathon-settings.enc.json` にAES-256-GCMで暗号化して共有する。元ファイルと復号後のバイト一致を確認済み。平文・復号鍵のGit除外と秘密情報検査は維持する。

復号鍵はランダムな256ビット鍵をBase64で保存した `share-key.txt`。このPCでは `%LOCALAPPDATA%\OpeaiHackathon\HackathonShare-20260915\share-key.txt` に本人とSYSTEMのみがアクセスできる権限で保存した。共有相手へはGitとは別の経路で渡す。鍵をコミット・チャットログ・公開成果物へ貼り付けない。

受け手はNode.js 22.20.0で、リポジトリルートから次を実行する。鍵ファイルと復元先はリポジトリ外を指定し、復元先にはまだ存在しないディレクトリを使う。

```sh
node scripts/share-credentials.mjs verify /absolute/path/to/share-key.txt
node scripts/share-credentials.mjs unpack /absolute/path/to/share-key.txt /absolute/path/to/new-private-settings
```

Windowsでは上記のパスを `C:/Users/自分/private/share-key.txt` 等へ置き換える。復元された5ファイルから必要なものだけをローカルの設定として読み込む。アプリの公開環境変数へ管理キーを入れない。鍵を紛失するとこのコピーは復号できない。当日終了でキーが自動失効する仕組みではない。

以下の音声モデル用DPAPI保管庫は資料上の記録で、この共有作業時の端末には見つからなかった。音声モデル各社・Google Cloud秘密鍵は今回の5ファイルの共有に含めていない。別PCでの復元・サービス認証は未検証。

## 既存の音声モデル保管記録

2026-09-15。APIキー7社・Hugging Faceトークン・Google Cloud秘密鍵の値を維持し、平文のGit共有を終了する。発行履歴は[取得記録](../docs/development/AUDIO_API_CREDENTIALS_20260913.md)。

## このWindows PCでの保管

正本はリポジトリ外の `%LOCALAPPDATA%\OpeaiHackathon\Secrets\audio-credentials.dpapi`。Windows DPAPIのCurrentUserで2ファイル全体を暗号化する。復号用の鍵ファイルはリポジトリへ作らない。保管フォルダは継承権限を外し、実行した本人とSYSTEMだけを許可する。

このファイルは保管したWindowsユーザーのプロファイルに依存する。単に別PCへコピーしても復号できない。別PCへの引き渡しやPC移行は、別途承認した秘密情報管理サービス等の安全な経路で行う。Windowsアカウント/プロファイルを失うと復旧できない可能性がある。旧AES-256-GCMファイルは過去の暗号化コピーとして保持するが、Google Cloud JSONを含まず、このPCに復号鍵はない。

PowerShell 7で暗号化ファイルの復号・内部ハッシュを確認する。実キーを表示せず、外部APIも呼ばない。

```powershell
./scripts/audio-vault.ps1 -Action verify
```

## バックエンドで必要なときだけ使う

```powershell
./scripts/audio-vault.ps1 -Action run -Executable node -CommandArguments @('path/to/approved-backend-runner.mjs')
```

これは呼出形式の例。指定したプログラムには実キーを渡すため、検証済みのバックエンドだけを実行する。音声APIキー8変数とCloudのproject/locationを読み込み、Google Cloud JSONは本人専用の一時フォルダへ復号する。終了時に一時JSONを削除し、プロセス環境を元に戻す。OSの強制終了/電源断では一時ファイルが残り得るので、保管フォルダ内のrun-*を確認する。通常起動やExpoへの自動注入はしない。GENERATION_API_KEYへの転用、ASR接続、Cloudリージョン、予算等は別の設定で、今回有効化しない。

## Gitと再混入防止

平文env・Cloud JSON・復号鍵を追跡しない。平文を許可していた.gitignoreの例外を撤去する。旧node scripts/audio-credentials.mjsの平文復元CLIは無効化し、既存暗号化データの検証用関数だけを維持する。

```sh
npm run security:hooks
npm run verify:security
```

pre-commitは作業ファイルではなくステージ済みの内容を検査する。pre-pushは現在ファイルと全ローカル履歴を検査し、過去の平文が残る間は停止する。ファイル名・既知のキー形式・秘密鍵形式を検査する方式で、未知の全秘密を検出できる保証はない。保管庫から検査を起動すれば実キー値との一致も検査する。hookはクローンごとの設定なので、他の開発者も設定する必要がある。

## GitHub履歴の更新と別クローン

2026-09-15に、認証情報を含むmainの6コミットを除去後の履歴へ更新した。認証情報以外の各コミットの内容と、既存の編集・stashを保持したことは[保管修正と履歴除去の結果](../docs/development/CREDENTIAL_STORAGE_20260915.md)を参照する。旧mainを持つ別クローンでは未公開の編集を退避し、更新後の履歴を再取得・再統合する。旧履歴をそのまま再pushしない。GitHubのキャッシュや他のコピーまで完全に消去済みとは扱わない。
