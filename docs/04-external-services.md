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

## Panoramax
- フランス発のオープンな路上画像基盤（フェデレーション型）。フランス国内のツール・ド・フランスのコースで有望
- API・ライセンスはインスタンスごとに確認

## Google ストリートビュー
- Street View Static API で保存してよいのはパノラマ ID（pano_id）のみ。画像そのもののキャッシュ・動画化・オフライン利用は不可
- リクエスト単位の従量課金。仲間内配布では各自の API キーを設定する方式を想定（要検討事項 Q2）
- 利用時は Google Maps Platform の利用規約・表示要件を満たすこと

## 地図タイル
- OSM 公式タイルサーバーは大量利用不可。MapTiler / Stadia Maps 等の無料枠、または Protomaps のセルフホストを検討
- **暫定**: 2D 地図は登録・API キー不要の OpenFreeMap（`https://tiles.openfreemap.org/styles/liberty`）を使用。`VITE_MAP_STYLE_URL` で差し替え可能（`src/ui/common/mapConfig.ts`）。OSM のクレジットはスタイルの attribution で表示される。M5 の 3D 地形ビュー（地形・衛星タイル）は別途選定（Q3）
