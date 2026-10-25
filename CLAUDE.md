# CLAUDE.md — Lacets（ラセ）

このファイルは Claude Code 向けの引継ぎ資料です。作業開始時に必ず読み、詳細は `docs/` を参照してください。

## プロジェクト概要
実在のルート（ツール・ド・フランスの峠、富士ヒルなど）を、スマートトレーナー上で「実際に走っているかのように」再現するインドアサイクリング Web アプリ。
- ルートの勾配をトレーナーの負荷として再現する（SIM モード）
- 過去の実走データ（FIT）と比較し、仕上がり具合を確認する（ゴースト機能）
- 実走映像・オープンなストリートビュー画像を走行位置に同期して表示する

プロジェクト名 "Lacets" は、ラルプデュエズの21のつづら折り（les lacets）に由来する仮称。

## 現在のフェーズ
`docs/03-roadmap.md` を参照。マイルストーンの完了時は同ファイルのチェックボックスを更新すること。

## 技術スタック（決定済み）
- フロント: TypeScript / React / Vite（PWA）
- トレーナー接続: Bluetooth FTMS 標準プロファイル。BLE 通信は `BleTransport` で抽象化し、Web Bluetooth 実装と Capacitor（iOS ネイティブ）実装を差し替え可能にする
- iOS/iPadOS: 段階1 は Bluefy（Web Bluetooth 対応ブラウザ）、段階2 は Capacitor で iPad アプリ化（TestFlight 配布）
- 状態管理: Zustand、永続化: IndexedDB（Dexie）
- 地図: MapLibre GL JS
- FIT 読み書き: `@garmin/fitsdk`
- バックエンド: Cloudflare Workers（Strava OAuth のトークン交換・更新のみ。ユーザーデータは保存しない）
- テスト: Vitest（ロジック）、Playwright（E2E、トレーナーはシミュレータを使用）

## 対象プラットフォーム
| 環境 | ブラウザ/形態 | 位置付け |
|---|---|---|
| Windows PC | Chrome / Edge | 主要（仲間の多数派） |
| macOS（開発機 M4 MacBook Pro） | Chrome / Edge | 主要・開発環境 |
| iPad | Bluefy → Capacitor アプリ | サポート（段階的に対応） |
| Android | Chrome | ベストエフォート |

Safari（macOS/iOS）は Web Bluetooth 非対応のため非サポート。

## 想定ハードウェア
- Wahoo KICKR Core 2（通常の 11s/12s/13s カセットを装着、**変速は自転車の実変速**）
- Zwift Cog / Click / バーチャルシフトは**対象外**
- 心拍計（BLE Heart Rate Service）は任意

## 重要な設計原則
1. **ドメインロジックは純粋関数で書く。** 物理モデル、勾配計算、ルート解析、ゴースト比較は `src/domain/` に置き、ブラウザ API に依存させない。ユニットテスト必須。
2. **トレーナーは二段で抽象化する。** 上位は `TrainerDevice`（`FtmsTrainer` / `SimulatedTrainer`）、下位は `BleTransport`（`WebBluetoothTransport` / `CapacitorBleTransport`）。FTMS のプロトコル処理は `FtmsTrainer` に一つだけ書き、トランスポートに依存させない。Claude Code の環境からは Bluetooth にアクセスできないため、**すべての機能はシミュレータで動作確認できること**。
3. **速度はアプリ側の物理モデルで計算する。** トレーナーが報告する速度は使わない（フライホイール由来で実走速度ではない）。パワー → 速度 → 走行距離を積分する。
4. **ユーザーデータはローカル保存が原則。** サーバーにルートや走行データを置かない（Strava 規約・プライバシー対応）。
5. **外部サービスはアダプタ層に隔離する。** `src/integrations/{strava,mapillary,panoramax,google-sv}/`。規約変更時に差し替えやすくする。
6. **ブラウザ固有 API は機能検出してフォールバックする。** File System Access API（iPad 非対応）、Screen Wake Lock 等は `src/platform/` にまとめ、直接呼ばない。

## 規約上の制約（必ず守ること）
- **Strava API から取得したデータを AI（Claude を含む）のプロンプトに入れない。** Strava API Policy で AI アプリケーションでの利用が禁止されている。テストフィクスチャは自作 GPX や合成データを使い、実際の Strava API レスポンスを貼り付けてデバッグしない。
- Strava データは取得したユーザー本人にのみ表示する。仲間同士でのルート共有機能を Strava API 経由で作らない（共有は GPX ファイル経由）。
- Google ストリートビューの画像はキャッシュ・保存しない（pano_id のみ保存可）。
- Mapillary / Panoramax の画像はクレジット表記を必ず表示する。
- 詳細は `docs/04-external-services.md`。

## ディレクトリ構成（予定）
```
src/
  domain/          # 純粋ロジック（physics, course, ghost, units）
  devices/         # TrainerDevice, FtmsTrainer, SimulatedTrainer, HeartRate
  devices/ble/     # BleTransport, WebBluetoothTransport, CapacitorBleTransport
  platform/        # ファイル保存・Wake Lock 等の環境差吸収
  integrations/    # strava, mapillary, panoramax, google-sv
  media/           # 映像同期、画像シーケンス表示
  ride/            # RideEngine（走行ループ。純粋な計算は domain/ride）
  recording/       # 走行記録、FIT エクスポート
  store/           # Zustand ストア
  ui/              # React コンポーネント
worker/            # Cloudflare Worker（Strava OAuth）
ios/               # Capacitor 生成物（M8 で追加）
test/fixtures/     # 自作 GPX/FIT（Strava API 由来のデータは置かない）
scripts/           # フィクスチャ生成などの補助スクリプト
docs/
```

## コマンド（M0 で整備）
- `npm run dev` 開発サーバー（`?sim=1` でシミュレータトレーナー）
- `npm test` ユニットテスト
- `npm run e2e` E2E テスト
- `npm run lint` / `npm run typecheck`

## コーディング規約
- 単位は SI 単位系で内部統一（m, s, W, kg, m/s, 勾配は小数 0.08 = 8%）。表示時のみ変換。変数名に単位を付ける（`speedMps`, `distanceM`, `gradePct` は禁止し `grade` は常に小数）。
- BLE のバイト列エンコード/デコードは専用モジュールにまとめ、ユニットテストで仕様書の例と照合する。
- コメント・コミットメッセージは日本語可。UI 文言は日本語を基本とし、i18n を前提に文字列を直書きしない。

## 参照ドキュメント
- `docs/01-requirements.md` 要件定義
- `docs/02-architecture.md` アーキテクチャと主要アルゴリズム
- `docs/03-roadmap.md` マイルストーンとタスク（MVP = M0〜M2、走行動画は M8 に後回し）
- `docs/04-external-services.md` 外部サービスの仕様・規約メモ
- `docs/05-ble-ftms.md` Bluetooth FTMS プロトコルメモ
- `docs/06-calibration.md` 負荷のキャリブレーション（#7）の手順とデータの扱い
- `docs/07-design.md` デザインの世界観・色・文字・部品・画面構成（UI を作るときは必ず従う）
- `docs/08-development.md` 開発環境・テスト・環境変数・テスト用ルート
