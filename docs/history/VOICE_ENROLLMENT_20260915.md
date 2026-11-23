# 声の登録準備：2026-09-15

## 依頼・対象版・範囲

開始版 `307d1a6`。ユーザー依頼は声の事前登録実装とpush。外部登録APIが未確認であることを説明した上で「最大7日で登録準備を実装する」を採用。続く指示でログインを外し、iOSはひなた、Androidはごう、Webは選択とした。先に作ったログイン画面への一時導線は取り除いた。

既存差分：着手時の製品コードはclean。その後発生したWORKFLOWの雑音除去調査行とNOISE_SUPPRESSION_RESEARCHの変更は他作業として保持。今回commitには含めない。

関連：K02/K03/K04の録音・端末保存部分、M01/U02、AC01/14、D05/D13。新規採用仕様はMVP_SPEC §9.0.1。全K・既存AC全体の完成ではない。主担当による実装/自己確認であり、独立レビューなし。

## 変更・契約

Appからログイン不要のDeviceVoiceEnrollmentへ進む。固定端末IDごとに声を録音、プレビュー、準備済み保存、削除。既存direct-asr-v1のローカルEntryに任意voice_profileを追加（state=prepared、provider=elevenlabs、model=scribe_v2）。通常録音とはowner名前空間を分け、ASR/旧処理の入口で登録音声を拒否。サーバー契約とfixtureの版変更なし。録音hookには画面破棄中の準備キャンセル/停止を追加した。

保存期限を再登録で延ばさず、期限切れを利用不可とする。物理削除は次回読込/復帰時。アプリ停止中のOSタイマー削除は未実装。ネイティブの原音保存先には既存のバックアップ除外を使う。外部送信や認証された本人判定はしない。

## 調査の根拠

[ElevenLabs公式STT API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)と[2026-06-15履歴](https://elevenlabs.io/docs/changelog/2026/6/15)でuse_speaker_libraryを確認。公開OpenAPIも読み取り、登録済み話者照合の指定はあるが、話者ライブラリの登録/削除エンドポイントは見つけられなかった。TTS voice cloningを代用しない。公開仕様はGit除外の `.npm-cache/speaker-enrollment/elevenlabs-openapi.json` に保存。外部登録・照合は未接続。

## 検証

- 人工データ：登録音声の分離、誤った端末ID/会話音声の拒否、不正/中断録音の拒否、7日境界、OS名割当の5テスト。
- 型検査：不要import整理でWeb側のvoiceOwner参照を外しすぎて1回失敗。importを復元してtypecheck成功。
- UI・contracts・toolingの各テスト成功。最終の `npm run verify -- ui contracts tooling docs` は8/8 PASS（UI11、contracts55、runner7、tooling18）。証拠は `.npm-cache/speaker-enrollment/verify-final.log`。
- iOS/Android/Web export成功。最初はsandboxのHermes実行権限で失敗したが、ローカルコンパイラの承認付き実行で成功。生成物は `.npm-cache/speaker-enrollment/export`（Git除外、キー入り配布用のためcommitしない）。
- localhostのWebで登録入口→ひなた→ごうの表示、ログイン不要、通常録音画面へ戻る操作を確認。録音やマイク許可は実行していない。
- 実機マイク・保存・プレビュー・削除の通し操作、実音声、外部登録/照合、実機配布は未実行。今回のpushはコード共有であり、APK/IPA更新ではない。

## 残件

実機で録音から削除まで本人が確認する。外部話者ライブラリの登録/削除方法とworkspace利用条件・外部保存期限の確認後に照合を接続する。端末名を話者本人や共有認可へ流用しない。
