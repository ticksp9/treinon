// Generates every app icon from public/icon.svg (run: node scripts/icons/generate.mjs
// from a folder where @resvg/resvg-js and png-to-ico are installed, with ROOT set).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const root = process.env.ROOT;
const pub = join(root, 'public');
const icon = readFileSync(join(pub, 'icon.svg'), 'utf8');
const maskable = readFileSync(join(root, 'scripts/icons/icon-maskable.svg'), 'utf8');

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

writeFileSync(join(pub, 'pwa-192x192.png'), render(icon, 192));
writeFileSync(join(pub, 'pwa-512x512.png'), render(icon, 512));
writeFileSync(join(pub, 'pwa-maskable-512x512.png'), render(maskable, 512));
// iOS draws its own rounded corners and dislikes transparency: use the full-bleed version
writeFileSync(join(pub, 'apple-touch-icon.png'), render(maskable, 180));
writeFileSync(join(pub, 'favicon.ico'), await pngToIco([16, 32, 48].map((s) => render(icon, s))));
console.log('icons written to', pub);
