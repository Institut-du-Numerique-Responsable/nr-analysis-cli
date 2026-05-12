const { co2, hosting } = require('@tgwf/co2');

const co2Calculator = new co2({ model: 'swd', version: 4 });

const CO2_THRESHOLDS = { A: 0.3, B: 0.8 };

// SWD energy intensity (kWh/GB) and global WUE (L/kWh) for the digital chain.
// Source: Sustainable Web Design / The Green Web Foundation + UNESCO WUE averages.
const ENERGY_INTENSITY_KWH_PER_GB = 0.81;
const WATER_LITRES_PER_KWH = 1.8;

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

    const kWhPerVisit = (bytes / 1e9) * ENERGY_INTENSITY_KWH_PER_GB;
    const waterLPerVisit = kWhPerVisit * WATER_LITRES_PER_KWH;

    const co2Kg1M = Math.round((grams * 1e6) / 1000 * 10) / 10;
    const waterL1M = Math.round(waterLPerVisit * 1e6);
    const energyKwh1M = Math.round(kWhPerVisit * 1e6);

    const waterClPerVisit = Math.round(waterLPerVisit * 100 * 1000) / 1000; // cL with 3 decimals
    const energyWhPerVisit = Math.round(kWhPerVisit * 1000 * 1000) / 1000;  // Wh with 3 decimals

    return {
        value: rounded,
        waterPerVisit: Math.round(waterLPerVisit * 1e6) / 1e6,
        waterClPerVisit,
        energyWhPerVisit,
        co2Per1M: co2Kg1M,
        waterPer1M: waterL1M,
        energyPer1M: energyKwh1M,
        result: {
            complianceLevel,
            comment: String(rounded),
            detailComment: '',
        },
    };
}

module.exports = { checkGreenHosting, computeCo2 };
