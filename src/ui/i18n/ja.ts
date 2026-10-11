/** 日本語の UI 文言。キーは英語、値は表示文字列。`{name}` はパラメータで置換する。 */
export const ja = {
  'app.name': 'Lacets',
  'app.tagline': '実在のルートを、室内で。',

  'connectionTest.title': '接続テスト',
  'connectionTest.simulatorNotice':
    'シミュレータモードで動作しています（実機のトレーナーには接続しません）',
  'connectionTest.unsupportedBrowser':
    'このブラウザは Web Bluetooth に対応していません。Windows / macOS は Chrome か Edge、iPad は Bluefy を使ってください。',
  'connectionTest.trySimulator': 'シミュレータで試す',

  'connection.disconnected': '未接続',
  'connection.connecting': '接続中…',
  'connection.connected': '接続済み',
  'connection.reconnecting': '再接続中…',

  'trainer.heading': 'トレーナー',
  'trainer.connect': 'トレーナーに接続',
  'trainer.disconnect': '切断',
  'trainer.simulationUnsupported': 'このトレーナーは SIM モード（勾配指定）に対応していません',

  'heartRate.heading': '心拍計（任意）',
  'heartRate.connect': '心拍計に接続',
  'heartRate.disconnect': '切断',

  'metric.power': 'パワー',
  'metric.cadence': 'ケイデンス',
  'metric.heartRate': '心拍',
  'unit.watt': 'W',
  'unit.rpm': 'rpm',
  'unit.bpm': 'bpm',
  'unit.percent': '%',

  'grade.heading': '勾配（SIM モード）',
  'grade.label': '勾配',
  'grade.range': '送信範囲 {min}% 〜 {max}%',

  'simulator.heading': 'シミュレータ設定',
  'simulator.mode': 'モード',
  'simulator.mode.grade': '勾配に応じてパワーが変わる',
  'simulator.mode.fixed': '固定',
  'simulator.basePower': '平坦でのパワー',
  'simulator.cadence': '平坦でのケイデンス',
  'simulator.dropout': '一時的な切断を再現',

  'error.connectFailed': '接続できませんでした: {detail}',
  'error.commandFailed': 'トレーナーへの送信に失敗しました: {detail}',
} as const

export type MessageKey = keyof typeof ja
