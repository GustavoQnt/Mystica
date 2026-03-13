export const READING_STYLES = ['sincera', 'acolhedora', 'analitica'] as const

export type ReadingStyle = (typeof READING_STYLES)[number]

export function isReadingStyle(value: unknown): value is ReadingStyle {
  return typeof value === 'string' && READING_STYLES.includes(value as ReadingStyle)
}

export function resolveReadingStyle(value: unknown): ReadingStyle {
  return isReadingStyle(value) ? value : 'sincera'
}

export function getReadingStyleLabel(style: ReadingStyle): string {
  switch (style) {
    case 'acolhedora':
      return 'Acolhedora'
    case 'analitica':
      return 'Analítica'
    case 'sincera':
    default:
      return 'Sincera'
  }
}
