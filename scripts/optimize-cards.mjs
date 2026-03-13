import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const projectRoot = process.cwd()
const sourceDir = path.join(projectRoot, 'raw', 'cards-source')
const outputDir = path.join(projectRoot, 'public', 'cards')
const expectedCount = 78

async function clearGeneratedAssets() {
  const entries = await readdir(outputDir, { withFileTypes: true })

  await Promise.all(
    entries
      .filter(entry => entry.isFile() && /\.(avif|webp)$/i.test(entry.name))
      .map(entry => rm(path.join(outputDir, entry.name), { force: true }))
  )
}

async function main() {
  await mkdir(sourceDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const entries = await readdir(sourceDir, { withFileTypes: true })
  const jpgFiles = entries
    .filter(entry => entry.isFile() && /\.jpe?g$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))

  if (jpgFiles.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} JPG files in ${sourceDir}, found ${jpgFiles.length}`
    )
  }

  await clearGeneratedAssets()

  for (const fileName of jpgFiles) {
    const sourcePath = path.join(sourceDir, fileName)
    const baseName = fileName.replace(/\.[^.]+$/, '')

    await sharp(sourcePath)
      .rotate()
      .avif({ quality: 58, effort: 6 })
      .toFile(path.join(outputDir, `${baseName}.avif`))

    await sharp(sourcePath)
      .rotate()
      .webp({ quality: 72, effort: 6 })
      .toFile(path.join(outputDir, `${baseName}.webp`))
  }

  console.log(`Optimized ${jpgFiles.length} cards into AVIF and WebP.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
