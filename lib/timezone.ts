const FALLBACK_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || process.env.APP_TIME_ZONE || 'UTC'

const getDateParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  return formatter.formatToParts(date).reduce<Record<string, string>>((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value
    }
    return parts
  }, {})
}

const zonedTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0))
  const zonedParts = getDateParts(utcGuess, timeZone)

  const zonedAsUtc = Date.UTC(
    Number(zonedParts.year),
    Number(zonedParts.month) - 1,
    Number(zonedParts.day),
    Number(zonedParts.hour),
    Number(zonedParts.minute),
    Number(zonedParts.second),
    0
  )

  const utcGuessAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0)
  const offset = zonedAsUtc - utcGuessAsUtc

  return new Date(utcGuess.getTime() - offset)
}

export function getConfiguredTimeZone(): string {
  return FALLBACK_TIME_ZONE
}

export function getBrowserTimeZone(fallback = FALLBACK_TIME_ZONE): string {
  if (typeof Intl === 'undefined') return fallback

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback
  } catch {
    return fallback
  }
}

export function formatDateInTimeZone(
  dateInput: string | number | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-PK'
): string {
  return new Date(dateInput).toLocaleString(locale, {
    timeZone,
    ...options,
  })
}

export function getDateStringInTimeZone(dateInput: string | number | Date, timeZone: string): string {
  const parts = getDateParts(new Date(dateInput), timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getStartOfMonthInTimeZone(dateString: string, timeZone: string): string {
  const [year, month] = dateString.split('-').map(Number)
  return zonedTimeToUtc(year, month, 1, 0, 0, 0, timeZone).toISOString()
}

export function getStartOfYearInTimeZone(dateString: string, timeZone: string): string {
  const [year] = dateString.split('-').map(Number)
  return zonedTimeToUtc(year, 1, 1, 0, 0, 0, timeZone).toISOString()
}

export function getTimeZoneDayBounds(dateString: string, timeZone: string): { start: string; end: string } {
  const [year, month, day] = dateString.split('-').map(Number)

  const start = zonedTimeToUtc(year, month, day, 0, 0, 0, timeZone).toISOString()
  const end = new Date(zonedTimeToUtc(year, month, day, 23, 59, 59, timeZone).getTime() + 999).toISOString()

  return { start, end }
}