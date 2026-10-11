import { useEffect, useState } from 'react'
import { createDevices } from '../devices/createDevices.ts'
import { currentLaunchOptions } from '../platform/launchOptions.ts'
import { bindDevices } from '../store/deviceStore.ts'
import { ConnectionTestPage } from './connection/ConnectionTestPage.tsx'

export function App() {
  const [launch] = useState(currentLaunchOptions)
  const [devices] = useState(() => createDevices(launch))

  useEffect(() => bindDevices(devices), [devices])

  return <ConnectionTestPage simulator={launch.simulator} />
}
