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
        };
        let index = table.findIndex((item) => (obj.sustainabilityScore || 0) > item.score);
        if (index === -1) index = table.length;
        table.splice(index, 0, entry);
        if (table.length > number) table.pop();
        return table;
    };
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

    const date = new Date();
    const globalSheet_data = {
        date: `${date.toLocaleDateString(LANGUAGE)} ${date.toLocaleTimeString(LANGUAGE)}`,
        hostname,
        device: DEVICE,
        connection: translator.translate(options.mobile ? 'mobile' : 'wired'),
        grade: scoreToGrade(averageScore),
        sustainabilityScore: averageScore,
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
