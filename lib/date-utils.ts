/**
 * Date utility functions for Pakistan Time (PKT - UTC+5)
 */

/**
 * Get current date and time in PKT timezone as ISO string
 * Pakistan Time is UTC+5 (no DST)
 */
export function getPKTNow(): string {
  const now = new Date()
  const pktOffset = 5 * 60 // PKT is UTC+5 in minutes
  const localOffset = now.getTimezoneOffset() // Local offset in minutes (negative for east of UTC)
  const pktTime = new Date(now.getTime() + (pktOffset + localOffset) * 60 * 1000)
  return pktTime.toISOString()
}

/**
 * Get current date in PKT timezone in YYYY-MM-DD format
 */
export function getPKTDate(): string {
  return getPKTNow().split('T')[0]
}

/**
 * Get current date and time in PKT timezone formatted for display
 */
export function getPKTDateTimeString(): string {
  const pktTime = new Date(getPKTNow())
  return pktTime.toLocaleString('en-PK', { 
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * Convert a UTC date string to PKT and format for display
 */
export function formatDateToPKT(utcDateString: string): string {
  const date = new Date(utcDateString)
  return date.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Get start of day in PKT for date filtering
 */
export function getPKTStartOfDay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00+05:00') // PKT timezone
  return date.toISOString()
}

/**
 * Get end of day in PKT for date filtering
 */
export function getPKTEndOfDay(dateString: string): string {
  const date = new Date(dateString + 'T23:59:59.999+05:00') // PKT timezone
  return date.toISOString()
}
