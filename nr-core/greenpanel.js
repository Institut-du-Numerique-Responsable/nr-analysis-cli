/*
 *  Copyright (C) 2019  didierfred@gmail.com
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published
 *  by the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

let backgroundPageConnection;
let currentRulesChecker;
let lastAnalyseStartingTime = 0;
let measuresAcquisition;
let analyseBestPractices = true;
let har;
let resources;

function handleResponseFromBackground(frameMeasures) {
    if (isOldAnalyse(frameMeasures.analyseStartingTime)) {
        debug(() => `Analyse is too old for url ${frameMeasures.url} , time = ${frameMeasures.analyseStartingTime}`);
        return;
    }
    measuresAcquisition.aggregateFrameMeasures(frameMeasures);
}

function launchAnalyse() {
    let now = Date.now();

    // To avoid parallel analyse , force 1 secondes between analysis
    if (now - lastAnalyseStartingTime < 1000) {
        debug(() => 'Ignore click');
        return;
    }
    lastAnalyseStartingTime = now;
    currentRulesChecker = rulesManager.getNewRulesChecker();
    measuresAcquisition = new MeasuresAcquisition(currentRulesChecker);
    measuresAcquisition.initializeMeasures();
    measuresAcquisition.aggregateFrameMeasures(start_analyse_core());
    measuresAcquisition.startMeasuring();
    let returnObj = measuresAcquisition.getMeasures();
    returnObj.bestPractices = measuresAcquisition.getBestPractices();
    return returnObj;
}

function MeasuresAcquisition(rules) {
    let measures;
    let localRulesChecker = rules;
    let nbGetHarTry = 0;

    this.initializeMeasures = () => {
        measures = {
            url: '',
            domSize: 0,
            nbRequest: 0,
            responsesSize: 0,
            responsesSizeUncompress: 0,
            pluginsNumber: 0,
            printStyleSheetsNumber: 0,
            inlineStyleSheetsNumber: 0,
            emptySrcTagNumber: 0,
            inlineJsScriptsNumber: 0,
            imagesResizedInBrowser: [],
            autoplayMediaCount: 0,
            lazyLoadStats: { total: 0, lazy: 0 },
            preloadCount: 0,
            renderBlockingScriptsCount: 0,
            externalIframesCount: 0,
            a11y: null,
        };
    };

    this.startMeasuring = function () {
        getNetworkMeasure();
        if (analyseBestPractices) getResourcesMeasure();
    };

    this.getMeasures = () => measures;

    this.getBestPractices = () => Object.fromEntries(localRulesChecker.getAllRules());

    this.aggregateFrameMeasures = function (frameMeasures) {
        measures.domSize += frameMeasures.domSize;

        if (analyseBestPractices) {
            measures.pluginsNumber += frameMeasures.pluginsNumber;

            measures.printStyleSheetsNumber += frameMeasures.printStyleSheetsNumber;
            if (measures.inlineStyleSheetsNumber < frameMeasures.inlineStyleSheetsNumber)
                measures.inlineStyleSheetsNumber = frameMeasures.inlineStyleSheetsNumber;
            measures.emptySrcTagNumber += frameMeasures.emptySrcTagNumber;
            if (frameMeasures.inlineJsScript.length > 0) {
                const resourceContent = {
                    url: 'inline js',
                    type: 'script',
                    content: frameMeasures.inlineJsScript,
                };
                localRulesChecker.sendEvent('resourceContentReceived', measures, resourceContent);
            }
            if (measures.inlineJsScriptsNumber < frameMeasures.inlineJsScriptsNumber)
                measures.inlineJsScriptsNumber = frameMeasures.inlineJsScriptsNumber;

            measures.imagesResizedInBrowser = frameMeasures.imagesResizedInBrowser;

            measures.autoplayMediaCount += frameMeasures.autoplayMediaCount || 0;
            measures.lazyLoadStats = frameMeasures.lazyLoadStats || { total: 0, lazy: 0 };
            measures.preloadCount += frameMeasures.preloadCount || 0;
            measures.renderBlockingScriptsCount += frameMeasures.renderBlockingScriptsCount || 0;
            measures.externalIframesCount += frameMeasures.externalIframesCount || 0;
            if (frameMeasures.a11y) measures.a11y = frameMeasures.a11y;

            localRulesChecker.sendEvent('frameMeasuresReceived', measures);
        }
    };

    const getNetworkMeasure = () => {
        console.log('Start network measure...');
        // only account for network traffic, filtering resources embedded through data urls
        let entries = har.entries.filter((entry) => isNetworkResource(entry));

        // Get the "mother" url
        if (entries.length > 0) measures.url = entries[0].request.url;
        else {
            // Bug with firefox  when we first get har.entries when starting the plugin , we need to ask again to have it
            if (nbGetHarTry < 1) {
                debug(() => 'No entries, try again to get HAR in 1s');
                nbGetHarTry++;
                setTimeout(getNetworkMeasure, 1000);
            }
        }

        measures.entries = entries;
        measures.dataEntries = har.entries.filter((entry) => isDataResource(entry)); // embeded data urls

        if (entries.length) {
            measures.nbRequest = entries.length;
            entries.forEach((entry) => {
                // If chromium :
                // _transferSize represent the real data volume transfert
                // while content.size represent the size of the page which is uncompress
                if (entry.response._transferSize) {
                    measures.responsesSize += entry.response._transferSize;
                    measures.responsesSizeUncompress += entry.response.content.size;
                } else if (entry.response.content.size) {
                    // In firefox, entry.response.content.size can sometimes be undefined
                    measures.responsesSize += entry.response.content.size;
                }
            });
            if (analyseBestPractices) localRulesChecker.sendEvent('harReceived', measures);
        }
    };

    function getResourcesMeasure() {
        resources.forEach((resource) => {
            if (resource.url.startsWith('file') || resource.url.startsWith('http')) {
                if (resource.type === 'script' || resource.type === 'stylesheet' || resource.type === 'image') {
                    let resourceAnalyser = new ResourceAnalyser(resource);
                    resourceAnalyser.analyse();
                }
            }
        });
    }

    function ResourceAnalyser(resource) {
        let resourceToAnalyse = resource;

        this.analyse = () => resourceToAnalyse.getContent(this.analyseContent);

        this.analyseContent = (code) => {
            // exclude from analyse the injected script
            if (resourceToAnalyse.type === 'script' && resourceToAnalyse.url.includes('script/analyseFrame.js')) return;

            let resourceContent = {
                url: resourceToAnalyse.url,
                type: resourceToAnalyse.type,
                content: code,
            };
            localRulesChecker.sendEvent('resourceContentReceived', measures, resourceContent);
        };
    }
}

