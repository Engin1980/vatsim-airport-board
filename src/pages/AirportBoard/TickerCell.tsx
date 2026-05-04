import { useEffect, useRef } from 'react'
import { TickerBoard } from 'ticker-board'
import 'ticker-board/src/ticker.css'

type Props = {
  text?: string | null
  className?: string
  ariaLabel?: string
}

const TickerCell = ({ text, className, ariaLabel }: Props) => {
  const ref = useRef<HTMLUListElement | null>(null)
  const boardRef = useRef<any>(null)
  const lastTextRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      // ensure element has id so we can pass selector string
      if (!ref.current.id) ref.current.id = `ticker-${Math.random().toString(36).slice(2,9)}`
      const sel = `#${ref.current.id}`
      // Instantiate ticker-board with very large delays so it won't auto-rotate
      boardRef.current = new (TickerBoard as any)(sel, { delay: 86400000, initialDelay: 86400000 })
      // Defensive: try to cancel any internal rotation and noop advance/rotate
      try {
        if (boardRef.current && Array.isArray(boardRef.current.boards)) {
          boardRef.current.boards.forEach((b: any) => {
            try {
              if (typeof b.cancel === 'function') b.cancel()
            } catch (e) {}
            try {
              // prevent future rotations even if internal timer fires
              b.advance = () => {}
              if (typeof b.rotate === 'function') b.rotate = () => {}
            } catch (e) {}
          })
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // fail gracefully and fallback to plain text
      // eslint-disable-next-line no-console
      console.warn('TickerBoard init failed', e)
    }

    return () => {
      try {
        if (boardRef.current && Array.isArray(boardRef.current.boards)) {
          boardRef.current.boards.forEach((b: any) => { try { if (typeof b.cancel === 'function') b.cancel(); } catch (e) {} })
        }
        if (boardRef.current && typeof boardRef.current.destroy === 'function') boardRef.current.destroy()
      } catch (e) {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    const v = text ?? ''
    // avoid unnecessary updates/flicker if text didn't change
    if (lastTextRef.current === v) return
    lastTextRef.current = v

    try {
      if (boardRef.current && Array.isArray(boardRef.current.boards)) {
        boardRef.current.boards.forEach((b: any) => {
          if (typeof b.updateMessages === 'function') b.updateMessages([v])
        })
        return
      }
    } catch (e) {
      // ignore
    }

    // fallback: update only if content changed
    if (ref.current) {
      const existing = ref.current.querySelector('li')
      const newText = v || '\u00A0'
      if (existing && existing.textContent === newText) return
      ref.current.innerHTML = ''
      const li = document.createElement('li')
      li.textContent = newText
      ref.current.appendChild(li)
    }
  }, [text])

  return (
    <ul ref={ref} className={className ?? 'create-ticker'} aria-label={ariaLabel}>
      <li>{text ?? '\u00A0'}</li>
    </ul>
  )
}

export default TickerCell
