# Web文字起こしモックとGit競合解消（2026-09-15）

- 対象版：main HEAD 050f393、MERGE_HEAD 946b76d6243239fd8978e8872770ed619defdb02。開始時4ファイル未解決、両側の追加多数がステージ済み。EXPO_CLOUD_CONNECTIONとSETLOG_CONNECTED_MOCKの未ステージ変更は保持。退避はGit除外の .npm-cache/merge-mock-20260915。
- 依頼：Git競合解消後、文字起こし等を試せるモック画面。追加指定でWeb版を優先。主担当AIが既存clientの画面/fixture/Router、競合4ファイル、開発手順/現在地を担当。
- 関連：K02、M01/M05/M06、U02/U03/U07/U14/U16、AC01/07/14/15の人工表示・遷移部分。正式API契約を変更しない。fixtureはmock-transcription.tsの手書き架空会話2件、20260915版。
- 競合解消：LiveAppはWorkspaceProvider/Setlog画面を保持し、撤去済みChoicesを戻さない。APP_DEVELOPMENTはトンネル手順と新UI到達点を統合。WORKFLOWは両側全文を履歴に保持して現在地を短縮。lockは両側の依存を統合してnpmで再整合。
- 実装：Webルートから /mock、実APIは /live、従来の共有デモは /demo。模擬録音/停止→処理中→話者/時刻付き原文・要約・ToDo。要約/ToDoから原文参照、デモ内保存・再表示、エラー/無音と再試行。デモデータは画面を開いている間のメモリ内だけ。マイク・実音声・実ASR・実API呼出なし。
- 成功（自己確認）：型/UI11件、契約55件、tooling（入口7件・関連18件・文書検査自己テスト）、文書/Skill、PWA3件。Web本番export成功（987 modules、JS約1.6MB）、PWA30静的資産。lockのnpmオフライン再整合とworkspace依存範囲一致、git diff --check成功。未解決インデックス0件。
- ブラウザ成功：1280px/390px。デモ録音開始→停止→処理中→原文、要約→該当原文の強調、ToDo完了、デモ記録保存→一覧→再表示で完了状態保持、2つ目の会話、エラー→同じサンプル再試行、無音→本文非表示→再試行、/mock直接再読込→デモ状態リセットを確認。選択タブ・radio・checkboxのアクセシビリティ状態も確認。
- 再現→修正→成功：PWAのroot幅600px制限でデスクトップ結果欄が見切れたためWeb全幅へ修正。RN WebがaccessibilityStateのchecked/selectedをDOMへ反映しなかったためaria属性を明示し、ブラウザでchecked/selectedを確認。ルート配信のextensionless URLはSPAへ返して再読込可能にした。
- 環境による失敗と復旧：標準PATHにnpmなし。既存の .npm-cache/runtime/node-v22.20.0-win-x64 内のNode/npmを使用してlock整合とbuild成功。制限環境のtsxテストはWindows userInfo取得でENOMEMとなりテスト開始前に失敗。通常権限で同じ契約テスト55件成功。実API呼出はなし。
- 証拠：本タスクのコマンド/ブラウザ出力、.npm-cache/merge-mock-20260915 の開始時退避。ローカル配信は http://127.0.0.1:4180/mock （このPCのサーバー稼働中）。再起動はビルド後にPowerShellで $env:PORT='4180'; node scripts/preview-pwa.mjs。公開ではない。
- Git：競合4ファイルを解消済みとしてstage。マージcommit/pushは未実行。Web画面の新規差分は作業ツリーに保持。並行作業による隔離プレビューの文書/スクリプト追加も保持し、取り込んで上書きしていない。
- 対象外：実機/実録音/実ASR、音声精度/速度、nativeのVD/MX、外部公開・push（Web人工モックの依頼のため）。独立レビューは依頼なし。両側の既存機能の実サービス更新は行わない。
