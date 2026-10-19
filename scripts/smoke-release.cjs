'use strict';
// Exercises the public Release API and a real, hash-verified installer download.
// The test version and profile are isolated; this script never starts installation.
const { _electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const root = path.join(__dirname, '..');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'fupantai-live-release-'));
  const shots = process.env.FUPANTAI_SCREENSHOTS || path.join(root, 'test-results', 'live-release');
  await fs.mkdir(shots, { recursive: true });
  const env = { ...process.env, FUPANTAI_TEST_PROFILE: profile, FUPANTAI_TEST_VERSION: '0.0.0' };
  delete env.FUPANTAI_TEST_RELEASE;
  const executablePath = process.env.FUPANTAI_EXE || require('electron');
  const child = await _electron.launch({
    executablePath,
    args: process.env.FUPANTAI_EXE ? ['--smoke-test'] : [root, '--smoke-test'],
    env,
    timeout: 45000,
  });
  try {
    const page = await child.firstWindow();
    await page.locator('.fp-banner').waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: '查看更新', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '软件更新', exact: true });
    const download = modal.getByRole('button', { name: '下载安装包', exact: true });
    await download.waitFor();
    await page.screenshot({ path: path.join(shots, '真实发行版通知.png'), animations: 'disabled' });
    await download.click();
    await modal.getByRole('button', { name: '安装并退出', exact: true }).waitFor({ timeout: 600000 });
    assert.match(await modal.innerText(), /SHA-256/);
    const names = await fs.readdir(path.join(profile, 'updates'));
    const filename = names.find(name => /^FuPanTai-Setup-\d+\.\d+\.\d+-x64\.exe$/.test(name));
    assert.ok(filename, 'A verified installer must exist');
    assert.equal(names.some(name => name.endsWith('.partial')), false);
    const downloaded = await fs.readFile(path.join(profile, 'updates', filename));
    const sha256 = crypto.createHash('sha256').update(downloaded).digest('hex');
    const { parseChecksum } = require('../src/update-core.cjs');
    assert.equal(sha256, parseChecksum(await fs.readFile(path.join(root, 'dist', 'SHA256SUMS.txt'), 'utf8'), filename));
    await page.screenshot({ path: path.join(shots, '真实安装包校验通过.png'), animations: 'disabled' });
    console.log(JSON.stringify({ repository: require('../release-source.json').repository, filename, bytes: downloaded.length, sha256, publicRelease: 'pass', inAppDownload: 'pass', checksum: 'pass', installerExecuted: false }, null, 2));
  } finally {
    await child.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
