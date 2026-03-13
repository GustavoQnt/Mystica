import tarotImages from '../../public/cards/tarot-images.json'

interface TarotImagesFile {
  cards: Array<{
    img: string
  }>
}

const imageManifest = tarotImages as TarotImagesFile

export function getCardImageCandidates(cardId: number): string[] {
  const image = imageManifest.cards[cardId]?.img
  if (!image) return []

  const extensionIndex = image.lastIndexOf('.')
  const baseName = extensionIndex >= 0 ? image.slice(0, extensionIndex) : image

  return [`/cards/${baseName}.avif`, `/cards/${baseName}.webp`]
}
