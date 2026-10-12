# 02. アーキテクチャ

## 1. 全体構成
```
┌──────────────────────── ブラウザ（PWA） ────────────────────────┐
│ UI (React)                                                     │
│   ├ ルート一覧 / 取り込み / 事前確認                             │
│   ├ 走行画面（映像・地図・プロファイル・メトリクス）              │
│   └ 走行後レポート（ゴースト比較）                               │
│ Store (Zustand)  ←→  IndexedDB (Dexie): ルート/走行/設定/動画参照 │
│ RideEngine（走行ループ 4Hz）                                    │
│   ├ domain/physics   パワー→速度→距離                           │
│   ├ domain/course    距離→勾配・座標                             │
│   ├ domain/ghost     距離→ゴーストの時刻                         │
│   └ recording        1Hz 記録 → FIT                             │
│ devices: TrainerDevice ─┬ FtmsTrainer ── BleTransport ─┬ WebBluetooth │
│                         │                              └ Capacitor   │
│                         └ SimulatedTrainer                      │
│ media: TerrainView / ImageSequence (Mapillary, Panoramax, GSV)  │
│        VideoSync（後回し）                                       │
│ integrations/strava ── fetch ──┐                                │
└────────────────────────────────┼────────────────────────────────┘
                                 ▼
             Cloudflare Worker（/oauth/token, /oauth/refresh のみ）
                                 ▼
                           Strava API
```

## 2. 主要な設計判断（ADR 要約）
| # | 判断 | 理由 |
|---|---|---|
| A1 | Web アプリ（PWA）で作る | 仲間への配布が URL 共有だけで済む。Web Bluetooth で KICKR に直接接続できる |
| A2 | Zwift Cog を使わず実変速 | バーチャルシフトは Zwift 専用。実カセットなら FTMS の SIM モードだけで自然な変速感が得られる |
| A3 | サーバーにユーザーデータを置かない | Strava 規約（本人以外への表示禁止）とプライバシー。サーバー運用も最小化できる |
| A4 | OAuth だけ Worker で中継 | Strava の client_secret をブラウザに置けないため |
| A5 | 速度はアプリ側で計算 | 実走に近い速度・ゴースト比較の一貫性のため |
| A6 | Garmin は手動ファイル取り込み | Garmin Connect の Courses API はコースを Garmin へ送る方向のみで、ユーザーが作ったコースを読む API ではない。さらに承認された法人向けプログラム |
| A7 | BLE をトランスポート層で抽象化 | iPad は Safari で Web Bluetooth が使えない。Bluefy では Web Bluetooth のまま動くが、最終的には Capacitor のネイティブ BLE に載せ替えるため、最初から差し替え可能にしておく |
| A8 | iPad は Bluefy → Capacitor の二段階 | Bluefy なら追加開発ゼロで早期に検証できる。ただしサードパーティ製ブラウザへの依存は長期的なリスクのため、安定後に Capacitor アプリ化する |

## 3. データモデル（IndexedDB）
```ts
Route {
  id: string; name: string;
  source: 'strava' | 'gpx' | 'tcx' | 'fit';
  sourceRef?: string;          // Strava route id 等
  points: RoutePoint[];        // 生データ（lat, lon, elevationM?, timeS?）
  profile: ProfilePoint[];     // 10m 間隔に再サンプル済み（distanceM, elevationM, grade, lat, lon）
  stats: { distanceM; ascentM; descentM; maxGrade; minGrade; };
  elevationSource: 'barometric' | 'dem';
  createdAt: number;
}
Ride {                         // 実装: src/recording/types.ts の RecordedRide
  id; routeId; routeName; startedAtMs; endedAtMs;
  samples: Sample[];           // 1Hz: timestampMs, elapsedS, distanceM, lat, lon, elevationM,
                               //      speedMps, powerW, cadenceRpm, heartRateBpm, grade
  events: { timestampMs; type: 'start' | 'stop' }[];  // 一時停止・再開（FIT の timer イベント）
  stats: RideStats;            // 走行時間・距離・獲得標高・平均/最大パワー等
  ghostRideId?: string;        // M4
  settings: RiderSettings;     // 走行時点の体重等をスナップショット
}
ReferenceRide {                // 実走 FIT（ゴースト用）
  id; name; recordedAt; device: 'wahoo'|'garmin'|'other';
  samples: { tS, lat, lon, ele, powerW?, hr?, cadence?, speedMps }[];
}
VideoAsset {                   // 動画本体は File System Access API のハンドル or OPFS
  id; routeId; fileHandle; offsetS; distanceToVideoTime: [distanceM, videoS][];
}
RiderSettings { riderMassKg; bikeMassKg; position: 'hoods'|'drops'|'climbing'; crr; difficulty /*0..1*/; }  // CdA は position から決まる
```

## 4. 走行ループ（RideEngine）
4Hz で以下を実行する。
1. トレーナーから最新のパワー（W）・ケイデンスを取得
2. 物理モデルで速度を更新し、距離を積分
3. `course.gradeAt(distance + lookahead)` で勾配を求め、難易度を掛けて、トレーナーの対応範囲にクランプ
4. 勾配が前回送信値から 0.1% 以上変化、または 1 秒経過で FTMS に送信（送信過多を防ぐ）
5. ゴースト・映像・UI に現在距離を通知
6. 1Hz で記録サンプルを追加

## 5. 物理モデル（domain/physics）
進行方向の運動方程式を積分する（慣性を含めるので加減速が自然になる）。

```
F_grav  = m·g·sin(θ)
F_roll  = m·g·cos(θ)·Crr
F_aero  = 0.5·ρ·CdA·(v + v_wind)²
m_eff·dv/dt = P / max(v, v_min) − (F_grav + F_roll + F_aero)
```
- m = 体重 + バイク重量、θ = atan(grade)、ρ = 1.225（将来は標高で補正）、m_eff は回転体慣性分を数 % 加算
- v_min（0.5 m/s 程度）で P/v の発散を防ぐ。P=0 かつ登りでは v=0 で停止させる
- KICKR は駆動系の後で計測するため、駆動損失は掛けない
- 既定値: Crr = 0.004、CdA = 0.32（ブラケット）、ドロップ 0.28、ヒルクライム（ブラケット低速）0.36 をプリセット化
- テスト: 平坦 200W・75kg で約 33〜35 km/h、8% 登坂 250W・70kg で約 14 km/h 前後になることを確認（許容誤差は実装時に設定）

FTMS へ送るパラメータ: grade、Crr、Cw（= 0.5·ρ·CdA [kg/m]）、風速 0。トレーナー内部の負荷計算はトレーナー側の前提（体重等）に依存するため、体感負荷とアプリの速度計算は厳密には一致しない点を許容する。

## 6. ルート処理（domain/course）
1. 取り込み: GPX（trkpt/rtept）、TCX、FIT（record / course_point）を `RoutePoint[]` に正規化
2. 距離計算: Haversine で累積距離
3. 10 m 間隔に再サンプリング（座標は線形補間）
4. 標高平滑化: 
   - 実走 FIT（気圧高度）: 軽い平滑化（〜30 m）
   - Strava/Garmin ルート（DEM 由来）: 外れ値除去（中央値フィルタ〜50 m）→ 平滑化（〜100 m）
   - 平滑化は局所線形回帰（内部では移動平均と同じ。端でも登りの勾配が潰れない）
   - 時刻付きの GPX・TCX 実走・FIT activity は気圧高度扱い、それ以外（ルート・コース）は DEM 扱い
5. 勾配: 中心差分 `(ele[i+k] − ele[i−k]) / (2k·10m)`、k は 2〜5（既定 3）
6. 物理的にありえない勾配（±25% 超）は警告し、近傍で補間
7. ループ・往復ルートは距離ベースで扱うため問題なし。終点到達で走行終了

将来の改善: 国内ルートは国土地理院の DEM、海外は SRTM/Copernicus DEM で標高を補正。

## 7. ゴースト（domain/ghost）
- 実走 FIT の軌跡をルートのポリラインに射影し、「ルート上の距離 → 実走の経過時間」の単調関数 `tGhost(d)` を作る（逆走・停車は単調化で処理）
- 走行中の差分: `Δt = tUser(d) − tGhost(d)`（負ならゴーストより速い）
- 走行後レポート: 1 km ごと、および自動検出した登坂区間ごとに、平均パワー・W/kg・タイムを並べて比較
- ルートを実走 FIT から作った場合は射影不要（同一距離軸）

## 8. 映像同期（media/VideoSync）
- 事前処理: 動画内 GPS（GoPro GPMF）または同時記録の FIT/GPX から `videoTime ↔ ルート距離` の対応表を作る。開始オフセットは UI で手動微調整可能にする
- 走行中: 目標の動画時刻 `tv* = videoTimeAt(distance)` に対し、`playbackRate` を比例制御で追従させる（基本値 = 仮想速度 / 撮影時速度、0.25〜4.0 にクランプ）
- ずれが 2 秒を超えたらシーク。仮想速度がほぼ 0 なら一時停止
- 動画は `<video>` で再生し、ファイルはローカルから読む（サーバーに上げない）

## 9. 画像シーケンス（media/ImageSequence）
- ルートに沿って 10〜20 m 間隔で候補画像を検索し、進行方向と撮影方向が近い画像を優先
- 前方 200 m 分を先読み、切り替え時はクロスフェード
- 表示の優先度: 自前動画（あれば） > Mapillary / Panoramax > Google ストリートビュー > 3D 地形ビュー（常に利用可能なフォールバック）
- 3D 地形ビューは MapLibre GL の terrain 機能で実装し、カメラは現在位置の後方上空から進行方向を向ける。勾配プロファイル・ゴーストのマーカーも同じ地図上に描画する
- Google ストリートビューは画像を保存しない（pano_id のみ保存可）。Mapillary/Panoramax もクレジットを常時表示

## 10. 記録とエクスポート（recording）
- FIT（Activity, sport=cycling, sub_sport=virtual_activity）に、仮想位置の緯度経度・標高・パワー・ケイデンス・心拍・速度を書き出す
- RideEngine の記録ティック（約 1 秒ごと、走行中のみ）でサンプルを取り、時刻は秒に丸める。一時停止・自動一時停止は timer の stop_all / start イベントで表す
- メッセージ構成: file_id → (event / record を時刻順) → lap → session → activity。走行終了時に IndexedDB に保存し、FIT は結果画面から書き出す（`src/recording/fitExport.ts`）
- Strava アップロード時は sport_type を VirtualRide とする

## 11. BLE トランスポート（devices/ble）
```ts
interface BleTransport {
  requestDevice(opts: { services: number[]; optionalServices?: number[] }): Promise<BleDeviceRef>;
  connect(dev: BleDeviceRef): Promise<void>;
  disconnect(dev: BleDeviceRef): Promise<void>;
  read(dev, service: number, char: number): Promise<DataView>;
  write(dev, service: number, char: number, value: Uint8Array): Promise<void>;
  subscribe(dev, service: number, char: number, cb: (v: DataView) => void): Promise<() => void>;
  onDisconnected(dev, cb: () => void): void;
}
```
- `WebBluetoothTransport`: Chrome / Edge / Bluefy
- `CapacitorBleTransport`: `@capacitor-community/bluetooth-le` を想定（M8 で実装・要選定）
- 実行時に Capacitor 環境か Web Bluetooth の有無で自動選択

## 12. プラットフォーム差の吸収（platform）
| 機能 | Chrome / Edge（PC） | iPad（Bluefy） | iPad（Capacitor） |
|---|---|---|---|
| 動画の参照 | File System Access API のハンドル保持 | OPFS にコピー（要検証） | Capacitor Filesystem にコピー |
| 画面スリープ防止 | Screen Wake Lock API | Wake Lock（要検証） | keep-awake プラグイン |
| Strava OAuth リダイレクト | 通常の https リダイレクト | 同左 | カスタム URL スキーム or Universal Links |

## 13. Strava 連携（integrations/strava）
- OAuth 2.0 Authorization Code。scope: `read`, `read_all`（非公開ルート用）, `activity:write`（アップロード用）
- トークン交換・更新のみ Worker 経由。アクセストークンとリフレッシュトークンは端末の IndexedDB に保存
- API のベース URL は設定値にする（2027 年に `https://api-v3.strava.com` への移行、トークンのヘッダ送信必須化が予定されているため）
