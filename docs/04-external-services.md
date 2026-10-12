# 04. 外部サービスの仕様・規約メモ

最終確認日: 2026-10-11。**規約は頻繁に変わるため、実装着手時・公開前に必ず原文を再確認すること。**

## Strava
- Standard Tier の開発者は Strava のサブスクリプションが必要（2026-06-01 以降の新規開発者、既存は 2026-06-30 以降）。サブスク加入者には追加料金なし
- 新規アプリは Athlete Capacity 1（Single Player Mode）。API 設定画面からレビューなしで 10 まで引き上げ可能。10 人超はレビューが必要で、承認は保証されない
- API で取得したデータは、そのデータを提供したユーザー本人にのみ表示できる
- API データを AI アプリケーションで使うこと（プロンプト、埋め込み、RAG 含む）は禁止
- 第三者の中継プラットフォーム経由で Strava データを流す構成は制限されている。自前の Worker はトークン交換のみに限定し、データ本体は中継しない
- ルートは GPX / TCX でエクスポートする API がある
- ベース URL が `https://api-v3.strava.com` に移行予定（2027-01-04 から利用可能）。トークンはヘッダ送信が必須になる予定
- ブランドガイドライン（Connect with Strava ボタン、Powered by Strava 表記）に従う
- Garmin デバイス由来のデータには Garmin の帰属表示が求められる場合がある（Strava API Agreement 2.4）

参照: https://www.strava.com/legal/api / https://developers.strava.com/docs/ / https://communityhub.strava.com/developers-knowledge-base-14/strava-api-faq-12906

## Garmin
- Garmin Connect Developer Program は承認された法人向け（無料）
- Courses API は外部プラットフォームから Garmin Connect へコースを**送る**ための API。ユーザーが Garmin Connect で作ったコースを読み出す用途ではない
- Activity API で走行データを受け取れるが、同じく法人向けプログラム
- **方針: Garmin Connect のコースと実走データは、ユーザーが GPX/FIT を手動でエクスポートして取り込む**
- 将来、アプリで作ったルートを Garmin に送りたくなった場合のみ Courses API を検討

## Wahoo
- ELEMNT の実走データは FIT。ELEMNT アプリや連携先（Strava 等）から FIT/GPX を手動取得して取り込む

## Mapillary
- API v4。アクセストークンが必要。画像は CC BY-SA のためクレジット表示必須
- カバー率は地域差が大きい。ルートごとにカバー率を表示する
- 実装（`src/integrations/mapillary/`）: `GET https://graph.mapillary.com/images?bbox=…&fields=…`。トークンは各自が Mapillary の開発者ページで取得し、設定画面で入力（端末内にのみ保存、`Authorization: OAuth <token>` ヘッダで送る）
  - bbox は 0.01 度四方未満という制限があるため、ルート沿いを 0.005 度のマス目に分けて検索する。limit の上限 2000、検索 API は 10,000 回/分/アプリ（2026-10-12 確認）
  - 位置・方位は補正後の `computed_geometry` / `computed_compass_angle` を優先。`thumb_2048_url` を表示に使う

## Panoramax
- フランス発のオープンな路上画像基盤（フェデレーション型）。フランス国内のツール・ド・フランスのコースで有望
- API・ライセンスはインスタンスごとに確認
- 実装（`src/integrations/panoramax/`）: メタカタログ `https://api.panoramax.xyz/api/search?bbox=…&limit=…`（STAC API、キー不要、CORS 可。2026-10-12 確認）
  - 画像ごとに `properties.license`（CC-BY-SA-4.0、etalab-2.0 など）と撮影者（`providers[].name`、なければ `geovisio:producer`）があるので、表示中の画像ごとにクレジットを出す
  - 方位は `view:azimuth`、360° パノラマは `pers:interior_orientation.field_of_view = 360`（正距円筒図法）。進行方向を中心に視野 100° を切り出して表示する
  - 画像は `assets.sd`（なければ `hd`）を表示に使う。検索結果（メタデータ）はセッション中のメモリにだけ持ち、端末には保存しない
  - アルプ・デュエズ周辺は 360° 画像のシーケンスがある（確認時点）

## Google ストリートビュー
- Street View Static API で保存してよいのはパノラマ ID（pano_id）のみ。画像そのもののキャッシュ・動画化・オフライン利用は不可
- リクエスト単位の従量課金。仲間内配布では各自の API キーを設定する方式を想定（要検討事項 Q2）
- 利用時は Google Maps Platform の利用規約・表示要件を満たすこと

## 地図タイル
- OSM 公式タイルサーバーは大量利用不可。MapTiler / Stadia Maps 等の無料枠、または Protomaps のセルフホストを検討
- **標高（3D 地形）**: AWS Open Data の Terrain Tiles（Mapzen 由来）`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`（Terrarium 形式、ズーム 0〜15、キー不要、CORS 可）。SRTM・GMTED2010・ETOPO1 などの合成で、出典の表示が必要（https://github.com/tilezen/joerd/blob/master/docs/attribution.md）。地図の attribution に表示している
- **衛星画像（任意）**: MapTiler のキーを設定画面で入力すると、3D 地形ビューに `https://api.maptiler.com/maps/hybrid/style.json?key=…` を使う
  - 無料プラン（2026-10-12 確認）: 月 5,000 セッション・3D 2,000 セッション・API 100,000 リクエスト。ベクタータイル 1 枚 = 1、512px の画像タイル 1 枚 = 4 リクエスト。超えると翌月まで停止（課金なし）。支払い情報不要。個人・非商用向け
  - 表示義務: 無料プランは地図の左下に maptiler.com へリンクした MapTiler ロゴ、右下に © MapTiler の文字表記（スタイルの attribution で表示）。通知・表記を消してはいけない
  - キャッシュ: ブラウザ等の一時キャッシュは可、サーバー側への保存・タイルの一括ダウンロードは不可（Service Worker でキャッシュしない）
  - 衛星画像は走行中に次々読み込むため 1 時間で数千リクエストになりうる。**キーは各自が取得する**（1 つのキーを共有しない）
  - 実装: ロゴは `RouteMap` が MapTiler のスタイルのときに表示。この端末の今月のリクエスト数の目安を数えて設定画面に表示（`src/media/maptilerUsage.ts`、キャッシュ分も数えるので多めに出る）。401 / 403 / 429 で拒否されたら、そのセッションは通常の地図に戻して案内を出す
- **暫定**: 2D 地図は登録・API キー不要の OpenFreeMap（`https://tiles.openfreemap.org/styles/liberty`）を使用。`VITE_MAP_STYLE_URL` で差し替え可能（`src/ui/common/mapConfig.ts`）。OSM のクレジットはスタイルの attribution で表示される。M5 の 3D 地形ビュー（地形・衛星タイル）は別途選定（Q3）
