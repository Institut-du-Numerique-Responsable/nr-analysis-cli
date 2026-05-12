const fs = require('fs');
const path = require('path');
const Mustache = require('mustache');
const rules = require('../conf/rules');
const utils = require('./utils');
const { getSeverity } = require('./serverAudit');
const { describe } = require('./checkDescriptions');

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
};

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function formatNumber(n) {
    return new Intl.NumberFormat('fr-FR').format(n);
}

const SEVERITY_LABELS = {
    critical: 'Critique',
    important: 'Important',
    recommended: 'Recommandé',
    info: 'Informatif',
};

// CSS class for each best-practice compliance level
const cssBestPractices = {
    A: 'checkmark-success',
    B: 'close-warning',
    C: 'close-error',
};
const bestPracticesKey = rules.map((r) => r.bestPractice);

//create html report for all the analysed pages and recap on the first sheet
async function create_html_report(reportObject, options, translator, grafanaLinkPresent) {
    const OUTPUT_FILE = path.resolve(options.report_output_file);
    const fileList = reportObject.reports;
    const globalReport = reportObject.globalReport;

    // initialise progress bar
    const progressBar = utils.createProgressBar(
        options,
        fileList.length + 2,
        'Create HTML report',
        'Creating HTML report ...'
    );

    // Read all reports
    const { allReportsVariables, co2Total } = readAllReports(
        fileList,
        options.grafana_link,
        translator,
        options.reportPrefix
    );

    // Read global report
    const globalReportVariables = readGlobalReport(
        globalReport.path,
        allReportsVariables,
        co2Total,
        grafanaLinkPresent,
        translator,
        options.reportPrefix
    );

    // write global report
    writeGlobalReport(globalReportVariables, OUTPUT_FILE, progressBar, translator);

    // write all reports
    const outputFolder = path.dirname(OUTPUT_FILE);
    writeAllReports(allReportsVariables, outputFolder, progressBar, translator);
}

/**
 * Use all reports to generate global and detail data
 * @param {*} fileList
 * @returns
 */
function readAllReports(fileList, grafanaLink, translator, reportPrefix) {
    // init variables
    const allReportsVariables = [];
    let co2Total = 0;

    // Read all json files
    fileList.forEach((file) => {
        let reportVariables = {};
        const report_data = JSON.parse(fs.readFileSync(file.path).toString());

        const hostname = report_data.pageInformations.url.split('/')[2];
        const scenarioName = report_data.pageInformations.name || report_data.pageInformations.url;
        const scenarioNameHtml = escapeHtml(scenarioName);
        const prefix = reportPrefix ? `${reportPrefix}_` : '';
        const pageFilename = report_data.pageInformations.name
            ? `${prefix}${removeForbiddenCharacters(report_data.pageInformations.name)}.html`
            : `${prefix}${report_data.index}.html`;

        if (report_data.success) {
            let pages = [];
            let nbRequestTotal = 0;
            let responsesSizeTotal = 0;
            let responsesSizeUncompressTotal = 0;
            let domSizeTotal = 0;
            let id = 0;

            // Loop over each page (i.e scenario)
            report_data.pages.forEach((page) => {
                const actions = [];
                const analyzePage = {};

                analyzePage.name = page.name;
                analyzePage.url = page.url;

                analyzePage.id = id;
                id += 1;

                // Loop on each recorded action
                page.actions.forEach((action) => {
                    const res = {};
                    res.name = action.name;
                    res.sustainabilityScore = action.sustainabilityScore || 0;
                    res.sustainabilityGrade = action.sustainabilityGrade || 'G';
                    res.socialScore = action.socialScore || 0;
                    res.socialGrade = action.socialGrade || 'G';
                    res.co2PerVisit = action.co2PerVisit || 0;
                    res.co2Per1M = action.co2Per1M || 0;
                    res.waterPer1M = action.waterPer1M || 0;
                    res.energyPer1M = action.energyPer1M || 0;
                    res.nbRequest = action.nbRequest;
                    res.domSize = action.domSize;
                    res.responsesSize = action.responsesSize / 1000;
                    res.responsesSizeUncompress = action.responsesSizeUncompress;
                    actions.push(res);
                });

                analyzePage.actions = actions;

                const lastAction = actions[actions.length - 1];
                analyzePage.lastScore = lastAction.sustainabilityScore || 0;
                analyzePage.lastGrade = lastAction.sustainabilityGrade || 'G';
                analyzePage.deltaScore = (actions[0].sustainabilityScore || 0) - (lastAction.sustainabilityScore || 0);
                analyzePage.co2PerVisit = lastAction.co2PerVisit || 0;
                analyzePage.co2Per1M = lastAction.co2Per1M || 0;
                analyzePage.waterPer1M = lastAction.waterPer1M || 0;
                analyzePage.energyPer1M = lastAction.energyPer1M || 0;
                analyzePage.socialScore = lastAction.socialScore || 0;
                analyzePage.socialGrade = lastAction.socialGrade || 'G';
                analyzePage.domSize = lastAction.domSize;
                analyzePage.nbRequest = lastAction.nbRequest;
                analyzePage.sustainabilityScore = lastAction.sustainabilityScore || 0;
                analyzePage.grade = lastAction.sustainabilityGrade || 'G';

                // update total page measure
                nbRequestTotal += lastAction.nbRequest;
                responsesSizeTotal += lastAction.responsesSize;
                domSizeTotal += lastAction.domSize;
                responsesSizeUncompressTotal += lastAction.responsesSizeUncompress;

                const pageBestPractices = extractBestPractices(translator);

                // Manage best practices
                let nbBestPracticesToCorrect = 0;
                pageBestPractices.forEach((bp) => {
                    if (!page.bestPractices) {
                        bp.note = 'A';
                        bp.comment = '';
                        return;
                    }
                    const pageBp = page.bestPractices[bp.key];
                    const note = cssBestPractices[pageBp.complianceLevel || 'A'];
                    bp.note = note;
                    bp.comment = pageBp.comment || '';
                    bp.errors = pageBp.detailComment;

                    if (note !== 'checkmark-success') {
                        nbBestPracticesToCorrect += 1;
                    }
                });

                co2Total += analyzePage.co2PerVisit || 0;
                analyzePage.a11ySummary = page.a11ySummary || { pass: 0, warn: 0, fail: 0, total: 0 };
                analyzePage.a11yIssues = (page.a11yIssues || []).map((iss) => ({
                    id: iss.id,
                    description: describe(iss.id),
                    examples: (iss.examples || []).map(escapeHtml),
                }));
                analyzePage.bestPractices = pageBestPractices;
                analyzePage.nbBestPracticesToCorrect = nbBestPracticesToCorrect;
                analyzePage.nbBestPracticesToCorrectLabel = translator.translateWithArgs(
                    'bestPracticesToImplementWithNumber',
                    nbBestPracticesToCorrect
                );
                analyzePage.grafanaLink = `${grafanaLink}&var-scenarioName=${scenarioName}&var-actionName=${analyzePage.name}`;
                pages.push(analyzePage);
            });

            // Manage state of global best practices, for each page of the scenario
            const bestPractices = manageScenarioBestPratices(pages, translator);

            const lastPage = report_data.pages[report_data.pages.length - 1] || {};
            const buildCheck = ([id, r]) => ({
                id,
                comment: r.comment,
                note: cssBestPractices[r.complianceLevel] || 'checkmark-success',
                severity: getSeverity(id),
                severityLabel: SEVERITY_LABELS[getSeverity(id)] || getSeverity(id),
                description: describe(id),
            });
            const securityChecks = report_data.security ? Object.entries(report_data.security).map(buildCheck) : [];
            const serverChecks = report_data.server ? Object.entries(report_data.server).map(buildCheck) : [];
            const severityOrder = { critical: 0, important: 1, recommended: 2, info: 3 };
            securityChecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
            serverChecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
            reportVariables = {
                date: report_data.date,
                success: report_data.success,
                cssRowError: '',
                name: scenarioName,
                url: report_data.pageInformations.url,
                link: `<a href="${escapeHtml(pageFilename)}">${scenarioNameHtml}</a>`,
                filename: pageFilename,
                header: `${escapeHtml(translator.translate('nrAnalysisReport'))} > <a class="text-white" href="${escapeHtml(report_data.pageInformations.url)}">${scenarioNameHtml}</a>`,
                bigScore: `${report_data.sustainabilityScore} <span class="grade big-grade ${report_data.sustainabilityGrade || 'G'}">${report_data.sustainabilityGrade || 'G'}</span>`,
                smallScore: `${report_data.sustainabilityScore} <span class="grade ${report_data.sustainabilityGrade || 'G'}">${report_data.sustainabilityGrade || 'G'}</span>`,
                grade: report_data.sustainabilityGrade || 'G',
                sustainabilityScore: report_data.sustainabilityScore || 0,
                socialScore: report_data.socialScore || 0,
                socialGrade: report_data.socialGrade || 'G',
                securityScore: report_data.securityScore || 0,
                securityGrade: report_data.securityGrade || 'G',
                securitySummary: report_data.securitySummary || { pass: 0, warn: 0, fail: 0, total: 0 },
                securityChecks,
                serverScore: report_data.serverScore || 0,
                serverGrade: report_data.serverGrade || 'G',
                serverSummary: report_data.serverSummary || { pass: 0, warn: 0, fail: 0, total: 0 },
                serverChecks,
                co2PerVisit: lastPage.co2PerVisit || 0,
                waterClPerVisit: report_data.waterClPerVisit || 0,
                energyWhPerVisit: report_data.energyWhPerVisit || 0,
                co2Per1M: report_data.co2Per1M || 0,
                waterPer1M: formatNumber(report_data.waterPer1M || 0),
                energyPer1M: formatNumber(report_data.energyPer1M || 0),
                a11ySummary: lastPage.a11ySummary || { pass: 0, warn: 0, fail: 0, total: 0 },
                a11yIssues: pages.length ? pages[pages.length - 1].a11yIssues : [],
                nbRequest: nbRequestTotal,
                responsesSize: Math.round(responsesSizeTotal * 1000) / 1000,
                pageSize: `${Math.round(responsesSizeTotal)} (${Math.round(responsesSizeUncompressTotal / 1000)})`,
                domSize: domSizeTotal,
                pages,
                bestPractices,
            };
        } else {
            reportVariables = {
                date: report_data.date,
                name: scenarioName,
                filename: pageFilename,
                success: false,
                header: `${escapeHtml(translator.translate('nrAnalysisReport'))} > <a class="text-white" href="${escapeHtml(report_data.pageInformations.url)}">${scenarioNameHtml}</a>`,
                cssRowError: 'bg-danger',
                nbRequest: 0,
                pages: [],
                link: `<a href="${escapeHtml(pageFilename)}">${scenarioNameHtml}</a>`,
                bestPractices: [],
            };
        }
        allReportsVariables.push(reportVariables);
    });

    return { allReportsVariables, co2Total };
}

/**
 * Read and generate data for global template
 * @param {*} path
 * @param {*} allReportsVariables
 * @param {*} co2Total
 * @param {*} grafanaLinkPresent
 * @returns
 */
function readGlobalReport(path, allReportsVariables, co2Total, grafanaLinkPresent, translator, reportPrefix) {
    const globalReport_data = JSON.parse(fs.readFileSync(path).toString());
    const filenameByNb = new Map();
    allReportsVariables.forEach((v, idx) => {
        // index in JSON files is 1-based (resultId starts at 1)
        filenameByNb.set(idx + 1, v.filename);
    });
    const enrichRanking = (arr) => (arr || []).map((p) => ({ ...p, detailFile: filenameByNb.get(p.nb) || '' }));

    let worstScores = '';
    (globalReport_data.worstPages || []).forEach((worstPage) => {
        const separator = worstScores === '' ? '' : '/';
        worstScores = `${worstScores} ${separator} ${worstPage.score} <span class="grade big-grade ${worstPage.grade}">${worstPage.grade}</span>`;
    });

    const globalReportVariables = {
        date: globalReport_data.date,
        hostname: globalReport_data.hostname,
        device: globalReport_data.device,
        connection: globalReport_data.connection,
        sustainabilityScore: worstScores,
        avgEnvScore: globalReport_data.sustainabilityScore || 0,
        avgEnvGrade: globalReport_data.grade || 'G',
        avgSocialScore: globalReport_data.socialScore || 0,
        avgSocialGrade: globalReport_data.socialGrade || 'G',
        avgSecurityScore: globalReport_data.securityScore || 0,
        avgSecurityGrade: globalReport_data.securityGrade || 'G',
        avgServerScore: globalReport_data.serverScore || 0,
        avgServerGrade: globalReport_data.serverGrade || 'G',
        bestEnvPages: enrichRanking(globalReport_data.bestEnvPages),
        worstEnvPages: enrichRanking(globalReport_data.worstEnvPages),
        bestSocialPages: enrichRanking(globalReport_data.bestSocialPages),
        worstSocialPages: enrichRanking(globalReport_data.worstSocialPages),
        co2Per1M: globalReport_data.co2Per1M || 0,
        waterPer1M: formatNumber(globalReport_data.waterPer1M || 0),
        energyPer1M: formatNumber(globalReport_data.energyPer1M || 0),
        co2PerVisit: globalReport_data.co2PerVisit || 0,
        waterClPerVisit: globalReport_data.waterClPerVisit || 0,
        energyWhPerVisit: globalReport_data.energyWhPerVisit || 0,
        grade: globalReport_data.grade,
        nbScenarios: globalReport_data.nbScenarios,
        co2Total: Math.round(co2Total * 100) / 100,
        nbErrors: globalReport_data.errors.length,
        allReportsVariables,
        bestsPractices: constructBestPracticesGlobal(allReportsVariables, translator),
        grafanaLinkPresent,
    };
    return globalReportVariables;
}

function constructBestPracticesGlobal(allReportsVariables, translator) {
    const bestPracticesGlobal = [];
    const bestPractices = extractBestPractices(translator);

    bestPractices.forEach((bestPractice) => {
        let note = 'checkmark-success';
        let errors = [];
        let success = true;

        allReportsVariables.forEach((scenario) => {
            if (!scenario.pages) return;
            scenario.pages.forEach((page) => {
                const best = page.bestPractices.find((bp) => bp.key === bestPractice.key);
                if (success && best.note === 'close-error') {
                    success = false;
                    note = 'close-error';
                }
            });
        });

        const bestPracticeGlobal = {
            id: bestPractice.id,
            description: bestPractice.description,
            name: bestPractice.name,
            comment: bestPractice.comment,
            note: note,
            errors: errors,
            priority: bestPractice.priority,
            impact: bestPractice.impact,
            effort: bestPractice.effort,
        };

        bestPracticesGlobal.push(bestPracticeGlobal);
    });
    return bestPracticesGlobal;
}

const _bpCache = new Map();

function extractBestPractices(translator) {
    const catalog = translator.getCatalog();
    if (!_bpCache.has(catalog)) {
        const templates = bestPracticesKey.map((bestPracticeName, index) => {
            const rule = rules.find((p) => p.bestPractice === bestPracticeName);
            return {
                key: bestPracticeName,
                id: `collapse${index}`,
                name: translator.translateRule(bestPracticeName),
                description: translator.translateRule(`${bestPracticeName}_DetailDescription`),
                priority: rule.priority,
                impact: rule.impact,
                effort: rule.effort,
            };
        });
        _bpCache.set(catalog, templates);
    }
    return _bpCache.get(catalog).map((bp) => ({ ...bp, notes: [], pages: [], comments: [] }));
}

/**
 * Aggregate best-practice results across all pages of a scenario.
 */
function manageScenarioBestPratices(pages, translator) {
    // extractBestPractices() returns fresh objects with `pages`, `notes` and `comments` pre-initialised
    const bestPractices = extractBestPractices(translator);
    pages.forEach((page) => {
        bestPractices.forEach((bp) => {
            bp.pages.push(page.name);
            if (page.bestPractices) {
                const currentBestPractice = page.bestPractices.find((element) => element.key === bp.key);
                bp.notes.push(currentBestPractice.note || 'A');
                bp.comments.push(currentBestPractice.comment || '');
            }
        });
    });
    return bestPractices;
}

const GLOBAL_LABEL_KEYS = [
    ['header', 'nrAnalysisReport'],
    'executionDate',
    'hostname',
    'platform',
    'connection',
    'scenarios',
    'errors',
    'error',
    'scenario',
    'sustainabilityScore',
    'shareDueToActions',
    'co2PerVisit',
    'bestPracticesToImplement',
    'bestPractices',
    'priority',
    'allPriorities',
    'bestPractice',
    'effort',
    'impact',
    'note',
    'footerEcoIndex',
    'footerBestPractices',
    'trend',
    'envScore',
    'socialScore',
    'envScoreSubtitle',
    'socialScoreSubtitle',
    'co2Per1M',
    'waterPer1M',
    'energyPer1M',
    'perVisit',
    'litres',
    'kg',
    'kWh',
    'perfBlock',
    'a11yBlock',
    'impactBlock',
    'accessibilityFindings',
    'checksPassed',
    'checksWarn',
    'checksFailed',
    'bestEnvPages',
    'worstEnvPages',
    'bestSocialPages',
    'worstSocialPages',
    'rankings',
    'avgScore',
    'pageDetail',
    'securityScore',
    'securityScoreSubtitle',
    'serverScore',
    'serverScoreSubtitle',
    'cyberBlock',
    'serverBlock',
    'securityChecks',
    'serverChecks',
    'impactPerVisit',
    'co2PerVisitCard',
    'waterPerVisitCard',
    'energyPerVisitCard',
    'wh',
    'cl',
    'g',
];

const GLOBAL_TOOLTIP_KEYS = [
    ['sustainabilityScore', 'tooltip_ecoIndex'],
    ['shareDueToActions', 'tooltip_shareDueToActions'],
    ['bestPracticesToImplement', 'tooltip_bestPracticesToImplement'],
];

const PAGE_LABEL_KEYS = [
    'requests',
    'pageSize',
    'domSize',
    'steps',
    'step',
    'sustainabilityScore',
    'co2PerVisit',
    'bestPractices',
    'bestPractice',
    'result',
    'effort',
    'impact',
    'priority',
    'note',
    'envScore',
    'socialScore',
    'envScoreSubtitle',
    'socialScoreSubtitle',
    'co2Per1M',
    'waterPer1M',
    'energyPer1M',
    'perVisit',
    'litres',
    'kg',
    'kWh',
    'perfBlock',
    'a11yBlock',
    'impactBlock',
    'accessibilityFindings',
    'checksPassed',
    'checksWarn',
    'checksFailed',
    'bestEnvPages',
    'worstEnvPages',
    'bestSocialPages',
    'worstSocialPages',
    'rankings',
    'avgScore',
    'pageDetail',
    'securityScore',
    'securityScoreSubtitle',
    'serverScore',
    'serverScoreSubtitle',
    'cyberBlock',
    'serverBlock',
    'securityChecks',
    'serverChecks',
    'impactPerVisit',
    'co2PerVisitCard',
    'waterPerVisitCard',
    'energyPerVisitCard',
    'wh',
    'cl',
    'g',
];

/**
 * Build a { labelName: translatedText } object from a list of keys.
 * Each entry is either a bare key (used both as target field and translation key)
 * or a [fieldName, translationKey] tuple.
 */
function buildLabels(translator, keys) {
    const out = {};
    keys.forEach((entry) => {
        const [field, key] = Array.isArray(entry) ? entry : [entry, entry];
        out[field] = translator.translate(key);
    });
    return out;
}

/**
 * Write global report from global template
 */
function writeGlobalReport(globalReportVariables, outputFile, progressBar, translator) {
    const globalReportVariablesWithLabels = {
        labels: buildLabels(translator, GLOBAL_LABEL_KEYS),
        tooltips: buildLabels(translator, GLOBAL_TOOLTIP_KEYS),
        values: globalReportVariables,
    };

    const template = fs.readFileSync(path.join(__dirname, 'template/global.html')).toString();
    const rendered = Mustache.render(template, globalReportVariablesWithLabels);
    fs.writeFileSync(outputFile, rendered);

    if (progressBar) {
        progressBar.tick();
    } else {
        console.log(`Global report : ${outputFile} created`);
    }
}

/**
 * Write scenarios report from page template
 */
function writeAllReports(allReportsVariables, outputFolder, progressBar, translator) {
    const labels = buildLabels(translator, PAGE_LABEL_KEYS);
    const template = fs.readFileSync(path.join(__dirname, 'template/page.html')).toString();
    const resolvedOutputFolder = path.resolve(outputFolder);

    allReportsVariables.forEach((reportVariables) => {
        const rendered = Mustache.render(template, { labels, values: reportVariables });

        const fullPath = path.resolve(outputFolder, reportVariables.filename);
        if (!fullPath.startsWith(resolvedOutputFolder + path.sep)) {
            throw new Error(`Path traversal détecté pour le fichier : ${reportVariables.filename}`);
        }
        fs.writeFileSync(fullPath, rendered);

        if (progressBar) {
            progressBar.tick();
        } else {
            console.log(`Global report : ${outputFolder}/${reportVariables.filename} created`);
        }
    });
}

function removeForbiddenCharacters(str) {
    return removeAccents(removeForbiddenCharactersInFile(str));
}

function removeForbiddenCharactersInFile(str) {
    return str.replace(/[/\\?%*:|"<>°. ]/g, '').replace(/\.\./g, '');
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = {
    create_html_report,
};
