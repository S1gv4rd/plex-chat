#!/usr/bin/env node
// Generate PNG icons from SVG for PWA/iOS support
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const svgContent = readFileSync(join(publicDir, 'icon.svg'), 'utf8');

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const pngBuffer = await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toBuffer();

    writeFileSync(join(publicDir, `icon-${size}.png`), pngBuffer);
    console.log(`Generated icon-${size}.png`);
  }

  // Also generate apple-touch-icon (180x180)
  const appleIcon = await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toBuffer();

  writeFileSync(join(publicDir, 'apple-touch-icon.png'), appleIcon);
  console.log('Generated apple-touch-icon.png');
}

generateIcons().catch(console.error);
