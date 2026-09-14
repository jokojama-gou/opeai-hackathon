# 現在のAPIキーを保持した保管修正

2026-09-15。依頼は「現在のAPIキーのまま、現在のレポジトリを修正」、続いて「全てをPR,マージして」。開始HEADは `4ecab1d2af34c50abb8f570de87c38dcd64b4154`。既存の復元89ファイルと、同時進行のSetlog画像・動く見本・DREAM TAPEの編集を保持した。

## 実施した変更

- APIキー7社・HFトークンを含む環境ファイルとGoogle Cloud認証JSONを、Windowsユーザー本人のDPAPI暗号化保管庫へ移管。両ファイルのSHA-256と復号後のバイト一致を確認し、キーを変更・失効・再発行していない。
- 保管先はリポジトリ外の `%LOCALAPPDATA%\OpeaiHackathon\Secrets\audio-credentials.dpapi`。フォルダの権限継承を解除し、本人とSYSTEMだけに許可。別アカウント/別PCでの利用には別の安全な引き渡しが必要。
- `.env.audio-models.local` と `.env.audio-google-service-account.local.json` をGit indexから外し、保管庫の再検証後に作業ツリーの平文を除去。履歴更新前は削除2件だけをステージし、他の未コミット変更を保持した。
- 平文共有のgitignore例外を撤去。旧CLIの平文復元を無効化。[新しい手順](../../credentials/README.md)はPowerShell 7で確認/限定したバックエンド起動を行う。
- [保管スクリプト](../../scripts/audio-vault.ps1)はGoogle JSONを本人専用の実行時フォルダへ復号し、正常終了・子プロセス失敗時に削除。プロセス環境も戻す。強制終了/電源断時は残存し得るため手順に明記。
- [検査](../../scripts/check-repository-secrets.mjs)とpre-commit/pre-push hookを追加。このクローンで有効化済み。staged bytesを検査し、push前には全ローカル履歴も検査する。認証情報を含む旧履歴の再投入も停止する。
- GitHub Actionsに読み取り権限だけの検査を追加。公式ActionのコミットIDを固定。実行結果は対象PRのchecksを参照する。既存の[配布物検査](../../scripts/check-client-secrets.mjs)も保管庫からの入力とGoogle秘密鍵の検査へ対応。

## 検証

- `node scripts/verify.mjs security tooling docs`：関連6検査が成功。暗号化・改ざん・既存ファイル保護・Git index検査・Windows実行時の環境/一時ファイル処理・配布物へのキー混入を扱う7テストと、検証入口7テストが成功。文書は64ファイル・755参照、管理metadataは16ファイルを確認。
- PR集約前にNode 22.20.0で `node scripts/verify.mjs all` を実行し、10/10検査・57テストが成功。型・文書65件/764参照・管理metadata16件も確認。履歴修正前の277ファイルをリポジトリ外へ退避し、履歴更新後のバイト一致を確認した。
- 実キーは保管・一致確認・ローカル漏出検査だけに使用。外部API、音声送信、モデル実行、課金、再発行は未実施。
- 復元済み資料・画像等の対象外ファイルは基準ハッシュで照合。作業中のSetlog README/WORKFLOWの別編集は保持し、本記録だけを最新WORKFLOWへ追加する。
- 配布アプリの新規build、実機、Windowsアカウント侵害に対する防御、ディスクからの物理的な復元不能性は検証範囲外。

## GitHubとローカルの履歴から除去

GitHubは現在private。通常のファイル削除だけでは過去のキーを消せないため、本人だけがアクセスできる別のmirrorで公式git-filter-repo v2.47.0を用いて履歴を作成し、ユーザー承認後に反映した。

- 検証用コピー：`%LOCALAPPDATA%\OpeaiHackathon\HistoryCleanup-20260915\minimal.git`。
- 対象は認証ファイル追加後のmainの6コミット。`main: 4ecab1d2af34c50abb8f570de87c38dcd64b4154 → 30d2147bccc8a12c79d7c702c3f43e07518700fd`。
- 6コミットの全treeについて認証ファイル以外のmode/path/blob ID一致を確認。履歴除去ではほかの3ブランチと5つのPR参照を変更しなかった。その後、既存編集を現在の作業ブランチからPRへ集約する。
- 除去後の全参照/履歴を、実キーとの一致・秘密鍵形式・認証ファイル名で検査して成功。mainだけを旧SHAの一致を条件にしたforce-with-leaseで更新し、GitHub側が `30d2147` になったことを再取得して確認した。
- ローカルのindexが除去後mainのtreeと完全一致することを確認して、作業ブランチの参照を更新。作業ファイル・indexを上書きせず、退避stashと他の作業ブランチを保持した。
- ローカルで認証履歴に紐づくreflog4件を除去。無関係な未参照オブジェクト13件は実キーで検査して `refs/local-recovery/20260915/` の専用参照で保持した。全オブジェクトを列挙し、整理対象が認証履歴由来の16件のみであることを条件に除去。処理後も他の全オブジェクト・参照・stashの保持を確認した。
- GitHubのキャッシュ等や、他の人が保持したコピーまで完全に消去済みとは扱わない。共有履歴は変更済みのため、旧mainを持つ別クローンは未公開の編集を退避してから再取得・再統合し、旧履歴を再pushしない。キー自体は変更していない。

手順と限界：[GitHub公式の履歴除去](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
