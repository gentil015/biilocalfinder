const { execSync } = require('child_process');
try {
  require('@prisma/client');
  process.exit(0);
} catch (e) {
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
