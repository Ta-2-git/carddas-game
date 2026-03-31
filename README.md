# スティックマン カードダスバトルゲーム

## ファイル構成

```
carddas-game/
├── index.html          ← エントリーポイント
├── package.json        ← パッケージ設定
├── vite.config.js      ← ビルド設定
├── wrangler.toml       ← Cloudflare Pages 設定
└── src/
    ├── main.jsx        ← React起動ファイル
    └── App.jsx         ← ゲーム本体（このファイルを編集）
```

## GitHubへのアップロード手順（スマホ）

1. GitHub で `carddas-game` リポジトリを作成
2. 上記のファイルをすべてアップロード
   - `index.html`
   - `package.json`
   - `vite.config.js`
   - `wrangler.toml`
   - `src/main.jsx`
   - `src/App.jsx`

## Cloudflare Pages デプロイ設定

| 項目 | 値 |
|------|-----|
| フレームワーク | Vite |
| ビルドコマンド | `npm install && npm run build` |
| 出力ディレクトリ | `dist` |
| Node.js バージョン | 18 以上 |

## R2 の使い方

1. Cloudflare ダッシュボード → R2 → バケット作成
2. GLBファイルや画像をアップロード
3. パブリックアクセスを有効化
4. 発行されたURL（例: https://pub-xxx.r2.dev/goku.glb）を
   `src/App.jsx` の `MODEL_PATHS` に設定
