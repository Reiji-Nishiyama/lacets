# 08. 開発環境

Lacets を手元で動かし、テストするための手順。設計の約束事は [`CLAUDE.md`](../CLAUDE.md) と [`docs/`](./) の各ページを参照。

## 必要なもの

- Node.js 24（`.nvmrc`。Vite 8 は Node 20.19+ / 22.12+ が必要）
- Chrome または Edge（Web Bluetooth を使うため。Safari は非対応）

## コマンド

```sh
nvm use
npm ci
npm run dev          # 開発サーバー（?sim=1 でシミュレータトレーナー）
npm test             # ユニットテスト（Vitest）
npm run e2e          # E2E テスト（Playwright）
npm run lint         # ESLint + Prettier チェック
npm run typecheck
npm run format       # Prettier で整形
npm run brand        # ロゴからファビコン・PWA アイコンを書き出す（docs/07-design.md「ロゴ」）
```

実機のトレーナーがなくても、`?sim=1` を付けて開くとシミュレータのトレーナーで走行まで試せる。

## E2E テスト

- 初回は `npx playwright install chromium` でブラウザを入れる
- Linux / WSL で共有ライブラリ不足（`libgbm.so.1` 等）のエラーが出る場合は `sudo npx playwright install-deps chromium` を実行する
- E2E では WebGL を無効にしている（GPU のない環境で地図の描画がページを固めるほど重いため）。地図・3D 地形の見た目は実機で確認する
- 外部の路上画像 API は `e2e/fixtures.ts` でモックしている

## 環境変数（任意）

| 変数                 | 内容                                                |
| -------------------- | --------------------------------------------------- |
| `VITE_MAP_STYLE_URL` | MapLibre の地図スタイル URL。未指定なら OpenFreeMap |

Mapillary のトークンと MapTiler のキーは、各自がアプリの設定画面で入力する（端末内にのみ保存）。

## テスト用ルート

- `test/fixtures/synthetic-lacets.gpx`: 架空の 21 ヘアピン・13.8 km の登り（`node scripts/generate-synthetic-lacets.mjs` で再生成）。`?sim=1` で取り込んで走行を試せる
- `test/fixtures/short-flat.gpx`: 67 m の平坦なルート。ゴールまで走り切る E2E 用

Strava API から取得したデータはフィクスチャにしない（`CLAUDE.md`「規約上の制約」）。

## README のスクリーンショット

`docs/images/` の画像は、シミュレータで合成ルートを走ったときの画面（iPad 横 1180×820）。
