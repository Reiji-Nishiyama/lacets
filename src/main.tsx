import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/zen-maru-gothic/500.css'
import '@fontsource/zen-maru-gothic/700.css'
import '@fontsource/zen-maru-gothic/900.css'
import { App } from './ui/App.tsx'
import './ui/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root が見つかりません')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
