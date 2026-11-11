const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { listReportFileName } = require('../commands/analyse');

test('URL list report keeps the HTML index name by default', () => {
    assert.equal(listReportFileName('2026-11-11_example', undefined), '2026-11-11_example_index.html');
    assert.equal(listReportFileName('2026-11-11_example', 'html'), '2026-11-11_example_index.html');
});

test('URL list report with --format xlsx gets an .xlsx file name', () => {
    const name = listReportFileName('2026-11-11_example', 'xlsx');
    assert.equal(path.extname(name), '.xlsx');
    assert.equal(name, '2026-11-11_example.xlsx');
});

test('format matching is case-insensitive', () => {
    assert.equal(listReportFileName('p', 'XLSX'), 'p.xlsx');
});
