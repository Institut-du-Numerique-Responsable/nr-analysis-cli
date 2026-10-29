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
function rule(file, document = {}) {
    let result;
    const context = vm.createContext({ document, CSSRule: { MEDIA_RULE: 4 },
        chrome: { i18n: { getMessage: key => key } },
        rulesManager: { registerRule: r => { result = r; } } });
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    result.initialize?.();
    return result;
}
test('zstd responses are counted as compressed', () => {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'nr-core/utils.js'), 'utf8'), context);
    for (const encoding of ['zstd', 'ZSTD', 'gzip', 'br']) {
        assert.equal(context.isResourceCompressed({ response: { headers: [{ name: 'Content-Encoding', value: encoding }] } }), true, encoding);
    }
    assert.equal(context.isResourceCompressed({ response: { headers: [] } }), false);
});
test('fixed per-visit overhead does not penalise the transfer score', () => {
    const small = computeCo2(4000, false, { methodology: 'negaoctet' });
    assert.equal(small.result.complianceLevel, 'A');
    assert.ok(small.value >= 1.5, 'total must retain the overhead');
    for (const bytes of [0, 4000, 5000000, 50000000]) {
        assert.equal(computeCo2(bytes, false, { methodology: 'negaoctet' }).result.complianceLevel,
            computeCo2(bytes, false, { methodology: 'swdm-v4' }).result.complianceLevel);
    }
    assert.equal(computeCo2(50000000).result.complianceLevel, 'C');
});
test('HTTP/2 negotiated by TLS overrides the HTTP/1.1 probe limitation', () => {
    const { checkHttpVersion } = internals('cli-core/serverAudit.js', 'checkHttpVersion');
    assert.equal(checkHttpVersion({ httpVersion: '1.1', headers: {} }, { alpnProtocol: 'h2' }).complianceLevel, 'A');
    assert.equal(checkHttpVersion({ httpVersion: '1.1', headers: {} }, { alpnProtocol: 'http/1.1' }).complianceLevel, 'C');
    const advertised = checkHttpVersion({ httpVersion: '1.1', headers: { 'alt-svc': 'h3=":443"; ma=86400' } }, null);
    assert.match(advertised.comment, /HTTP\/3/);
    assert.notEqual(advertised.complianceLevel, 'A', 'advertisement is not a verified connection');
});
test('static pages pass ReducedMotion even without a stylesheet', () => {
    const r = rule('nr-core/rules/wsg/ReducedMotion.js', { styleSheets: [], querySelectorAll: () => [], getAnimations: () => [] });
    r.check({ autoplayMediaCount: 0 });
    assert.equal(r.complianceLevel, 'A');
});
test('motion still requires a reduced-motion preference', () => {
    const r = rule('nr-core/rules/wsg/ReducedMotion.js', {
        styleSheets: [{ cssRules: [{ style: { animationName: 'spin', animationDuration: '1s' } }] }],
        querySelectorAll: () => [], getAnimations: () => [] });
    r.check({ autoplayMediaCount: 0 });
    assert.equal(r.complianceLevel, 'C');
});
test('autoplay and unreadable CSS cannot silently pass ReducedMotion', () => {
    for (const doc of [
        { styleSheets: [], querySelectorAll: () => [], getAnimations: () => [] },
        { styleSheets: [{ get cssRules() { throw Error('cross origin'); } }], querySelectorAll: () => [], getAnimations: () => [] },
    ]) {
        const r = rule('nr-core/rules/wsg/ReducedMotion.js', doc);
        r.check({ autoplayMediaCount: doc.styleSheets.length ? 0 : 1 });
        assert.notEqual(r.complianceLevel, 'A');
    }
});
test('opt-in motion passes but does not exempt unguarded motion', () => {
    const guarded = { conditionText: '(prefers-reduced-motion: no-preference)', cssRules: [{ style: { transitionDuration: '1s' } }] };
    for (const [rules, expected] of [[ [guarded], 'A' ], [ [guarded, { style: { transitionDuration: '1s' } }], 'C' ]]) {
        const r = rule('nr-core/rules/wsg/ReducedMotion.js', { styleSheets: [{ cssRules: rules }], querySelectorAll: () => [], getAnimations: () => [] });
        r.check({ autoplayMediaCount: 0 });
        assert.equal(r.complianceLevel, expected);
    }
});
