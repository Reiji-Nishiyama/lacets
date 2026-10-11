# 05. Bluetooth FTMS プロトコルメモ

KICKR Core 2 は Bluetooth SIG の Fitness Machine Service（FTMS）に対応している。本アプリは標準 FTMS のみを使い、Wahoo 独自プロトコルには依存しない。
**以下は実装の手がかり。実装時は Bluetooth SIG の FTMS 仕様書（FTMS v1.0）および GATT Specification Supplement で値を必ず照合し、エンコード/デコードはユニットテストで仕様書の例と一致させること。**

## サービス / キャラクタリスティック
| 名前 | UUID | 用途 |
|---|---|---|
| Fitness Machine Service | 0x1826 | |
| Fitness Machine Feature | 0x2ACC | read: 対応機能（SIM 対応か等） |
| Indoor Bike Data | 0x2AD2 | notify: パワー・ケイデンス等 |
| Supported Inclination Range | 0x2AD5 | read: 勾配の上下限（クランプに使用） |
| Fitness Machine Control Point | 0x2AD9 | write + indicate: 制御コマンド |
| Fitness Machine Status | 0x2ADA | notify: 状態変化 |
| Cycling Power Service | 0x1818 | 予備（Cycling Power Measurement 0x2A63） |
| Heart Rate Service | 0x180D | 心拍計（Heart Rate Measurement 0x2A37） |

Web Bluetooth の `requestDevice` では `filters: [{ services: [0x1826] }]` を基本とし、`optionalServices` に 0x1818 と 0x180D を加える。

## Control Point のシーケンス
1. indicate を購読してから書き込む（応答は opcode 0x80 + 要求 opcode + 結果コード）
2. `0x00` Request Control
3. `0x07` Start or Resume
4. 走行中は `0x11` Set Indoor Bike Simulation Parameters を送る
5. 終了時 `0x08` Stop or Pause、`0x01` Reset（必要に応じて）

結果コード 0x01 = Success。それ以外（Op Code not supported / Invalid Parameter / Operation Failed / Control Not Permitted）はログに出し、Control Not Permitted なら Request Control からやり直す。

## Set Indoor Bike Simulation Parameters（0x11）
| フィールド | 型 | 分解能 |
|---|---|---|
| Wind Speed | sint16 | 0.001 m/s |
| Grade | sint16 | 0.01 % |
| Crr | uint8 | 0.0001 |
| Cw（風抵抗係数） | uint8 | 0.01 kg/m |

例: grade 8.0%, Crr 0.004, CdA 0.32 m²（Cw = 0.5×1.225×0.32 ≈ 0.20 kg/m）, 風速 0 →
`[0x11, 0x00,0x00, 0x20,0x03, 0x28, 0x14]`（grade 800 = 0x0320 リトルエンディアン、Crr 40 = 0x28、Cw 20 = 0x14）

注意: Cw は uint8・0.01 刻みのため 2.55 kg/m が上限。通常の CdA なら範囲内。

## Indoor Bike Data（0x2AD2）
先頭 2 バイトが Flags（リトルエンディアン）。フラグに応じて後続フィールドが可変長で並ぶ。
- bit0 = More Data（**0 のとき** Instantaneous Speed: uint16, 0.01 km/h が存在。反転論理に注意）
- bit1 Average Speed
- bit2 Instantaneous Cadence: uint16, 0.5 rpm
- bit3 Average Cadence
- bit4 Total Distance: uint24, 1 m
- bit5 Resistance Level
- bit6 Instantaneous Power: sint16, 1 W
- bit7 Average Power
- bit8 Expended Energy（3 フィールド）
- bit9 Heart Rate: uint8
- 以降: Metabolic Equivalent, Elapsed Time, Remaining Time

デコーダは「フラグを順に見てオフセットを進める」方式で書き、未知のフラグがあっても落ちないこと。

## 運用上の注意
- 勾配の送信は 1 秒に 1〜4 回程度に抑える（過剰な書き込みはトレーナー側で無視・遅延の原因）
- Control Point の書き込みは直列化する（前の応答を待ってから次を送る。キューを実装）
- 接続直後は Supported Inclination Range を読み、送信値をクランプする（キャラクタリスティックがない場合は ±25% でクランプ。実装: `src/devices/ftms/FtmsTrainer.ts`）
- 予期しない切断時は同じデバイスに自動再接続し（1→2→4→8→15 秒間隔、最大 20 回）、Request Control → Start → 直前の勾配を送り直す。Fitness Machine Status で Control Permission Lost（0xFF）を受けた場合も制御権を取り直す
- KICKR のファームウェアは Wahoo アプリで最新にしておく（セットアップガイドに記載）
