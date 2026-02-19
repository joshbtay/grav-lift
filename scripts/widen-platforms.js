import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the level file
const levelPath = path.join(__dirname, '../public/levels/level1.json');
const levelData = JSON.parse(fs.readFileSync(levelPath, 'utf8'));

// Increase width and depth by 50% for all platforms
levelData.platforms.forEach(platform => {
  platform.size.width *= 1.5;
  platform.size.depth *= 1.5;
});

// Write the updated level back
fs.writeFileSync(levelPath, JSON.stringify(levelData, null, 2));

console.log('All platforms widened by 50%!');
