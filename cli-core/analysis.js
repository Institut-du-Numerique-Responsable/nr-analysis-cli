const PuppeteerHar = require('puppeteer-har');
const fs = require('fs');
const path = require('path');
const { harFromMessages } = require('chrome-har');
const sizes = require('../sizes.js');
const { createProgressBar } = require('./utils');

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

        // disabling cache
        await page.setCacheEnabled(false);

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
