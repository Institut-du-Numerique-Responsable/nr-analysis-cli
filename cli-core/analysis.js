const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');
const path = require('path');
const { harFromMessages } = require('chrome-har');
const sizes = require('../sizes.js');
const { createProgressBar } = require('./utils');
const { checkGreenHosting, computeCo2, computeEcoIndexImpact } = require('./co2Client');
const { computeSynthetic, buildRecommendations } = require('./synthetic');
const { detectDatacenterCountry } = require('./geoLookup');
const { computeScore } = require('./scoring');
const { computeSocialScore } = require('./socialScoring');
const { auditServer } = require('./serverAudit');
const { computeSecurityScore, computeServerScore } = require('./auditScoring');

const SUBRESULTS_DIRECTORY = path.join(__dirname, '../results');

//Analyse a scenario
async function analyseScenario(browser, pageInformations, options, translator, pageLoadingLabel) {
    let scenarioResult = {};

    const TIMEOUT = options.timeout;
    const TAB_ID = options.tabId;
    const TRY_NB = options.tryNb || 1;
    const DEVICE = options.device || 'desktop';
    const PROXY = options.proxy;
    const LANGUAGE = options.language;

    try {
        const page = await browser.newPage();

        // configure proxy in page browser
        if (PROXY) {
            await page.authenticate({ username: PROXY.user, password: PROXY.password });
        }

        // configure headers http
        if (options.headers) {
            await page.setExtraHTTPHeaders(options.headers);
        }

        await page.setViewport(sizes[DEVICE]);

        // disabling cache + service worker (SW would mask real network transfer size)
        await page.setCacheEnabled(false);
        try {
            const cdp = await page.target().createCDPSession();
            await cdp.send('Network.setBypassServiceWorker', { bypass: true });
        } catch (_e) {
            /* CDP unavailable — proceed without SW bypass */
        }

        // Execute actions on page (click, text, ...)
        let pages = await startActions(page, pageInformations, TIMEOUT, translator, pageLoadingLabel);

        scenarioResult.pages = pages;
        scenarioResult.success = true;
        scenarioResult.nbBestPracticesToCorrect = 0;
    } catch (error) {
        console.error(`Error while analyzing URL ${pageInformations.url} : `, error);
        scenarioResult.success = false;
    }
    const date = new Date();
    scenarioResult.date = `${date.toLocaleDateString(LANGUAGE)} ${date.toLocaleTimeString(LANGUAGE)}`;
    scenarioResult.pageInformations = pageInformations;
    scenarioResult.tryNb = TRY_NB;
    scenarioResult.tabId = TAB_ID;
    scenarioResult.index = options.index;
    scenarioResult.url = pageInformations.url;

    return scenarioResult;
}

async function waitPageLoading(page, pageInformations, TIMEOUT) {
    if (pageInformations.waitForSelector) {
        await page.locator(pageInformations.waitForSelector).setTimeout(TIMEOUT).wait();
    } else if (pageInformations.waitForXPath) {
        await page.locator(`::-p-xpath(${pageInformations.waitForXPath})`).setTimeout(TIMEOUT).wait();
    } else if (isValidWaitForNavigation(pageInformations.waitForNavigation)) {
        await page.waitForNavigation({ waitUntil: pageInformations.waitForNavigation, timeout: TIMEOUT });
    } else if (pageInformations.waitForTimeout) {
        await waitForTimeout(pageInformations.waitForTimeout);
    }
}

function waitForTimeout(milliseconds) {
    return new Promise((r) => setTimeout(r, milliseconds));
}

const VALID_WAIT_UNTIL = ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'];

function isValidWaitForNavigation(waitUntilParam) {
    return VALID_WAIT_UNTIL.includes(waitUntilParam);
}

/**
 * Execute the scenario's configured actions on the given page.
 * @param {*} page Puppeteer page
 * @param {*} pageInformations scenario description (url, actions, ...)
 * @param {number} timeout action timeout in ms
 * @param {*} translator
 * @param {string} pageLoadingLabel
 */
async function startActions(page, pageInformations, timeout, translator, pageLoadingLabel) {
    const pptrHar = new PuppeteerHar(page);
    await pptrHar.start();

    // Navigate to the URL then take the initial snapshot
    await doFirstAction(page, pageInformations, timeout);
    let actionResult = await doAnalysis(page, pptrHar, pageLoadingLabel, translator);

    let actionsResultsForAPage = [actionResult];
    let currentPage = {
        name: actionResult.name,
        bestPractices: actionResult.bestPractices,
        nbRequest: actionResult.nbRequest,
        responsesSize: actionResult.responsesSize,
        responsesSizeUncompress: actionResult.responsesSizeUncompress,
    };

    const pagesResults = [];
    const actions = pageInformations.actions || [];
    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        const actionName = action.name || index + 1;

        // Wait before the action so greenIT measurement is not cancelled (default: 1000ms)
        const timeoutBefore = action.timeoutBefore > 0 ? action.timeoutBefore : 1000;
        await waitForTimeout(timeoutBefore);

        currentPage.url = page.url();

        if (action.pageChange) {
            // Save previous page analysis and reinitialise page state
            currentPage.actions = actionsResultsForAPage;
            pagesResults.push({ ...currentPage });

            actionsResultsForAPage = [];
            currentPage = {
                name: actionName,
                nbRequest: 0,
                responsesSize: 0,
                responsesSizeUncompress: 0,
            };

            // Clean up HAR history
            pptrHar.network_events = [];
            pptrHar.response_body_promises = [];
        }

        try {
            await doAction(page, action, actionName, timeout);
        } finally {
            if (action.screenshot) {
                await takeScreenshot(page, action.screenshot);
            }
        }

        actionResult = await doAnalysis(page, pptrHar, actionName, translator);

        // Statistics of current page = statistics of last action (e.g. sum over all actions)
        currentPage.bestPractices = actionResult.bestPractices;
        currentPage.nbRequest = actionResult.nbRequest;
        currentPage.responsesSize = actionResult.responsesSize;
        currentPage.responsesSizeUncompress = actionResult.responsesSizeUncompress;

        actionsResultsForAPage.push(actionResult);
    }

    currentPage.url = page.url();
    currentPage.actions = actionsResultsForAPage;
    pagesResults.push(currentPage);

    await pptrHar.stop();
    page.close();

    return pagesResults;
}

async function doFirstAction(page, pageInformations, timeout) {
    try {
        await page.goto(pageInformations.url, { timeout });
        await waitPageLoading(page, pageInformations, timeout);
    } finally {
        // Take screenshot even if the page fails to load
        if (pageInformations.screenshot) {
            await takeScreenshot(page, pageInformations.screenshot);
        }
    }
}

async function doAction(page, action, actionName, timeout) {
    switch (action.type) {
        case 'click':
            await page.click(action.element);
            break;
        case 'text':
            await page.type(action.element, action.content, { delay: 100 });
            break;
        case 'select':
            await page.select(action.element, ...action.values);
            break;
        case 'scroll':
            await scrollToBottom(page);
            break;
        case 'press':
            await page.keyboard.press(action.key);
            break;
        default:
            console.log(`Unknown action for '${actionName}' : ${action.type}`);
            return;
    }
    await waitPageLoading(page, action, timeout);
}

function isNetworkEventGeneratedByAnalysis(initiator) {
    return (
        initiator?.type === 'script' &&
        initiator?.stack?.callFrames?.some((callFrame) => callFrame.url.includes('greenItBundle.js'))
    );
}

async function doAnalysis(page, pptrHar, name, translator) {
    // Drop network events produced by the analysis itself (scripts from greenItBundle.js)
    pptrHar.network_events = pptrHar.network_events.filter(
        (network_event) => !isNetworkEventGeneratedByAnalysis(network_event?.params?.initiator)
    );

    const harObj = await harStatus(pptrHar);
    const client = await page.createCDPSession();
    const ressourceTree = await client.send('Page.getResourceTree');
    await client.detach();

    await injectChromeObjectInPage(page, translator);

    // Inject the bundle, run it, then remove it so it cannot interfere with the analysis
    const script = await page.addScriptTag({
        path: path.join(__dirname, '../dist/nrBundle.js'),
    });
    await script.evaluate((x) => x.remove());

    // Expose node data to the browser context
    await page.evaluate((x) => (har = x), harObj.log);
    await page.evaluate((x) => (resources = x), ressourceTree.frameTree.resources);

    const result = await page.evaluate(() => launchAnalyse());
    if (name) {
        result.name = name;
    }

    return result;
}

async function injectChromeObjectInPage(page, translator) {
    // Replace chrome.i18n.getMessage by a custom implementation using the translator catalog
    await page.evaluate(
        (language_array) =>
            (chrome = {
                i18n: {
                    getMessage: function (message, parameters = []) {
                        return language_array[message].replace(/%s/g, function () {
                            // parameters can be a single string or an array
                            return Array.isArray(parameters) ? parameters.shift() : parameters;
                        });
                    },
                },
            }),
        translator.getCatalog()
    );
}

/**
 * @returns {Promise<void|object>}
 */
async function harStatus(pptrHar) {
    await Promise.all(pptrHar.response_body_promises);
    return harFromMessages(pptrHar.page_events.concat(pptrHar.network_events), {
        includeTextFromResponseBody: pptrHar.saveResponse,
    });
}

async function scrollToBottom(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            const distance = 400;
            const timeoutBetweenScroll = 1500;
            let totalHeight = 0;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, timeoutBetweenScroll);
        });
    });
}

async function takeScreenshot(page, screenshotPath) {
    const folder = path.dirname(screenshotPath);
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
    if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
    }
    await page.screenshot({ path: screenshotPath });
}

async function login(browser, loginInformations, options) {
    // Reuse the tab opened by the browser
    const page = (await browser.pages())[0];

    await page.goto(loginInformations.url);
    await page.waitForSelector(loginInformations.loginButtonSelector);

    // Simulate a user waiting before typing login/password
    await waitForTimeout(1000);
    for (const field of loginInformations.fields) {
        await page.type(field.selector, field.value);
        await waitForTimeout(500);
    }
    // Simulate a user waiting before clicking the button
    await waitForTimeout(1000);
    await page.click(loginInformations.loginButtonSelector);

    if (loginInformations.screenshot) {
        await takeScreenshot(page, loginInformations.screenshot);
    }
    // Don't wait for the full authentication procedure, just the next page
    await waitPageLoading(page, loginInformations, options.timeout);
}

async function enrichResultsWithScoring(results, options = {}) {
    if (!results.success) return;
    const deviceCountry = (options.country || 'FRA').toUpperCase();

    const domain = results.pageInformations.url
        .replace(/^https?:\/\//, '')
        .split('/')[0];
    const greenHostingResult = await checkGreenHosting(domain);

    let serverAuditResult = null;
    try {
        serverAuditResult = await auditServer(results.pageInformations.url);
    } catch (e) {
        serverAuditResult = null;
    }
    let dcDetect = null;
    if (options.dc_country) {
        dcDetect = { iso3: options.dc_country.toUpperCase(), source: 'cli-flag' };
    } else if (serverAuditResult && serverAuditResult.raw) {
        try {
            const ips = [
                ...((serverAuditResult.raw.dnsInfo && serverAuditResult.raw.dnsInfo.a) || []),
                ...((serverAuditResult.raw.dnsInfo && serverAuditResult.raw.dnsInfo.aaaa) || []),
            ];
            dcDetect = await detectDatacenterCountry({
                headers: serverAuditResult.raw.headers || {},
                ips,
            });
        } catch (_e) {
            dcDetect = null;
        }
    }
    const dcCountry = (dcDetect && dcDetect.iso3) || deviceCountry;
    const dcSource = (dcDetect && dcDetect.source) || 'fallback-device';
    const securityScoring = computeSecurityScore(serverAuditResult && serverAuditResult.security);
    const serverScoring = computeServerScore(serverAuditResult && serverAuditResult.server);
    results.security = serverAuditResult ? serverAuditResult.security : null;
    results.server = serverAuditResult ? serverAuditResult.server : null;
    results.securityScore = securityScoring.score;
    results.securityGrade = securityScoring.grade;
    results.securitySummary = securityScoring.summary;
    results.securityIssues = securityScoring.issues;
    results.serverScore = serverScoring.score;
    results.serverGrade = serverScoring.grade;
    results.serverSummary = serverScoring.summary;
    results.serverIssues = serverScoring.issues;

    results.pages.forEach((page) => {
        page.actions.forEach((action) => {
            if (!action.bestPractices) return;

            action.bestPractices.GreenHosting = greenHostingResult;
            const isGreen = greenHostingResult.complianceLevel === 'A';
            const co2 = computeCo2(action.responsesSize || 0, isGreen, {
                deviceCountry,
                dcCountry,
                deviceGco2: typeof options.grid_device_gco2 === 'number' ? options.grid_device_gco2 : undefined,
                dcGco2: typeof options.grid_dc_gco2 === 'number' ? options.grid_dc_gco2 : undefined,
                networkGco2: typeof options.grid_network_gco2 === 'number' ? options.grid_network_gco2 : undefined,
                methodology: options.methodology || 'swdm-v4',
            });
            action.bestPractices.Co2PerVisit = co2.result;
            action.co2PerVisit = co2.value;
            action.co2FirstVisit = co2.firstVisitGrams;
            action.co2CacheWeighted = co2.cacheWeightedGrams;
            action.co2TransferredKb = co2.transferredKb;
            action.co2Country = co2.country;
            action.co2DeviceCountry = co2.deviceCountry;
            action.co2DcCountry = co2.dcCountry;
            action.co2DcSource = dcSource;
            action.co2NetworkCountry = co2.networkCountry;
            action.co2GridIntensityDevice = co2.gridIntensityDevice;
            action.co2GridIntensityDc = co2.gridIntensityDc;
            action.co2GridIntensityNetwork = co2.gridIntensityNetwork;
            action.co2GridIntensity = co2.gridIntensity;
            action.co2GreenHosting = co2.greenHosting;
            action.co2Breakdown = co2.breakdown;
            action.co2Model = co2.model;
            action.co2Methodology = co2.methodology;
            action.co2MethodologyLabel = co2.methodologyLabel;
            action.co2Per1M = co2.co2Per1M;
            action.waterPer1M = co2.waterPer1M;
            action.energyPer1M = co2.energyPer1M;
            action.waterPerVisit = co2.waterPerVisit;
            action.waterClPerVisit = co2.waterClPerVisit;
            action.energyWhPerVisit = co2.energyWhPerVisit;

            const ecoIdx = computeEcoIndexImpact(action.domSize, action.nbRequest, action.responsesSize);
            action.ecoIndex = ecoIdx.ecoIndex;
            action.ecoIndexGrade = ecoIdx.ecoIndexGrade;
            action.ecoIndexCo2PerVisit = ecoIdx.co2PerVisit;
            action.ecoIndexWaterClPerVisit = ecoIdx.waterClPerVisit;
            action.ecoIndexCo2Per1M = ecoIdx.co2Per1M;
            action.ecoIndexWaterPer1M = ecoIdx.waterPer1M;

            const synthetic = computeSynthetic(ecoIdx, co2);
            action.syntheticScore = synthetic.score;
            action.syntheticGrade = synthetic.grade;
            action.syntheticConfidence = synthetic.confidence;
            action.syntheticRationale = synthetic.rationale;
            action.syntheticComponents = synthetic.components;
            action.recommendations = buildRecommendations(action, ecoIdx, co2, synthetic);

            const scoring = computeScore(action.bestPractices);
            action.sustainabilityScore = scoring.score;
            action.sustainabilityGrade = scoring.grade;
            action.scoreByCategory = scoring.byCategory;

            const social = computeSocialScore(action.a11y);
            action.socialScore = social.score;
            action.socialGrade = social.grade;
            action.a11ySummary = social.summary;
            action.a11yIssues = social.issues;
        });

        const lastAction = page.actions[page.actions.length - 1];
        page.sustainabilityScore = lastAction.sustainabilityScore;
        page.sustainabilityGrade = lastAction.sustainabilityGrade;
        page.scoreByCategory = lastAction.scoreByCategory;
        page.co2PerVisit = lastAction.co2PerVisit;
        page.co2Per1M = lastAction.co2Per1M;
        page.waterPer1M = lastAction.waterPer1M;
        page.energyPer1M = lastAction.energyPer1M;
        page.waterClPerVisit = lastAction.waterClPerVisit;
        page.energyWhPerVisit = lastAction.energyWhPerVisit;
        page.ecoIndex = lastAction.ecoIndex;
        page.ecoIndexGrade = lastAction.ecoIndexGrade;
        page.ecoIndexCo2PerVisit = lastAction.ecoIndexCo2PerVisit;
        page.ecoIndexWaterClPerVisit = lastAction.ecoIndexWaterClPerVisit;
        page.ecoIndexCo2Per1M = lastAction.ecoIndexCo2Per1M;
        page.ecoIndexWaterPer1M = lastAction.ecoIndexWaterPer1M;
        page.syntheticScore = lastAction.syntheticScore;
        page.syntheticGrade = lastAction.syntheticGrade;
        page.syntheticConfidence = lastAction.syntheticConfidence;
        page.syntheticRationale = lastAction.syntheticRationale;
        page.syntheticComponents = lastAction.syntheticComponents;
        page.recommendations = lastAction.recommendations;
        page.co2Country = lastAction.co2Country;
        page.co2GridIntensity = lastAction.co2GridIntensity;
        page.co2GreenHosting = lastAction.co2GreenHosting;
        page.co2Breakdown = lastAction.co2Breakdown;
        page.co2Model = lastAction.co2Model;
        page.co2Methodology = lastAction.co2Methodology;
        page.co2MethodologyLabel = lastAction.co2MethodologyLabel;
        page.co2FirstVisit = lastAction.co2FirstVisit;
        page.co2CacheWeighted = lastAction.co2CacheWeighted;
        page.co2TransferredKb = lastAction.co2TransferredKb;
        page.co2DeviceCountry = lastAction.co2DeviceCountry;
        page.co2DcCountry = lastAction.co2DcCountry;
        page.co2DcSource = lastAction.co2DcSource;
        page.co2NetworkCountry = lastAction.co2NetworkCountry;
        page.co2GridIntensityDevice = lastAction.co2GridIntensityDevice;
        page.co2GridIntensityDc = lastAction.co2GridIntensityDc;
        page.co2GridIntensityNetwork = lastAction.co2GridIntensityNetwork;
        page.socialScore = lastAction.socialScore;
        page.socialGrade = lastAction.socialGrade;
        page.a11ySummary = lastAction.a11ySummary;
        page.a11yIssues = lastAction.a11yIssues;
    });

    const lastPage = results.pages[results.pages.length - 1];
    results.sustainabilityScore = lastPage.sustainabilityScore;
    results.sustainabilityGrade = lastPage.sustainabilityGrade;
    results.socialScore = lastPage.socialScore;
    results.socialGrade = lastPage.socialGrade;
    results.co2Per1M = lastPage.co2Per1M;
    results.waterPer1M = lastPage.waterPer1M;
    results.energyPer1M = lastPage.energyPer1M;
    results.waterClPerVisit = lastPage.waterClPerVisit;
    results.energyWhPerVisit = lastPage.energyWhPerVisit;
    results.ecoIndex = lastPage.ecoIndex;
    results.ecoIndexGrade = lastPage.ecoIndexGrade;
    results.ecoIndexCo2PerVisit = lastPage.ecoIndexCo2PerVisit;
    results.ecoIndexWaterClPerVisit = lastPage.ecoIndexWaterClPerVisit;
    results.ecoIndexCo2Per1M = lastPage.ecoIndexCo2Per1M;
    results.ecoIndexWaterPer1M = lastPage.ecoIndexWaterPer1M;
    results.syntheticScore = lastPage.syntheticScore;
    results.syntheticGrade = lastPage.syntheticGrade;
    results.syntheticConfidence = lastPage.syntheticConfidence;
    results.syntheticRationale = lastPage.syntheticRationale;
    results.syntheticComponents = lastPage.syntheticComponents;
    results.recommendations = lastPage.recommendations;
    results.co2Country = lastPage.co2Country;
    results.co2GridIntensity = lastPage.co2GridIntensity;
    results.co2GreenHosting = lastPage.co2GreenHosting;
    results.co2Breakdown = lastPage.co2Breakdown;
    results.co2Model = lastPage.co2Model;
    results.co2Methodology = lastPage.co2Methodology;
    results.co2MethodologyLabel = lastPage.co2MethodologyLabel;
    results.co2FirstVisit = lastPage.co2FirstVisit;
    results.co2CacheWeighted = lastPage.co2CacheWeighted;
    results.co2TransferredKb = lastPage.co2TransferredKb;
    results.co2DeviceCountry = lastPage.co2DeviceCountry;
    results.co2DcCountry = lastPage.co2DcCountry;
    results.co2DcSource = lastPage.co2DcSource;
    results.co2NetworkCountry = lastPage.co2NetworkCountry;
    results.co2GridIntensityDevice = lastPage.co2GridIntensityDevice;
    results.co2GridIntensityDc = lastPage.co2GridIntensityDc;
    results.co2GridIntensityNetwork = lastPage.co2GridIntensityNetwork;
}

async function createJsonReports(browser, pagesInformations, options, proxy, headers, translator) {
    const TIMEOUT = options.timeout;
    const MAX_TAB = options.max_tab;
    const RETRY = options.retry;
    const DEVICE = options.device;
    const LANGUAGE = options.language;

    const progressBar = createProgressBar(options, pagesInformations.length + 2, 'Analysing', 'Analysing ...');
    const asyncFunctions = [];
    const reports = [];
    const writeList = [];
    let results;
    let resultId = 1;
    let index = 0;

    // `convert` tracks, for each original tab id, its current position in the shrinking asyncFunctions array
    const convert = [];
    for (let i = 0; i < MAX_TAB; i++) {
        convert[i] = i;
    }

    // (Re)create the directory for sub-results
    if (fs.existsSync(SUBRESULTS_DIRECTORY)) {
        fs.rmSync(SUBRESULTS_DIRECTORY, { recursive: true });
    }
    fs.mkdirSync(SUBRESULTS_DIRECTORY);

    const pageLoadingLabel = translator.translate('pageLoading');

    const scheduleScenario = (scenarioIndex, tabId, extra = {}) =>
        analyseScenario(
            browser,
            pagesInformations[scenarioIndex],
            {
                device: DEVICE,
                timeout: TIMEOUT,
                tabId,
                proxy,
                headers,
                index: scenarioIndex,
                language: LANGUAGE,
                ...extra,
            },
            translator,
            pageLoadingLabel
        );

    // Start up to MAX_TAB concurrent analyses
    for (let i = 0; i < MAX_TAB && index < pagesInformations.length; i++) {
        asyncFunctions.push(scheduleScenario(index, i));
        index++;
    }

    while (asyncFunctions.length > 0) {
        results = await Promise.race(asyncFunctions);
        if (!results.success && results.tryNb <= RETRY) {
            // Retry: keep the same tab slot (convert is needed, the array is shrinking)
            asyncFunctions.splice(
                convert[results.tabId],
                1,
                analyseScenario(
                    browser,
                    results.pageInformations,
                    {
                        device: DEVICE,
                        timeout: TIMEOUT,
                        tabId: results.tabId,
                        tryNb: results.tryNb + 1,
                        proxy,
                        headers,
                        index: results.index,
                        language: LANGUAGE,
                    },
                    translator,
                    pageLoadingLabel
                )
            );
            continue;
        }

        await enrichResultsWithScoring(results, options);

        const filePath = path.resolve(SUBRESULTS_DIRECTORY, `${resultId}.json`);
        writeList.push(fs.promises.writeFile(filePath, JSON.stringify(results)));
        reports.push({ name: `${resultId}`, path: filePath });
        if (progressBar) {
            progressBar.tick();
        } else {
            console.log(`${resultId}/${pagesInformations.length}`);
        }
        resultId++;

        if (index === pagesInformations.length) {
            // No more work: drop the finished slot and shift the mapping
            asyncFunctions.splice(convert[results.tabId], 1);
            for (let i = results.tabId + 1; i < convert.length; i++) {
                convert[i] = convert[i] - 1;
            }
        } else {
            // Reuse the slot for the next scenario (array is still full size here, no convert needed)
            asyncFunctions.splice(results.tabId, 1, scheduleScenario(index, results.tabId));
            index++;
        }
    }

    await Promise.all(writeList);
    if (progressBar) {
        progressBar.tick();
    } else {
        console.log('Analyse done');
    }
    return reports;
}

module.exports = {
    createJsonReports,
    login,
};
