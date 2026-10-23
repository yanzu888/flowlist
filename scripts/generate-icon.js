const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'assets', 'app-icon.svg');
const output = path.join(projectRoot, 'assets', 'app-icon.png');

sharp(source)
  .resize(256, 256)
  .png()
  .toFile(output)
  .then(() => console.log(`Generated ${output}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
