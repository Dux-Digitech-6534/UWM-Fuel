import { useRef, useState, ReactNode } from 'react'
import { Icon } from '../icons'

// Pull-down-to-refresh for the scrollable `.body` container. When the user drags
// down while already scrolled to the top, an indicator appears; releasing past the
// threshold calls onRefresh() (which re-fetches that screen's data from the backend).
export function PullToRefresh({ onRefresh, children, className = 'body' }:
  { onRefresh: () => Promise<any>; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const THRESH = 64

  return (
    <div
      ref={ref}
      className={className}
      onTouchStart={(e) => {
        startY.current = ref.current && ref.current.scrollTop <= 0 ? e.touches[0].clientY : null
      }}
      onTouchMove={(e) => {
        if (startY.current == null || busy) return
        const dy = e.touches[0].clientY - startY.current
        if (dy > 0 && ref.current && ref.current.scrollTop <= 0) setPull(Math.min(dy * 0.5, 80))
        else { setPull(0); startY.current = null }
      }}
      onTouchEnd={async () => {
        if (startY.current == null) return
        startY.current = null
        if (pull >= THRESH && !busy) {
          setBusy(true); setPull(40)
          try { await onRefresh() } finally { setBusy(false); setPull(0) }
        } else setPull(0)
      }}
    >
      <div className="ptr-ind" style={{ height: busy ? 40 : pull }}>
        {busy
          ? <span className="spin" />
          : pull > 6 && (
            <span style={{ opacity: Math.min(pull / THRESH, 1), transform: `rotate(${Math.min(pull / THRESH, 1) * 180}deg)`, display: 'inline-flex' }}>
              <Icon name="refresh" size={18} />
            </span>
          )}
      </div>
      {children}
    </div>
  )
}
