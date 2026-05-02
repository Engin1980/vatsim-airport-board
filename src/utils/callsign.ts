export function splitCallsign(cs: string | undefined | null): string {
  if (!cs) return ''
  const s = String(cs)
  // find first digit
  const m = s.match(/\d/)
  if (m) {
    const idx = s.indexOf(m[0])
    // insert space before first digit if not already preceded by space
    if (idx > 0 && s[idx-1] !== ' ') {
      return s.slice(0, idx) + ' ' + s.slice(idx)
    }
    return s
  }
  // no digit: insert space after first 2 characters (if length > 2)
  if (s.length > 2) return s.slice(0,2) + ' ' + s.slice(2)
  // short strings: just return with a trailing space
  return s + ' '
}
