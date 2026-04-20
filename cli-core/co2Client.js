const { co2, hosting } = require('@tgwf/co2');

const co2Calculator = new co2({ model: 'swd', version: 4 });

const CO2_THRESHOLDS = { A: 0.3, B: 0.8 };

async function checkGreenHosting(domain) {
    try {
        const isGreen = await hosting.check(domain, 'nr-analysis-cli');
        return {
            complianceLevel: isGreen ? 'A' : 'C',
            comment: isGreen ? domain : '',
            detailComment: isGreen ? '' : domain,
        };
    } catch (_err) {
        return { complianceLevel: 'B', comment: '', detailComment: '' };
    }
}

function computeCo2(responsesSizeBytes, isGreen = false) {
    const bytes = responsesSizeBytes || 0;
    const grams = co2Calculator.perVisit(bytes, isGreen);
    const rounded = Math.round(grams * 100) / 100;
    let complianceLevel = 'C';
    if (rounded <= CO2_THRESHOLDS.A) complianceLevel = 'A';
    else if (rounded <= CO2_THRESHOLDS.B) complianceLevel = 'B';
    return {
        value: rounded,
        result: {
            complianceLevel,
            comment: String(rounded),
            detailComment: '',
        },
    };
}

module.exports = { checkGreenHosting, computeCo2 };
