import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { xprint, DEFAULT_SETTINGS, PrinterSettings, PrinterStatus } from '../lib/xprint'

interface PrinterState {
  settings: PrinterSettings
  status:   PrinterStatus
  lastError: string

  setSettings:  (s: Partial<PrinterSettings>) => void
  setStatus:    (s: PrinterStatus, msg?: string) => void
  reconnect:    () => void
  disconnect:   () => void
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      settings:  { ...DEFAULT_SETTINGS },
      status:    'disconnected',
      lastError: '',

      setSettings: (s) => {
        const settings = { ...get().settings, ...s }
        set({ settings })
        xprint.configure(settings)
        // Reconnect with new settings if autoConnect is on
        if (settings.autoConnect) {
          xprint.connect(true)
        } else {
          xprint.disconnect()
        }
      },

      setStatus: (status, msg) => set({
        status,
        lastError: msg ?? (status === 'error' ? get().lastError : ''),
      }),

      reconnect: () => {
        xprint.configure(get().settings)
        xprint.connect(true)
      },

      disconnect: () => {
        xprint.disconnect()
        set({ status: 'disconnected' })
      },
    }),
    { name: 'janze-printer-v1' }
  )
)

// Boot: apply saved settings and subscribe to status changes
;(function initPrinter() {
  try {
    const raw  = localStorage.getItem('janze-printer-v1')
    const saved = raw ? (JSON.parse(raw)?.state?.settings as PrinterSettings) : null
    if (saved) xprint.configure(saved)

    // Subscribe to status changes from the xprint service
    xprint.onStatus((status, msg) => {
      usePrinterStore.getState().setStatus(status, msg)
    })

    // Auto-connect on page load if enabled
    const settings = saved ?? DEFAULT_SETTINGS
    if (settings.autoConnect) {
      xprint.connect()
    }
  } catch { /* ignore */ }
})()
