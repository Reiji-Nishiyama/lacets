// 合成テストルート（test/fixtures/synthetic-lacets.gpx）を生成する。
// 21 のつづら折りを持つ約 13.8 km・平均約 8% の登り。座標・標高はすべて計算で作った架空のもの。
// 使い方: node scripts/generate-synthetic-lacets.mjs
import { writeFileSync } from 'node:fs'

const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180
const START = { lat: 45.05, lon: 6.03 }
const TOTAL_M = 13_800
const LEGS = 22 // 21 のヘアピンで区切られた 22 区間
const SPACING_M = 20

const legM = TOTAL_M / LEGS
const points = []
let { lat, lon } = START
let ele = 720
for (let d = 0, i = 0; d <= TOTAL_M; d += SPACING_M, i++) {
  if (i > 0) {
    // 区間ごとに北東・北西を交互に進む
    const leg = Math.floor((d - SPACING_M / 2) / legM)
    const headingRad = ((leg % 2 === 0 ? 60 : 300) * Math.PI) / 180
    lat += (SPACING_M * Math.cos(headingRad)) / M_PER_DEG_LAT
    lon += (SPACING_M * Math.sin(headingRad)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
    // 勾配は 6〜10% でゆるやかに変化
    const grade = 0.081 + 0.02 * Math.sin(d / 700)
    ele += grade * SPACING_M
  }
  points.push({ lat, lon, ele })
}

const trkpts = points
  .map(
    (p) =>
      `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`,
  )
  .join('\n')

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 自作の合成ルート（scripts/generate-synthetic-lacets.mjs で生成）。実在の道路データではない -->
<gpx version="1.1" creator="lacets synthetic" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Synthetic Lacets</name></metadata>
  <trk>
    <name>Synthetic Lacets</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
writeFileSync(new URL('../test/fixtures/synthetic-lacets.gpx', import.meta.url), gpx)
console.log(`${points.length} points, ${(points.at(-1).ele - points[0].ele).toFixed(0)} m gain`)
