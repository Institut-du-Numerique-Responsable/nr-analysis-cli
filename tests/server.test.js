const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../cli-core/serverAudit.js');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports = {probeTls, probeRequest, checkHttpVersion};', filename);
const { probeTls, probeRequest, checkHttpVersion } = mod.exports;

test('TLS probe negotiates HTTP/2 with a real server', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-tls-'));
    let server;
    try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
        server = tls.createServer({ key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')), ALPNProtocols: ['h2', 'http/1.1'] }, socket => socket.end());
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const result = await probeTls('127.0.0.1', server.address().port);
        assert.equal(result.alpnProtocol, 'h2');
        assert.equal(checkHttpVersion({ httpVersion: '1.1' }, result).complianceLevel, 'A');
    } finally {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('HTTP probe offers zstd and counts the compressed response bytes', async () => {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'content-encoding': req.headers['accept-encoding'].includes('zstd') ? 'zstd' : 'identity' });
        res.end('fixture');
    });
    try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const response = await probeRequest(`http://127.0.0.1:${server.address().port}`, { acceptEncoding: 'br, zstd, gzip, deflate' });
        assert.equal(response.headers['content-encoding'], 'zstd');
        assert.equal(response.bodyLength, 7);
    } finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
});
