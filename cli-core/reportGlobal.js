const fs = require('fs');
const path = require('path');
const { createProgressBar, scoreToGrade } = require('./utils');

const SUBRESULTS_DIRECTORY = path.join(__dirname, '../results');

// Converts a compliance letter grade to a numeric weight for worst-rule sorting.
function gradeToWeight(grade) {
    if (grade == 'A') return 75;
    if (grade == 'B') return 65;
    if (grade == 'C') return 50;
    if (grade == 'D') return 35;
    if (grade == 'E') return 20;
    if (grade == 'F') return 5;
    return 0;
}

// Insert-sort `obj` into `table`, descending by sustainabilityScore, capped at `number` entries.
function worstPagesHandler(number) {
    return (obj, table) => {
        const entry = {
            nb: obj.nb,
            url: obj.pageInformations.url,
            grade: obj.sustainabilityGrade || 'G',
            score: obj.sustainabilityScore || 0,
            socialScore: obj.socialScore || 0,
            socialGrade: obj.socialGrade || 'G',
        };
        let index = table.findIndex((item) => (obj.sustainabilityScore || 0) > item.score);
        if (index === -1) index = table.length;
        table.splice(index, 0, entry);
        if (table.length > number) table.pop();
        return table;
    };
}

function rankBy(allData, fieldScore, fieldGrade, number, ascending) {
    const entries = allData
        .filter(({ obj }) => obj.success)
        .map(({ file, obj }) => ({
            nb: parseInt(file.name),
            url: obj.pageInformations.url,
            score: obj[fieldScore] || 0,
            grade: obj[fieldGrade] || 'G',
        }));
    entries.sort((a, b) => (ascending ? a.score - b.score : b.score - a.score));
    return entries.slice(0, number);
}

// Return the names of the `number` least-followed best practices, lowest grade total first.
function handleWorstRule(bestPracticesTotal, number) {
    return Object.entries(bestPracticesTotal)
        .sort((a, b) => a[1] - b[1])
        .slice(0, number)
        .map(([name]) => name);
}

async function create_global_report(reports, options, translator) {
    const TIMEOUT = options.timeout || 'No data';
    const MAX_TAB = options.max_tab || 'No data';
    const RETRY = options.retry || 'No data';
    const WORST_PAGES = options.worst_pages;
    const WORST_RULES = options.worst_rules;
    const DEVICE = options.device;
    const LANGUAGE = options.language;

    const handleWorstPages = worstPagesHandler(WORST_PAGES);
    const progressBar = createProgressBar(
        options,
        reports.length + 2,
        'Create Global report',
        'Creating global report ...'
    );

    let scoreSum = 0; // running sum, turned into an average below
    let socialScoreSum = 0;
    let securityScoreSum = 0;
    let serverScoreSum = 0;
    let co2Per1MSum = 0;
    let waterPer1MSum = 0;
    let energyPer1MSum = 0;
    let co2PerVisitSum = 0;
    let waterClPerVisitSum = 0;
    let energyWhPerVisitSum = 0;
    const err = [];
    const worstPages = [];
    const bestPracticesTotal = {};
    let hostname;
    let nbBestPracticesToCorrect = 0;

    // Read every sub-report file in parallel
    const allData = await Promise.all(
        reports.map(async (file) => {
            const content = await fs.promises.readFile(file.path, 'utf-8');
            return { file, obj: JSON.parse(content) };
        })
    );

    allData.forEach(({ file, obj }) => {
        if (!hostname) hostname = obj.pageInformations.url.split('/')[2];
        obj.nb = parseInt(file.name);

        if (obj.success) {
            scoreSum += obj.sustainabilityScore || 0;
            socialScoreSum += obj.socialScore || 0;
            securityScoreSum += obj.securityScore || 0;
            serverScoreSum += obj.serverScore || 0;
            co2Per1MSum += obj.co2Per1M || 0;
            waterPer1MSum += obj.waterPer1M || 0;
            energyPer1MSum += obj.energyPer1M || 0;
            const lastPg = obj.pages && obj.pages[obj.pages.length - 1];
            const lastAct = lastPg && lastPg.actions && lastPg.actions[lastPg.actions.length - 1];
            co2PerVisitSum += (lastAct && lastAct.co2PerVisit) || 0;
            waterClPerVisitSum += (lastAct && lastAct.waterClPerVisit) || 0;
            energyWhPerVisitSum += (lastAct && lastAct.energyWhPerVisit) || 0;
            nbBestPracticesToCorrect += obj.nbBestPracticesToCorrect;
            handleWorstPages(obj, worstPages);
            obj.pages.forEach((page) => {
                if (!page.bestPractices) return;
                for (const key in page.bestPractices) {
                    bestPracticesTotal[key] = bestPracticesTotal[key] || 0;
                    bestPracticesTotal[key] += gradeToWeight(page.bestPractices[key].complianceLevel || 'A');
                }
            });
        } else {
            err.push({
                nb: obj.nb,
                url: obj.pageInformations.url,
                grade: obj.sustainabilityGrade || 'G',
                score: obj.sustainabilityScore || 0,
            });
        }
        if (progressBar) progressBar.tick();
    });

    const nbSuccessful = reports.length - err.length;
    const averageScore = nbSuccessful > 0 ? Math.round(scoreSum / nbSuccessful) : 0;
    const averageSocialScore = nbSuccessful > 0 ? Math.round(socialScoreSum / nbSuccessful) : 0;
    const averageSecurityScore = nbSuccessful > 0 ? Math.round(securityScoreSum / nbSuccessful) : 0;
    const averageServerScore = nbSuccessful > 0 ? Math.round(serverScoreSum / nbSuccessful) : 0;
    const avgCo2Per1M = nbSuccessful > 0 ? Math.round((co2Per1MSum / nbSuccessful) * 10) / 10 : 0;
    const avgWaterPer1M = nbSuccessful > 0 ? Math.round(waterPer1MSum / nbSuccessful) : 0;
    const avgEnergyPer1M = nbSuccessful > 0 ? Math.round(energyPer1MSum / nbSuccessful) : 0;
    const avgCo2PerVisit = nbSuccessful > 0 ? Math.round((co2PerVisitSum / nbSuccessful) * 100) / 100 : 0;
    const avgWaterClPerVisit = nbSuccessful > 0 ? Math.round((waterClPerVisitSum / nbSuccessful) * 100) / 100 : 0;
    const avgEnergyWhPerVisit = nbSuccessful > 0 ? Math.round((energyWhPerVisitSum / nbSuccessful) * 100) / 100 : 0;

    const date = new Date();
    const globalSheet_data = {
        date: `${date.toLocaleDateString(LANGUAGE)} ${date.toLocaleTimeString(LANGUAGE)}`,
        hostname,
        device: DEVICE,
        connection: translator.translate(options.mobile ? 'mobile' : 'wired'),
        grade: scoreToGrade(averageScore),
        sustainabilityScore: averageScore,
        socialScore: averageSocialScore,
        socialGrade: scoreToGrade(averageSocialScore),
        securityScore: averageSecurityScore,
        securityGrade: scoreToGrade(averageSecurityScore),
        serverScore: averageServerScore,
        serverGrade: scoreToGrade(averageServerScore),
        co2Per1M: avgCo2Per1M,
        waterPer1M: avgWaterPer1M,
        energyPer1M: avgEnergyPer1M,
        co2PerVisit: avgCo2PerVisit,
        waterClPerVisit: avgWaterClPerVisit,
        energyWhPerVisit: avgEnergyWhPerVisit,
        bestEnvPages: rankBy(allData, 'sustainabilityScore', 'sustainabilityGrade', WORST_PAGES, false),
        worstEnvPages: rankBy(allData, 'sustainabilityScore', 'sustainabilityGrade', WORST_PAGES, true),
        bestSocialPages: rankBy(allData, 'socialScore', 'socialGrade', WORST_PAGES, false),
        worstSocialPages: rankBy(allData, 'socialScore', 'socialGrade', WORST_PAGES, true),
        nbScenarios: reports.length,
        timeout: parseInt(TIMEOUT),
        maxTab: parseInt(MAX_TAB),
        retry: parseInt(RETRY),
        errors: err,
        worstPages,
        worstRules: handleWorstRule(bestPracticesTotal, WORST_RULES),
        nbBestPracticesToCorrect,
    };

    if (progressBar) progressBar.tick();

    const filePath = path.join(SUBRESULTS_DIRECTORY, 'globalReport.json');
    try {
        fs.writeFileSync(filePath, JSON.stringify(globalSheet_data));
    } catch (error) {
        throw ` Global report : Path "${filePath}" cannot be reached.`;
    }
    return {
        globalReport: {
            name: 'Global Report',
            path: filePath,
        },
        reports,
    };
}


module.exports = {
    create_global_report,
};
