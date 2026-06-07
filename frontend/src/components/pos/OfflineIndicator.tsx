/**
 * OfflineIndicator.tsx — Janze ERP
 *
 * Shows current network status and pending offline sales count.
 * Displays:
 *   🟢  Online
 *   🔴  Offline  (N ta sotuv navbatda)
 *   🟡  Sync bo'lmoqda...
 */

import { useEffect, useState } from 'react'
import { syncQueue } from '../../lib/syncQueue'

type Mode = 'online' | 'offline' | 'syncing'

interface OfflineIndicatorProps {
  /** Extra CSS classes */
  className?: string
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [online,  setOnline]  = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Network events
    const handleOnline  = () => { setOnline(true);  setSyncing(true) }
    const handleOffline = () => { setOnline(false); setSyncing(false) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Queue updates
    const unsub = syncQueue.onStatusChange((count) => {
      setPending(count)
      if (count === 0) setSyncing(false)
    })

    // Initial count
    syncQueue.getPendingCount().then(setPending)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsub()
    }
  }, [])

  // Derive display mode
  let mode: Mode = 'online'
  if (!online)  mode = 'offline'
  if (syncing && pending > 0) mode = 'syncing'

  const config = {
    online: {
      dot:   'bg-emerald-400',
      label: 'Online',
      ring:  'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
      pulse: false,
    },
    offline: {
      dot:   'bg-red-400',
      label: pending > 0 ? `Offline — ${pending} ta navbatda` : 'Offline',
      ring:  'border-red-400/30 bg-red-400/10 text-red-300',
      pulse: false,
    },
    syncing: {
      dot:   'bg-yellow-400',
      label: `Sync: ${pending} ta...`,
      ring:  'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
      pulse: true,
    },
  }[mode]

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        border text-xs font-medium select-none transition-all duration-300
        ${config.ring}
        ${className}
      `}
      title={
        mode === 'offline' && pending > 0
          ? `${pending} ta sotuv internet kelganda yuboriladi`
          : mode === 'syncing'
          ? 'Serverga yuborilmoqda...'
          : 'Barcha sotuvlar saqlangan'
      }
    >
      {/* Dot */}
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
      </span>

      {/* Label */}
      <span>{config.label}</span>

      {/* Manual sync button (only offline with pending) */}
      {mode === 'offline' && pending > 0 && online && (
        <button
          onClick={() => { setSyncing(true); syncQueue.sync() }}
          className="ml-1 underline underline-offset-2 hover:no-underline text-xs opacity-80 hover:opacity-100"
        >
          Sync
        </button>
      )}
    </div>
  )
}
