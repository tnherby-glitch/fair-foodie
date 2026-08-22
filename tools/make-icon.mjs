// Renders the 1024x1024 App Store icon from the brand SVG.
// App Store marketing icons must be opaque (no alpha), so flatten onto the
// icon's own background if the SVG has transparency.
import sharp from 'sharp';

const SRC = 'assets/app-icon.svg';
const OUT = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';

const png = await sharp(SRC, { density: 1024 })
  .resize(1024, 1024, { fit: 'cover' })
  .flatten({ background: '#E89C31' }) // batter gold — matches the icon field
  .png()
  .toBuffer();

await sharp(png).toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`icon written: ${meta.width}x${meta.height}, alpha: ${meta.hasAlpha}`);
