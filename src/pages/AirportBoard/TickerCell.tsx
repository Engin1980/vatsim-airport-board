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

  useEffect(() => {
    if (!ref.current) return
    try {
      // ensure element has id so we can pass selector string
      if (!ref.current.id) ref.current.id = `ticker-${Math.random().toString(36).slice(2,9)}`
      const sel = `#${ref.current.id}`
      boardRef.current = new (TickerBoard as any)(sel)
    } catch (e) {
      // fail gracefully and fallback to plain text
      // eslint-disable-next-line no-console
      console.warn('TickerBoard init failed', e)
    }

    return () => {
      try {
        if (boardRef.current && Array.isArray(boardRef.current.boards)) {
          boardRef.current.boards.forEach((b: any) => { if (typeof b.cancel === 'function') b.cancel(); })
        }
        if (boardRef.current && typeof boardRef.current.destroy === 'function') boardRef.current.destroy()
      } catch (e) {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    const v = text ?? ''
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
    // fallback: set the single list item safely
    if (ref.current) {
      const li = document.createElement('li')
      li.textContent = v || '\u00A0'
      ref.current.innerHTML = ''
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
