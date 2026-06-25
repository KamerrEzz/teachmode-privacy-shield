// Run with: node generate-icons.js
// Generates PNG icons from canvas (Node.js + canvas package not needed — uses SVG data URIs)
// For simplicity, this script outputs the SVG source to copy into icons manually.
// OR use any online SVG-to-PNG tool with the SVG below.

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#111111"/>
  <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" rx="${size * 0.12}" fill="#f97316"/>
  <text x="${size / 2}" y="${size * 0.72}" font-family="monospace" font-weight="700" font-size="${size * 0.55}" fill="#111" text-anchor="middle">T</text>
</svg>`;

console.log("=== icon16.svg ===");
console.log(svg(16));
console.log("\n=== icon48.svg ===");
console.log(svg(48));
console.log("\n=== icon128.svg ===");
console.log(svg(128));
console.log("\nConvert SVGs to PNG using: https://svgtopng.com or Inkscape");
