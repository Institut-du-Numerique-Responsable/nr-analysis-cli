const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { computeCo2 } = require('../cli-core/co2Client');
const root = path.resolve(__dirname, '..');
function internals(file, names) {
    const filename = path.join(root, file);
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(fs.readFileSync(filename, 'utf8') + `\nmodule.exports = {${names}};`, filename);
    return mod.exports;
}
test('strict CSP allows the audit while continuing to block page scripts', async () => {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_BIN, args: process.env.CI ? ['--no-sandbox'] : [] });
    try {
        const { doAnalysis } = internals('cli-core/analysis.js', 'doAnalysis');
        const page = await browser.newPage();
        const catalog = JSON.parse(fs.readFileSync(path.join(root, 'locales/fr.json'), 'utf8'));
        const url = 'data:text/html,' + encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><title>Static page</title><h1>Audit</h1><script>document.body.dataset.executed="yes"</script>');
        const Har = require('puppeteer-har');
        const har = new Har(page);
        await har.start();
        await page.goto(url);
        assert.equal(await page.evaluate(() => document.body.dataset.executed), undefined);
        for (let i = 0; i < 2; i++) {
            const result = await doAnalysis(page, har, 'initial', { getCatalog: () => catalog });
            assert.ok(result.domSize > 0);
            assert.equal(result.bestPractices.ReducedMotion.complianceLevel, 'A');
        }
        // The page's own scripts remain subject to CSP after the audit too.
        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = 'document.body.dataset.executed="yes"';
            document.body.append(script);
        });
        assert.equal(await page.evaluate(() => document.body.dataset.executed), undefined);
        await har.stop();
    } finally { await browser.close(); }
});
