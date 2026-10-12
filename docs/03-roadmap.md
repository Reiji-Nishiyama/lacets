# 03. ロードマップ

各マイルストーンは「動くものが手元に残る」単位で区切っている。

**MVP = M0〜M2**（走行動画なし。地図と勾配プロファイルで走る）。走行動画は用意できるまで後回しにし、映像体験はまず動画不要の 3D 地形ビューとオープンな路上画像で補う（M5）。自前動画の同期は M8 に移動した。完了条件（DoD）を満たしたらチェックを入れる。
実機（KICKR）が必要な確認は【実機】と表記。それ以外はシミュレータで確認できること。

## M0. 開発基盤
- [x] Vite + React + TypeScript（strict）でプロジェクト作成
- [x] ESLint / Prettier / Vitest / Playwright 導入
- [x] GitHub Actions で lint・typecheck・test
- [x] PWA 設定（manifest, service worker）
- [x] ディレクトリ構成を CLAUDE.md の通りに作成
- **DoD**: `npm run dev` で空の画面が開き、CI が通る

## M1. トレーナー接続
- [x] `BleTransport` インターフェースと `WebBluetoothTransport` 実装
- [x] `TrainerDevice` インターフェース定義（connect / disconnect / setSimulation / onData）
- [x] FTMS のバイト列エンコード/デコード（`05-ble-ftms.md`）とユニットテスト
- [x] `FtmsTrainer`（Web Bluetooth）実装、Request Control → Start
- [x] `SimulatedTrainer`（設定したパワー・ケイデンスを擬似生成、勾配に応じてパワーが変わるモード付き）
- [x] 心拍計（Heart Rate Service）接続
- [x] 切断検知と自動再接続
- [x] 接続テスト画面（パワー・ケイデンス表示、勾配を手動スライダーで送信）
- [x] `src/platform/` の雛形（機能検出）
- **DoD**: 【実機】スライダーで勾配を 0→10% に変えると負荷が上がり、実変速で軽くできる。**Windows（Chrome）・macOS（Chrome）・iPad（Bluefy）の3環境で確認**する（iPad で動かない場合は原因を記録し、M8 の前倒しを判断）

## M2. ルート取り込みと走行（MVP）
- [x] GPX / TCX / FIT パーサ（`test/fixtures/` に自作ファイル）
- [x] 再サンプル・標高平滑化・勾配計算（`domain/course`）
- [x] 物理モデル（`domain/physics`）とテスト
- [x] RideEngine（走行ループ、勾配送信の間引き、lookahead）
- [x] ルート一覧・取り込み（D&D）・事前確認画面（地図、勾配プロファイル、統計）
- [x] 走行画面（地図上の現在位置、プロファイル、メトリクス）
- [x] ライダー設定（体重、バイク重量、CdA プリセット、難易度）
- [x] 1Hz 記録と FIT エクスポート
- [x] Screen Wake Lock
- **DoD**: 【実機】Strava から手動エクスポートしたラルプデュエズの GPX を取り込み、最後まで走って FIT を書き出せる。Garmin Connect から書き出したコースでも同様に走れる
  - 2026-10-12: Strava の GPX で走行・FIT 書き出し・Strava へのアップロード（バーチャルライド）を確認。Garmin Connect のコースは #10 で M6 時に確認

## M3. Strava 連携
- [ ] Strava API アプリ登録（開発者本人の Strava サブスクで Standard Tier）、Athlete Capacity を 10 に引き上げ
- [ ] Cloudflare Worker（token 交換・refresh、CORS はアプリのオリジンのみ許可）
- [ ] OAuth フロー、トークン保存・自動更新・連携解除（deauthorize）
- [ ] 自分のルート一覧表示と GPX 取り込み
- [ ] 走行のアップロード（FIT, VirtualRide）
- [ ] 「Connect with Strava」ボタン等、Strava のブランドガイドライン準拠
- **DoD**: 仲間の1人が自分のアカウントで連携し、自分のルートを取り込んで走り、走行が Strava に上がる

## M4. 実走データとゴースト（富士ヒル向け）
- [ ] 実走 FIT 取り込み（Wahoo ELEMNT / Garmin Edge のファイルで検証）
- [x] 実走 FIT からルート生成（気圧高度を使用）
- [x] ルートへの射影と `tGhost(d)` 生成
- [ ] 走行中のゴースト表示（地図・プロファイル上のマーカー、時間差）
- [ ] 走行後の比較レポート（区間別パワー・W/kg・タイム）
- **DoD**: 前年の富士ヒル実走 FIT をゴーストにして走り、区間ごとの差がレポートで確認できる

## M5. 動画なしのビジュアル
- [ ] 3D 地形追従ビュー（MapLibre GL の terrain＋衛星/地形タイル、現在位置を追う斜め見下ろしカメラ、進行方向に回転）
- [ ] 地形タイルの提供元選定（MapTiler 等の無料枠、Q3 と合わせて決定）
- [ ] Mapillary アダプタ（アクセストークン、画像検索、クレジット）
- [ ] Panoramax アダプタ
- [ ] 画像シーケンス表示（先読み、方向フィルタ、クロスフェード）
- [ ] ルートごとの画像カバー率表示。画像がない区間は 3D 地形ビューに自動で切り替え
- [ ] Google ストリートビュー（任意、各自の API キー設定、キャッシュしない実装）
- **DoD**: 動画のないツール・ド・フランスのルート（例: ラルプデュエズ）で、3D 地形ビューが走行位置に追従し、画像のある区間では路上画像が位置に合わせて切り替わる

## M6. 仲間内ベータ
- [ ] Cloudflare Pages へデプロイ、独自ドメイン（任意）
- [ ] 初回セットアップガイド（KICKR のファームウェア更新、ペアリング、Windows は Chrome/Edge、iPad は Bluefy の入れ方。Wahoo アプリや Zwift がトレーナーを掴んだままだと接続できない点も記載）
- [ ] データのエクスポート/インポート（端末移行用）
- [ ] フィードバック収集（GitHub Issues など）
- **DoD**: 仲間全員が自分の環境でセットアップを完了し、1回以上走行できる

## M7. iPad アプリ化（Capacitor）
- [ ] Apple Developer Program 加入（Q5）
- [ ] Capacitor 導入、iOS プロジェクト生成（開発者の Mac / Xcode でビルド）
- [ ] `CapacitorBleTransport` 実装（Info.plist に Bluetooth 利用目的を記載）
- [ ] 動画・ファイルの保存を Capacitor Filesystem に対応
- [ ] Strava OAuth のリダイレクト対応（カスタム URL スキーム or Universal Links）
- [ ] 画面スリープ防止、横向き/縦向きレイアウト
- [ ] TestFlight で仲間に配布
- **DoD**: iPad アプリで M2〜M5 の機能が Web 版と同等に動き、TestFlight 経由で仲間がインストールできる

## M8. 自前映像の同期再生（走行動画が用意でき次第）
- [ ] 動画ファイルの関連付け（File System Access API、非対応ブラウザは都度選択）
- [ ] GoPro GPMF からの GPS 抽出、または FIT/GPX との時刻合わせ
- [ ] オフライン調整 UI（開始オフセット微調整）
- [ ] playbackRate 制御とシーク
- **DoD**: 自分で撮った動画付きのルートで、速度に合わせて映像が進み、30分走ってもずれが数秒以内

## 将来の候補
個別の要望・不具合・調査は GitHub Issues で管理する（ここには方針レベルのものを置き、Issue 番号を併記する）。
- ルートの任意の位置から走行開始（#5）
- ルートの逆走・リバース（#6）
- 負荷のキャリブレーション・実走との差の補正（#7）
- 惰性走行時の速度の振る舞いの確認（#8、調査）
- ERG ワークアウト（ルート上の区間に目標パワーを設定）
- 標高 DEM 補正（国土地理院 / Copernicus）
- 一般公開（Strava の審査、各種規約の再確認）
