import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'apps/web/dist');
const repoUrl = 'https://github.com/karthikhruth11-hash/NEXUSFLOW.git';

console.log('📦 Ensuring web application is built...');
execSync('npm run --workspace=nexusflow-web build', { cwd: rootDir, stdio: 'inherit' });

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found at', distDir);
  process.exit(1);
}

// Add .nojekyll so GitHub Pages doesn't filter files
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

console.log('🚀 Deploying apps/web/dist to gh-pages branch...');
const gitDir = path.join(distDir, '.git');
if (fs.existsSync(gitDir)) {
  fs.rmSync(gitDir, { recursive: true, force: true });
}

try {
  execSync('git init -b gh-pages', { cwd: distDir, stdio: 'inherit' });
  execSync('git add -A', { cwd: distDir, stdio: 'inherit' });
  execSync('git commit -m "deploy: update GitHub Pages build"', { cwd: distDir, stdio: 'inherit' });
  execSync(`git push -f ${repoUrl} gh-pages`, { cwd: distDir, stdio: 'inherit' });
  console.log('\n✅ Successfully deployed to gh-pages branch on GitHub!');
} finally {
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }
}
