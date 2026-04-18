const fs = require('fs');
const path = require('path');
const { getEcoIndexGrade, getGradeEcoIndex, createProgressBar } = require('./utils');

const SUBRESULTS_DIRECTORY = path.join(__dirname, '../results');

// Insert-sort `obj` into `table`, ascending by ecoIndex, capped at `number` entries.
function worstPagesHandler(number) {
    return (obj, table) => {
        const entry = {
            nb: obj.nb,
            url: obj.pageInformations.url,
            grade: obj.grade,
            ecoIndex: obj.ecoIndex,
        };
        let index = table.findIndex((item) => obj.ecoIndex < item.ecoIndex);
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

    let eco = 0; // running sum, turned into an average below
    const worstEcoIndexes = [null, null];
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
            eco += obj.ecoIndex;
            const pageWorstEcoIndexes = getWorstEcoIndexes(obj);
            [0, 1].forEach((i) => {
                if (!worstEcoIndexes[i] || worstEcoIndexes[i].ecoIndex > pageWorstEcoIndexes[i].ecoIndex) {
                    worstEcoIndexes[i] = { ...pageWorstEcoIndexes[i] };
                }
            });

            nbBestPracticesToCorrect += obj.nbBestPracticesToCorrect;
            handleWorstPages(obj, worstPages);
            obj.pages.forEach((page) => {
                if (!page.bestPractices) return;
                for (const key in page.bestPractices) {
                    bestPracticesTotal[key] = bestPracticesTotal[key] || 0;
                    bestPracticesTotal[key] += getGradeEcoIndex(page.bestPractices[key].complianceLevel || 'A');
                }
            });
        } else {
            err.push({
                nb: obj.nb,
                url: obj.pageInformations.url,
                grade: obj.grade,
                ecoIndex: obj.ecoIndex,
            });
        }
        if (progressBar) progressBar.tick();
    });

    const nbSuccessful = reports.length - err.length;
    const averageEco = nbSuccessful > 0 ? Math.round(eco / nbSuccessful) : 'No data';

    const date = new Date();
    const globalSheet_data = {
        date: `${date.toLocaleDateString(LANGUAGE)} ${date.toLocaleTimeString(LANGUAGE)}`,
        hostname,
        device: DEVICE,
        connection: translator.translate(options.mobile ? 'mobile' : 'wired'),
        grade: getEcoIndexGrade(averageEco),
        ecoIndex: averageEco,
        worstEcoIndexes,
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

// Returns [worstFirstAction, worstLastAction]. When a page has a single action, both slots use it.
function getWorstEcoIndexes(obj) {
    let worstFirst = null;
    let worstLast = null;

    obj.pages.forEach((page) => {
        const firstEco = page.actions[0].ecoIndex;
        worstFirst = getWorstEcoIndex(firstEco, worstFirst);

        if (page.actions.length === 1) {
            worstLast = getWorstEcoIndex(firstEco, worstLast);
        } else {
            const lastEco = page.actions[page.actions.length - 1].ecoIndex;
            if (lastEco) worstLast = getWorstEcoIndex(lastEco, worstLast);
        }
    });

    return [worstFirst, worstLast].map((ecoIndex) => ({
        ecoIndex,
        grade: getEcoIndexGrade(ecoIndex),
    }));
}

function getWorstEcoIndex(current, worst) {
    return !worst || worst > current ? current : worst;
}

module.exports = {
    create_global_report,
};
