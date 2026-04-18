const fs = require('fs');
const path = require('path');
const Mustache = require('mustache');
const rules = require('../conf/rules');
const utils = require('./utils');

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

// CSS class for each best-practice compliance level
const cssBestPractices = {
    A: 'checkmark-success',
    B: 'close-warning',
    C: 'close-error',
};
const bestPracticesKey = [
    'AddExpiresOrCacheControlHeaders',
    'CompressHttp',
    'DomainsNumber',
    'DontResizeImageInBrowser',
    'EmptySrcTag',
    'ExternalizeCss',
    'ExternalizeJs',
    'HttpError',
    'HttpRequests',
    'ImageDownloadedNotDisplayed',
    'JsValidate',
    'MaxCookiesLength',
    'MinifiedCss',
    'MinifiedJs',
    'NoCookieForStaticRessources',
    'NoRedirect',
    'OptimizeBitmapImages',
    'OptimizeSvg',
    'Plugins',
    'PrintStyleSheet',
    'SocialNetworkButton',
    'StyleSheets',
    'UseETags',
    'UseStandardTypefaces',
    'ModernImageFormats',
    'OptimizeFonts',
    'TrackingScripts',
    'NoExternalIframes',
    'NoAutoplayVideo',
    'LazyLoadImages',
    'NoExcessivePreload',
    'NoRenderBlockingResources',
];

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
    const { allReportsVariables, waterTotal, greenhouseGasesEmissionTotal } = readAllReports(
        fileList,
        options.grafana_link,
        translator
    );

    // Read global report
    const globalReportVariables = readGlobalReport(
        globalReport.path,
        allReportsVariables,
        waterTotal,
        greenhouseGasesEmissionTotal,
        grafanaLinkPresent,
        translator
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
function readAllReports(fileList, grafanaLink, translator) {
    // init variables
    const allReportsVariables = [];
    let waterTotal = 0;
    let greenhouseGasesEmissionTotal = 0;

    // Read all json files
    fileList.forEach((file) => {
        let reportVariables = {};
        const report_data = JSON.parse(fs.readFileSync(file.path).toString());

        const hostname = report_data.pageInformations.url.split('/')[2];
        const scenarioName = report_data.pageInformations.name || report_data.pageInformations.url;
        const scenarioNameHtml = escapeHtml(scenarioName);
        const pageFilename = report_data.pageInformations.name
            ? `${removeForbiddenCharacters(report_data.pageInformations.name)}.html`
            : `${report_data.index}.html`;

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
                    res.ecoIndex = action.ecoIndex;
                    res.grade = action.grade;
                    res.waterConsumption = action.waterConsumption;
                    res.greenhouseGasesEmission = action.greenhouseGasesEmission;
                    res.nbRequest = action.nbRequest;
                    res.domSize = action.domSize;
                    res.responsesSize = action.responsesSize / 1000;
                    res.responsesSizeUncompress = action.responsesSizeUncompress;
                    actions.push(res);
                });

                analyzePage.actions = actions;

                const lastAction = actions[actions.length - 1];
                analyzePage.lastEcoIndex = lastAction.ecoIndex;
                analyzePage.lastGrade = lastAction.grade;
                analyzePage.deltaEcoIndex = actions[0].ecoIndex - lastAction.ecoIndex;
                analyzePage.waterConsumption = lastAction.waterConsumption;
                analyzePage.greenhouseGasesEmission = lastAction.greenhouseGasesEmission;
                analyzePage.domSize = lastAction.domSize;
                analyzePage.nbRequest = lastAction.nbRequest;
                analyzePage.ecoIndex = lastAction.ecoIndex;
                analyzePage.grade = lastAction.grade;

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

                if (analyzePage.waterConsumption) {
                    waterTotal += analyzePage.waterConsumption;
                }
                if (analyzePage.greenhouseGasesEmission) {
                    greenhouseGasesEmissionTotal += analyzePage.greenhouseGasesEmission;
                }
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

            reportVariables = {
                date: report_data.date,
                success: report_data.success,
                cssRowError: '',
                name: scenarioName,
                link: `<a href="${escapeHtml(pageFilename)}">${scenarioNameHtml}</a>`,
                filename: pageFilename,
                header: `${escapeHtml(translator.translate('nrAnalysisReport'))} > <a class="text-white" href="${escapeHtml(report_data.pageInformations.url)}">${scenarioNameHtml}</a>`,
                bigEcoIndex: `${report_data.ecoIndex} <span class="grade big-grade ${report_data.grade}">${report_data.grade}</span>`,
                smallEcoIndex: `${report_data.ecoIndex} <span class="grade ${report_data.grade}">${report_data.grade}</span>`,
                grade: report_data.grade,
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

    return { allReportsVariables, waterTotal, greenhouseGasesEmissionTotal };
}

/**
 * Read and generate data for global template
 * @param {*} path
 * @param {*} allReportsVariables
 * @param {*} waterTotal
 * @param {*} greenhouseGasesEmissionTotal
 * @param {*} grafanaLinkPresent
 * @returns
 */
function readGlobalReport(
    path,
    allReportsVariables,
    waterTotal,
    greenhouseGasesEmissionTotal,
    grafanaLinkPresent,
    translator
) {
    const globalReport_data = JSON.parse(fs.readFileSync(path).toString());

    let ecoIndex = '';
    (globalReport_data.worstEcoIndexes || []).forEach((worstEcoIndex) => {
        const separator = ecoIndex === '' ? '' : '/';
        ecoIndex = `${ecoIndex} ${separator} ${worstEcoIndex.ecoIndex} <span class="grade big-grade ${worstEcoIndex.grade}">${worstEcoIndex.grade}</span>`;
    });

    const globalReportVariables = {
        date: globalReport_data.date,
        hostname: globalReport_data.hostname,
        device: globalReport_data.device,
        connection: globalReport_data.connection,
        ecoIndex: ecoIndex,
        grade: globalReport_data.grade,
        nbScenarios: globalReport_data.nbScenarios,
        waterTotal: Math.round(waterTotal * 100) / 100,
        greenhouseGasesEmissionTotal: Math.round(greenhouseGasesEmissionTotal * 100) / 100,
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
    'ecoIndex',
    'shareDueToActions',
    'greenhouseGasesEmission',
    'water',
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
];

const GLOBAL_TOOLTIP_KEYS = [
    ['ecoIndex', 'tooltip_ecoIndex'],
    ['shareDueToActions', 'tooltip_shareDueToActions'],
    ['bestPracticesToImplement', 'tooltip_bestPracticesToImplement'],
];

const PAGE_LABEL_KEYS = [
    'requests',
    'pageSize',
    'domSize',
    'steps',
    'step',
    'ecoIndex',
    'water',
    'greenhouseGasesEmission',
    'bestPractices',
    'bestPractice',
    'result',
    'effort',
    'impact',
    'priority',
    'note',
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
