const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const clientPath = path.join(__dirname, '..', 'node_modules', '@prisma', 'client');
if (fs.existsSync(clientPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(clientPath, 'package.json')));
    // if very old/empty, regenerate
  } catch {}
}
try {
  execSync('npx prisma generate --schema=./prisma/schema.prisma', { stdio: 'inherit' });
} catch (err) {
  console.error(err);
  process.exit(1);
}
