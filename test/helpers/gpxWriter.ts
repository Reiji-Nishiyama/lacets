import type { ReferenceSample } from '../../src/domain/ghost/types.ts'

/** ゴースト用の実走サンプルを時刻付き GPX（パワー拡張付き）にする */
export function referenceToGpx(name: string, startMs: number, samples: ReferenceSample[]): string {
  const pts = samples
    .map(
      (s) =>
        `<trkpt lat="${s.lat.toFixed(7)}" lon="${s.lon.toFixed(7)}">` +
        (s.elevationM === undefined ? '' : `<ele>${s.elevationM.toFixed(1)}</ele>`) +
        `<time>${new Date(startMs + s.timeS * 1000).toISOString()}</time>` +
        (s.powerW === undefined ? '' : `<extensions><power>${s.powerW}</power></extensions>`) +
        `</trkpt>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="lacets-test" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${name}</name></metadata>
<trk><trkseg>
${pts}
</trkseg></trk>
</gpx>
`
}
