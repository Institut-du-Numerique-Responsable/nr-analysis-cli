/*
 * Server-side audit: cyber security + numerique-responsable server perf.
 * Runs from Node, independent from Puppeteer DOM context.
 */

const tls = require('tls');
const dns = require('dns').promises;
const https = require('https');
const http = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 8000;

async function auditServer(rawUrl) {
    const url = new URL(rawUrl);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
    const isHttps = url.protocol === 'https:';

    const [dnsInfo, tlsInfo, getRes, plainRes, securityTxt, dnssecInfo] = await Promise.all([
        probeDns(host),
        isHttps ? probeTls(host, port) : Promise.resolve(null),
        probeRequest(rawUrl, { method: 'GET', acceptEncoding: 'br, gzip, deflate' }),
        isHttps ? probeRequest(`http://${host}${url.pathname}${url.search}`, { method: 'GET' }) : Promise.resolve(null),
        probeRequest(`${url.protocol}//${host}/.well-known/security.txt`, { method: 'GET' }).catch(() => null),
        probeDnssec(host),
    ]);

    const headers = (getRes && getRes.headers) || {};

    const security = {
        Tls: checkTlsVersion(tlsInfo, isHttps),
        Hsts: checkHsts(headers, isHttps),
        Csp: checkCsp(headers),
        XContentTypeOptions: checkXcto(headers),
        XFrameOptions: checkXfo(headers),
        ReferrerPolicy: checkReferrerPolicy(headers),
        PermissionsPolicy: checkPermissionsPolicy(headers),
        CookieFlags: checkCookieFlags(headers),
        ServerLeak: checkServerLeak(headers),
        SecurityTxt: checkSecurityTxt(securityTxt),
        HttpToHttpsRedirect: checkHttpRedirect(plainRes, isHttps),
        CrossOriginIsolation: checkCrossOriginIsolation(headers),
        OcspStapling: checkOcspStapling(tlsInfo, isHttps),
        Dnssec: checkDnssec(dnssecInfo),
    };

    const server = {
        Compression: checkCompression(getRes, headers),
        HttpVersion: checkHttpVersion(getRes),
        CacheControl: checkCacheControl(headers),
        DnsIpv6: checkIpv6(dnsInfo),
        DnsRedundancy: checkDnsRedundancy(dnsInfo),
        TlsResumption: checkTlsResumption(tlsInfo),
        Cdn: checkCdn(headers),
    };

    return { security, server, raw: { dnsInfo, tlsInfo, headers, statusCode: getRes && getRes.statusCode } };
}

async function probeDns(host) {
    const [a, aaaa] = await Promise.all([
        dns.resolve4(host).catch(() => []),
        dns.resolve6(host).catch(() => []),
    ]);
    return { a, aaaa };
}

function probeTls(host, port) {
    return new Promise((resolve) => {
        let ocspStapled = false;
        const socket = tls.connect(
            { host, port, servername: host, timeout: TIMEOUT_MS, rejectUnauthorized: false, requestOCSP: true },
            () => {
                const cipher = socket.getCipher();
                const proto = socket.getProtocol();
                const cert = socket.getPeerCertificate();
                const session = socket.getSession();
                socket.end();
                resolve({ protocol: proto, cipher, certIssuer: cert && cert.issuer, validTo: cert && cert.valid_to, hasSession: !!session, ocspStapled });
            }
        );
        socket.on('OCSPResponse', (data) => { if (data && data.length > 0) ocspStapled = true; });
        socket.on('error', () => resolve(null));
        socket.on('timeout', () => { socket.destroy(); resolve(null); });
    });
}

async function probeDnssec(host) {
    // Heuristic: a DNSSEC-signed zone returns the AD (authenticated data) flag from a validating resolver.
    // Node's dns module doesn't expose AD; we check for DNSKEY/DS records as a proxy via Cloudflare DoH.
    try {
        const lookupHost = host.split('.').slice(-2).join('.');
        const res = await fetchDoh(`https://1.1.1.1/dns-query?name=${encodeURIComponent(lookupHost)}&type=DNSKEY`, 'application/dns-json');
        if (!res) return { signed: null };
        const json = JSON.parse(res);
        return { signed: Array.isArray(json.Answer) && json.Answer.length > 0, ad: json.AD === true };
    } catch {
        return { signed: null };
    }
}

function fetchDoh(rawUrl, accept) {
    return new Promise((resolve) => {
        try {
            const url = new URL(rawUrl);
            const req = https.request({
                method: 'GET', hostname: url.hostname, port: 443, path: url.pathname + url.search,
                headers: { Accept: accept }, timeout: TIMEOUT_MS, rejectUnauthorized: true,
            }, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.end();
        } catch { resolve(null); }
    });
}

function probeRequest(rawUrl, options = {}) {
    return new Promise((resolve) => {
        let url;
        try { url = new URL(rawUrl); } catch { return resolve(null); }
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request(
            {
                method: options.method || 'GET',
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                    'Accept-Encoding': options.acceptEncoding || 'identity',
                    'User-Agent': 'nr-analysis-cli server audit',
                    Accept: '*/*',
                },
                timeout: TIMEOUT_MS,
                rejectUnauthorized: false,
            },
            (res) => {
                let total = 0;
                res.on('data', (c) => { total += c.length; });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        httpVersion: res.httpVersion,
                        bodyLength: total,
                    });
                });
            }
        );
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function checkTlsVersion(t, isHttps) {
    if (!isHttps) return failL('Site servi en HTTP non chiffré');
    if (!t) return failL('Handshake TLS impossible');
    const p = t.protocol || '';
    if (p === 'TLSv1.3') return passL(p);
    if (p === 'TLSv1.2') return warnL(`${p} (TLS 1.3 recommande)`);
    return failL(`${p || 'inconnu'} — protocole obsolete`);
}

function checkHsts(h, isHttps) {
    if (!isHttps) return failL('HTTPS absent — HSTS inapplicable');
    const v = h['strict-transport-security'];
    if (!v) return failL('Strict-Transport-Security absent');
    const maxAge = (/max-age=(\d+)/i.exec(v) || [])[1];
    const age = parseInt(maxAge, 10) || 0;
    if (age < 15552000) return warnL(`max-age=${age} (< 6 mois)`);
    if (!/includeSubDomains/i.test(v)) return warnL(`max-age OK, includeSubDomains absent`);
    return passL(`max-age=${age}, includeSubDomains`);
}

function checkCsp(h) {
    const v = h['content-security-policy'];
    if (!v) return failL('Content-Security-Policy absent');
    if (/unsafe-inline|unsafe-eval/i.test(v)) return warnL(`present mais contient unsafe-inline/eval`);
    return passL('present, sans unsafe-*');
}

function checkXcto(h) {
    return h['x-content-type-options'] === 'nosniff' ? passL('nosniff') : failL('X-Content-Type-Options absent');
}

function checkXfo(h) {
    const v = h['x-frame-options'];
    const csp = h['content-security-policy'] || '';
    if (/frame-ancestors/i.test(csp)) return passL('CSP frame-ancestors');
    if (!v) return failL('X-Frame-Options absent (clickjacking)');
    if (/deny|sameorigin/i.test(v)) return passL(v);
    return warnL(v);
}

function checkReferrerPolicy(h) {
    const v = h['referrer-policy'];
    if (!v) return failL('Referrer-Policy absent');
    const strict = ['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin', 'same-origin'];
    return strict.includes(v.toLowerCase()) ? passL(v) : warnL(v);
}

function checkPermissionsPolicy(h) {
    const v = h['permissions-policy'] || h['feature-policy'];
    return v ? passL('present') : warnL('Permissions-Policy absent');
}

function checkCookieFlags(h) {
    const setCookies = [].concat(h['set-cookie'] || []);
    if (setCookies.length === 0) return passL('aucun cookie');
    const bad = setCookies.filter((c) => {
        return !/;\s*secure/i.test(c) || !/;\s*httponly/i.test(c) || !/;\s*samesite=/i.test(c);
    });
    if (bad.length === 0) return passL(`${setCookies.length} cookies, tous flags OK`);
    return failL(`${bad.length}/${setCookies.length} cookies sans Secure/HttpOnly/SameSite`);
}

function checkServerLeak(h) {
    const leaks = [];
    if (h['server']) leaks.push(`Server: ${h['server']}`);
    if (h['x-powered-by']) leaks.push(`X-Powered-By: ${h['x-powered-by']}`);
    if (h['x-aspnet-version']) leaks.push(`X-AspNet-Version: ${h['x-aspnet-version']}`);
    if (leaks.length === 0) return passL('aucune fuite de version');
    return warnL(leaks.join(' · '));
}

function checkSecurityTxt(res) {
    if (res && res.statusCode === 200) return passL('present');
    return warnL('absent — RFC 9116');
}

function checkHttpRedirect(plainRes, isHttps) {
    if (!isHttps) return failL('HTTPS absent');
    if (!plainRes) return warnL('HTTP non testable');
    const sc = plainRes.statusCode;
    if (sc >= 300 && sc < 400) {
        const loc = plainRes.headers && plainRes.headers.location;
        if (loc && loc.startsWith('https://')) return passL(`${sc} -> https`);
        return warnL(`redirige ${sc} mais pas vers https`);
    }
    return failL(`HTTP ${sc} sans redirection vers HTTPS`);
}

function checkCrossOriginIsolation(h) {
    const coop = h['cross-origin-opener-policy'];
    const corp = h['cross-origin-resource-policy'];
    if (coop && corp) return passL(`COOP=${coop} · CORP=${corp}`);
    if (coop || corp) return warnL(`COOP/CORP partiel`);
    return warnL('COOP/CORP absents (Spectre)');
}

function checkCompression(res, h) {
    if (!res) return failL('Pas de reponse');
    const enc = (h['content-encoding'] || '').toLowerCase();
    if (enc.includes('br')) return passL('Brotli');
    if (enc.includes('zstd')) return passL('Zstd');
    if (enc.includes('gzip')) return warnL('gzip (Brotli recommande)');
    if (enc.includes('deflate')) return warnL('deflate');
    return failL('aucune compression negociee');
}

function checkHttpVersion(res) {
    if (!res) return failL('Pas de reponse');
    const v = res.httpVersion;
    if (v === '3.0' || v === '3') return passL('HTTP/3');
    if (v === '2.0' || v === '2') return passL('HTTP/2');
    if (v && v.startsWith('1.')) return failL(`HTTP/${v} — pas de multiplexage`);
    return warnL(`version: ${v || '?'}`);
}

function checkCacheControl(h) {
    const cc = h['cache-control'];
    const expires = h['expires'];
    const etag = h['etag'];
    if (!cc && !expires && !etag) return failL('aucun en-tete de cache');
    if (cc && /no-store|no-cache/i.test(cc) && !etag) return warnL(`cache-control: ${cc} (sans ETag)`);
    if (cc && /max-age=(\d+)/i.test(cc)) {
        const age = parseInt(/max-age=(\d+)/i.exec(cc)[1], 10);
        if (age >= 86400) return passL(`max-age=${age}`);
        return warnL(`max-age=${age} (< 24h)`);
    }
    return warnL(cc || expires || etag);
}

function checkIpv6(d) {
    if (!d) return warnL('DNS non resolu');
    if (d.aaaa && d.aaaa.length > 0) return passL(`${d.aaaa.length} AAAA`);
    return warnL('aucun enregistrement AAAA (IPv6)');
}

function checkDnsRedundancy(d) {
    if (!d) return warnL('DNS non resolu');
    const total = (d.a || []).length + (d.aaaa || []).length;
    if (total >= 2) return passL(`${total} IPs`);
    return warnL(`${total} IP — pas de redondance`);
}

function checkTlsResumption(t) {
    if (!t) return warnL('TLS non teste');
    return t.hasSession ? passL('session ticket') : warnL('pas de session ticket');
}

function checkOcspStapling(t, isHttps) {
    if (!isHttps) return failL('HTTPS absent');
    if (!t) return warnL('TLS non teste');
    return t.ocspStapled ? passL('OCSP staple recu') : warnL('OCSP stapling absent');
}

function checkDnssec(d) {
    if (!d || d.signed === null) return warnL('DNSSEC non testable');
    if (d.signed) return passL('zone signee (DNSKEY)');
    return warnL('zone non signee DNSSEC');
}

function checkCdn(h) {
    const cdnHeaders = ['cf-ray', 'x-amz-cf-id', 'x-fastly-request-id', 'x-azure-ref', 'x-akamai-transformed', 'x-served-by', 'x-cache'];
    const hit = cdnHeaders.find((k) => h[k]);
    if (hit) return passL(`signature: ${hit}`);
    return warnL('aucune signature CDN detectee');
}

function passL(msg) { return { complianceLevel: 'A', comment: msg, detailComment: '' }; }
function warnL(msg) { return { complianceLevel: 'B', comment: msg, detailComment: msg }; }
function failL(msg) { return { complianceLevel: 'C', comment: msg, detailComment: msg }; }

const SEVERITY = {
    Tls: 'critical',
    Hsts: 'critical',
    HttpToHttpsRedirect: 'critical',
    CookieFlags: 'critical',
    Csp: 'important',
    XContentTypeOptions: 'important',
    XFrameOptions: 'important',
    ReferrerPolicy: 'important',
    PermissionsPolicy: 'important',
    CacheControl: 'important',
    SecurityTxt: 'recommended',
    CrossOriginIsolation: 'recommended',
    Compression: 'recommended',
    HttpVersion: 'recommended',
    DnsIpv6: 'recommended',
    Dnssec: 'recommended',
    OcspStapling: 'recommended',
    DnsRedundancy: 'recommended',
    TlsResumption: 'recommended',
    ServerLeak: 'info',
    Cdn: 'info',
};

function getSeverity(id) { return SEVERITY[id] || 'info'; }

module.exports = { auditServer, SEVERITY, getSeverity };
