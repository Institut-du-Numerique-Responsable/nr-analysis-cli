const { co2, hosting } = require('@tgwf/co2');
const {
    computeEcoIndex,
    getEcoIndexGrade,
    computeGreenhouseGasesEmissionfromEcoIndex,
    computeWaterConsumptionfromEcoIndex,
} = require('../nr-core/ecoIndex');

// SWDM v4 with per-segment breakdown (operational + embodied per device/network/datacenter).
// Ref: https://sustainablewebdesign.org/estimating-digital-emissions/
const co2Calculator = new co2({ model: 'swd', version: 4, results: 'segment' });

const CO2_THRESHOLDS = { A: 0.3, B: 0.8 };

// SWD energy intensity (kWh/GB) and global WUE (L/kWh) for the digital chain.
const ENERGY_INTENSITY_KWH_PER_GB = 0.81;
const WATER_LITRES_PER_KWH = 1.8;

// Single-load audit = uncached first visit. We disable cache + SW in Puppeteer,
// so applying SWDM v4 default cache discount (25%) would understate what the page
// actually transfers. Pass firstVisit-only and let templates expose the cache-weighted
// long-term figure separately if needed.
const DEFAULT_TRACE_OPTS = {
    dataReloadRatio: 0,
    firstVisitPercentage: 1,
    returnVisitPercentage: 0,
};

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

// SWD/tgwf-based metrics with per-segment breakdown.
// Accepts distinct ISO 3166-1 alpha-3 codes per segment:
//   - deviceCountry  : terminal (visitor) location
//   - dcCountry      : datacenter / origin server location
//   - networkCountry : average network mix (defaults to device country)
function computeCo2(responsesSizeBytes, isGreen = false, options = {}) {
    const bytes = responsesSizeBytes || 0;
    const deviceCountry = (options.deviceCountry || options.country || 'FRA').toUpperCase();
    const dcCountry = (options.dcCountry || deviceCountry).toUpperCase();
    const networkCountry = (options.networkCountry || deviceCountry).toUpperCase();
    const gridIntensity = {
        device: { country: deviceCountry },
        dataCenter: { country: dcCountry },
        network: { country: networkCountry },
    };
    const traceOpts = { ...DEFAULT_TRACE_OPTS, gridIntensity };
    const trace = co2Calculator.perVisitTrace(bytes, isGreen, traceOpts);
    // Cache-weighted long-term estimate (SWDM v4 reference assumptions).
    const cacheWeightedTrace = co2Calculator.perVisitTrace(bytes, isGreen, {
        dataReloadRatio: 0.02,
        firstVisitPercentage: 0.75,
        returnVisitPercentage: 0.25,
        gridIntensity,
    });
    const totalGrams = trace.co2.total;
    const firstVisitGrams = trace.co2.firstVisitCO2e;
    const cacheWeightedGrams = cacheWeightedTrace.co2.total;
    const rounded = Math.round(totalGrams * 100) / 100;
    let complianceLevel = 'C';
    if (rounded <= CO2_THRESHOLDS.A) complianceLevel = 'A';
    else if (rounded <= CO2_THRESHOLDS.B) complianceLevel = 'B';

    const kWhPerVisit = (bytes / 1e9) * ENERGY_INTENSITY_KWH_PER_GB;
    const waterLPerVisit = kWhPerVisit * WATER_LITRES_PER_KWH;

    const co2Kg1M = Math.round((totalGrams * 1e6) / 1000 * 10) / 10;
    const waterL1M = Math.round(waterLPerVisit * 1e6);
    const energyKwh1M = Math.round(kWhPerVisit * 1e6);

    const waterClPerVisit = Math.round(waterLPerVisit * 100 * 1000) / 1000;
    const energyWhPerVisit = Math.round(kWhPerVisit * 1000 * 1000) / 1000;

    const r3 = (x) => Math.round(x * 1000) / 1000;
    const breakdown = {
        operational: {
            device: r3(trace.co2.consumerDeviceOperationalCO2e),
            network: r3(trace.co2.networkOperationalCO2e),
            dataCenter: r3(trace.co2.dataCenterOperationalCO2e),
        },
        embodied: {
            device: r3(trace.co2.consumerDeviceEmbodiedCO2e),
            network: r3(trace.co2.networkEmbodiedCO2e),
            dataCenter: r3(trace.co2.dataCenterEmbodiedCO2e),
        },
        firstVisit: r3(firstVisitGrams),
        returnVisit: r3(trace.co2.returnVisitCO2e),
    };

    return {
        value: rounded,
        firstVisitGrams: r3(firstVisitGrams),
        cacheWeightedGrams: r3(cacheWeightedGrams),
        transferredKb: Math.round(bytes / 1000),
        // Kept for backward compat (= deviceCountry).
        country: deviceCountry,
        deviceCountry,
        dcCountry,
        networkCountry,
        gridIntensity: trace.variables.gridIntensity.device.value,
        gridIntensityDevice: trace.variables.gridIntensity.device.value,
        gridIntensityDc: trace.variables.gridIntensity.dataCenter.value,
        gridIntensityNetwork: trace.variables.gridIntensity.network.value,
        greenHosting: trace.green,
        breakdown,
        waterPerVisit: Math.round(waterLPerVisit * 1e6) / 1e6,
        waterClPerVisit,
        energyWhPerVisit,
        co2Per1M: co2Kg1M,
        waterPer1M: waterL1M,
        energyPer1M: energyKwh1M,
        model: { name: 'swd', version: 4 },
        result: {
            complianceLevel,
            comment: String(rounded),
            detailComment: '',
        },
    };
}

// EcoIndex-based metrics (ecoindex.fr — DOM × 3, requests × 2, size × 1).
function computeEcoIndexImpact(domSize, nbRequest, responsesSizeBytes) {
    const dom = domSize || 0;
    const req = nbRequest || 0;
    const sizeKb = (responsesSizeBytes || 0) / 1000;
    const score = computeEcoIndex(dom, req, sizeKb);
    const grade = getEcoIndexGrade(score);
    const co2G = computeGreenhouseGasesEmissionfromEcoIndex(score);
    const waterCl = computeWaterConsumptionfromEcoIndex(score);
    const co2Per1MKg = Math.round((co2G * 1e6) / 1000 * 10) / 10;
    const waterPer1ML = Math.round((waterCl * 1e6) / 100);
    return {
        ecoIndex: score,
        ecoIndexGrade: grade,
        co2PerVisit: co2G,
        waterClPerVisit: waterCl,
        co2Per1M: co2Per1MKg,
        waterPer1M: waterPer1ML,
    };
}

module.exports = { checkGreenHosting, computeCo2, computeEcoIndexImpact };
