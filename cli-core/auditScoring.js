/*
 * Generic weighted scoring for the server-audit categories (security + server perf).
 */

const SECURITY_WEIGHTS = {
    Tls: 5,
    Hsts: 4,
    Csp: 5,
    XContentTypeOptions: 3,
    XFrameOptions: 4,
    ReferrerPolicy: 3,
    PermissionsPolicy: 2,
    CookieFlags: 4,
    ServerLeak: 2,
    SecurityTxt: 1,
    HttpToHttpsRedirect: 5,
    CrossOriginIsolation: 2,
    OcspStapling: 2,
    Dnssec: 2,
};

const SERVER_WEIGHTS = {
    Compression: 5,
    HttpVersion: 4,
    CacheControl: 4,
    DnsIpv6: 3,
    DnsRedundancy: 3,
    TlsResumption: 2,
    Cdn: 2,
};

const SCORE_BY_LEVEL = { A: 1.0, B: 0.5, C: 0.0 };

const GRADE_THRESHOLDS = [
    { min: 90, grade: 'A' },
    { min: 75, grade: 'B' },
    { min: 60, grade: 'C' },
    { min: 45, grade: 'D' },
    { min: 30, grade: 'E' },
    { min: 15, grade: 'F' },
    { min: 0, grade: 'G' },
];

function scoreToGrade(score) {
    return (GRADE_THRESHOLDS.find((t) => score >= t.min) || { grade: 'G' }).grade;
}

function score(checks, weights) {
    if (!checks) return { score: 0, grade: 'G', summary: emptySummary(), issues: [] };
    let weighted = 0;
    let total = 0;
    const summary = emptySummary();
    const issues = [];
    for (const [id, r] of Object.entries(checks)) {
        const w = weights[id] || 1;
        const lvl = (r && r.complianceLevel) || 'C';
        weighted += (SCORE_BY_LEVEL[lvl] || 0) * w;
        total += w;
        if (lvl === 'A') summary.pass++;
        else if (lvl === 'B') summary.warn++;
        else summary.fail++;
        if (lvl !== 'A') issues.push({ id, comment: r.comment || '' });
    }
    summary.total = summary.pass + summary.warn + summary.fail;
    const s = total > 0 ? Math.round((weighted / total) * 100) : 0;
    return { score: s, grade: scoreToGrade(s), summary, issues };
}

function emptySummary() { return { pass: 0, warn: 0, fail: 0, total: 0 }; }

function computeSecurityScore(checks) { return score(checks, SECURITY_WEIGHTS); }
function computeServerScore(checks) { return score(checks, SERVER_WEIGHTS); }

module.exports = { computeSecurityScore, computeServerScore, scoreToGrade };
