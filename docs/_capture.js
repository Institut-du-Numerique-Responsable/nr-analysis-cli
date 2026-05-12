// One-off helper to refresh README screenshots from a generated report.
// Usage: node docs/_capture.js <reportHtml> <outFile> [width]
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const [report, out, widthArg] = process.argv.slice(2);
    if (!report || !out) {
        console.error('Usage: node docs/_capture.js <reportHtml> <outFile> [width=1280]');
        process.exit(1);
    }
    const width = parseInt(widthArg || '1280', 10);
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto('file://' + path.resolve(report), { waitUntil: 'networkidle0' });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
    await page.screenshot({ path: out, fullPage: true, type: out.endsWith('.png') ? 'png' : 'jpeg', quality: out.endsWith('.png') ? undefined : 70 });
    await browser.close();
    console.log('Saved', out);
})();
