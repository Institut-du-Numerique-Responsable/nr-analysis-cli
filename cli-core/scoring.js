const rulesConfig = require('../conf/rules');

const COMPLIANCE_SCORE = { A: 1.0, B: 0.6, C: 0.0 };

const GRADE_THRESHOLDS = [
    { min: 90, grade: 'A' },
    { min: 75, grade: 'B' },
    { min: 60, grade: 'C' },
    { min: 45, grade: 'D' },
    { min: 30, grade: 'E' },
    { min: 15, grade: 'F' },
    { min: 0,  grade: 'G' },
];

function scoreToGrade(score) {
    return (GRADE_THRESHOLDS.find((t) => score >= t.min) || { grade: 'G' }).grade;
}

function computeScore(bestPractices) {
    const byCategory = {};
    let globalWeightedSum = 0;
    let globalTotalWeight = 0;

    for (const [id, rule] of Object.entries(bestPractices || {})) {
        const config = rulesConfig.find((r) => r.bestPractice === id);
        if (!config) continue;
        const impact = config.impact;
        const scoreValue = COMPLIANCE_SCORE[rule.complianceLevel] || 0;
        const category = config.wsgCategory || 'NR';

        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push({ complianceLevel: rule.complianceLevel, impact });

        globalWeightedSum += scoreValue * impact;
        globalTotalWeight += impact;
    }

    const globalScore = globalTotalWeight > 0
        ? Math.round((globalWeightedSum / globalTotalWeight) * 100)
        : 0;

    const categoryScores = {};
    for (const [cat, entries] of Object.entries(byCategory)) {
        let wSum = 0;
        let wTotal = 0;
        for (const { complianceLevel, impact } of entries) {
            wSum += (COMPLIANCE_SCORE[complianceLevel] || 0) * impact;
            wTotal += impact;
        }
        const catScore = wTotal > 0 ? Math.round((wSum / wTotal) * 100) : 0;
        categoryScores[cat] = { score: catScore, grade: scoreToGrade(catScore), count: entries.length };
    }

    return {
        score: globalScore,
        grade: scoreToGrade(globalScore),
        byCategory: categoryScores,
    };
}

module.exports = { computeScore, scoreToGrade };
