# スマホWeb / PWA

既存Expo Webをホーム画面へ追加できる構成。表示名「会話の記録」は説明用の仮称で、製品名の確定ではない。[現行仕様](../product/MVP_SPEC.md)に対する既存画面の未対応は残る。

## 起動

リポジトリルートで次を実行する。

```powershell
npm run build:web
node scripts/preview-pwa.mjs
```

PCでは `http://127.0.0.1:4173` を開く。previewは公開用サーバーではなく、PC内だけで利用できる。通常の `npm run web` は開発表示用で、Service Workerを登録しない。

スマホでのインストールには `apps/client/dist` の内容をHTTPSで配信する。既存Vercel設定はPWA用ヘッダーとビルド処理に対応。デプロイは今回実施していない。PCのlocalhost URLはスマホから開けない。

- iPhone：SafariでHTTPSのURLを開き、共有メニューから「ホーム画面に追加」。
- Android：対応ブラウザで「ホーム画面に追加」ボタン、またはブラウザの「アプリをインストール」を選ぶ。
- インストール後は独立したウィンドウで起動する。アイコンは192/512pxとApple用180pxを同梱。

## 動作と制約

- 初回のオンライン読込が成功すると画面の静的プログラムと画像をキャッシュする。API・音声・共有本文・認証情報はキャッシュ対象外。API機能には接続が必要。
- Webセッションは既存実装どおりメモリ内だけ。再起動後は再ログインする。人工デモの操作も再起動すると戻る。
- 更新は新しい静的ファイル一式の取得後に通知。入力中の自動再読込は行わず、すべてのタブ/ウィンドウを閉じた後に新しい版が有効になる。
- Web録音は未対応。API接続先なしのビルドは準備中の画面から人工デモを開ける。デモを実録音・実AIの結果として表示しない。
- 起動幅は最大600px、390px幅で操作確認。safe area、動的viewport、16px入力欄、44px以上の追加ボタンを使用。実機キーボード、OS別のインストールと更新は受け手の確認が必要。

## 確認

```powershell
npm run verify -- ui tooling docs
node --test scripts/pwa.test.mjs
npm run build:web
```

実機では初回起動→追加→独立起動、機内モードで起動、オンライン復帰、次版への更新を確認する。共有データの取得成功はAPI認証と権限を別途確認する。

実装方針は[Expo公式PWAガイド](https://docs.expo.dev/guides/progressive-web-apps/)のsingle出力・manifest・Service Worker構成を参照。
