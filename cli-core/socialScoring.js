/*
 * Social score = accessibility / inclusion pillar of digital sustainability.
 * Derived from the Tanaguru-inspired checks executed in the page context.
 * Weights mirror the WCAG criticality used by Tanaguru (perception > use > understand > robust).
 */

const CHECK_WEIGHTS = {
    ImgAlt: 5,
    DocumentLanguage: 4,
    PageTitle: 3,
    HeadingStructure: 4,
    FormLabel: 5,
    LinkText: 4,
    ButtonName: 4,
    Landmarks: 3,
    TableHeaders: 3,
    ColorContrast: 5,
    IframeTitle: 2,
    TabIndex: 2,
    FontDisplaySwap: 3,
    FontPreload: 2,
    FontSubset: 2,
    ConsentBanner: 4,
    ThirdPartyCookies: 3,
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

function computeSocialScore(a11y) {
    if (!a11y || !a11y.checks) {
        return { score: 0, grade: 'G', summary: { pass: 0, warn: 0, fail: 0, total: 0 }, issues: [] };
    }
    let weighted = 0;
    let total = 0;
    for (const [id, result] of Object.entries(a11y.checks)) {
        const w = CHECK_WEIGHTS[id] || 1;
        weighted += (SCORE_BY_LEVEL[result.complianceLevel] || 0) * w;
        total += w;
    }
    const score = total > 0 ? Math.round((weighted / total) * 100) : 0;
    return {
        score,
        grade: scoreToGrade(score),
        summary: a11y.summary,
        issues: a11y.issues || [],
    };
}

module.exports = { computeSocialScore, scoreToGrade, CHECK_WEIGHTS };
