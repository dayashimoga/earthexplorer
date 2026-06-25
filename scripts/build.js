const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '../src/app/api');
const tempApiPath = path.join(__dirname, '../src/app/_api');

let apiMoved = false;

try {
  if (fs.existsSync(apiPath)) {
    fs.renameSync(apiPath, tempApiPath);
    apiMoved = true;
    console.log('Temporarily relocated API folder for static build.');
  }

  console.log('Running next build...');
  process.env.NEXT_EXPORT = 'true';
  execSync('npx next build', { stdio: 'inherit' });
} finally {
  if (apiMoved && fs.existsSync(tempApiPath)) {
    fs.renameSync(tempApiPath, apiPath);
    console.log('Restored API folder.');
  }
}
