/*
 *  Copyright (C) 2016  The EcoMeter authors (https://gitlab.com/ecoconceptionweb/ecometer)
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

function start_analyse_core() {
    const analyseStartingTime = Date.now();
    const domSize = document.getElementsByTagName('*').length;

    if (!analyseBestPractices) {
        return {
            analyseStartingTime,
            url: document.URL,
            domSize,
        };
    }

    return {
        analyseStartingTime,
        url: document.URL,
        domSize,
        pluginsNumber: getPluginsNumber(),
        printStyleSheetsNumber: getPrintStyleSheetsNumber(),
        inlineStyleSheetsNumber: getInlineStyleSheetsNumber(),
        emptySrcTagNumber: getEmptySrcTagNumber(),
        inlineJsScript: getInlineJsScript(),
        inlineJsScriptsNumber: getInlineJsScriptsNumber(),
        imagesResizedInBrowser: getImagesResizedInBrowser(),
        autoplayMediaCount: getAutoplayMediaCount(),
        lazyLoadStats: getLazyLoadStats(),
        preloadCount: getPreloadCount(),
        renderBlockingScriptsCount: getRenderBlockingScriptsCount(),
        externalIframesCount: getExternalIframesCount(),
    };
}

function getPluginsNumber() {
    return document.querySelectorAll('object,embed').length;
}

function getEmptySrcTagNumber() {
    return (
        document.querySelectorAll('img[src=""]').length +
        document.querySelectorAll('script[src=""]').length +
        document.querySelectorAll('link[rel=stylesheet][href=""]').length
    );
}

function getPrintStyleSheetsNumber() {
    return (
        document.querySelectorAll('link[rel=stylesheet][media~=print]').length +
        document.querySelectorAll('style[media~=print]').length
    );
}

function getInlineStyleSheetsNumber() {
    let inlineStyleSheetsNumber = 0;
    Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
            if (!styleSheet.href) inlineStyleSheetsNumber++;
        } catch (err) {
            console.log('NR-ANALYSIS ERROR ,' + err.name + ' = ' + err.message);
            console.log('NR-ANALYSIS ERROR ' + err.stack);
        }
    });
    return inlineStyleSheetsNumber;
}

// Inline scripts, excluding JSON-LD blocks (type="application/ld+json")
function isInlineJsScript(script) {
    return script.text.length > 0 && String(script.type) !== 'application/ld+json';
}

function getInlineJsScript() {
    return Array.from(document.scripts)
        .filter(isInlineJsScript)
        .map((script) => '\n' + script.text)
        .join('');
}

function getInlineJsScriptsNumber() {
    return Array.from(document.scripts).filter(isInlineJsScript).length;
}

function getAutoplayMediaCount() {
    return document.querySelectorAll('video[autoplay], audio[autoplay]').length;
}

function getLazyLoadStats() {
    const images = document.querySelectorAll('img');
    const iframes = document.querySelectorAll('iframe[src]');
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const lazyIframes = document.querySelectorAll('iframe[src][loading="lazy"]');
    return {
        total: images.length + iframes.length,
        lazy: lazyImages.length + lazyIframes.length,
    };
}

function getPreloadCount() {
    return document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]').length;
}

function getRenderBlockingScriptsCount() {
    if (!document.head) return 0;
    return document.head.querySelectorAll('script:not([async]):not([defer]):not([type="module"])').length;
}

function getExternalIframesCount() {
    const currentHost = window.location.hostname;
    let count = 0;
    document.querySelectorAll('iframe[src]').forEach((iframe) => {
        try {
            const iframeHost = new URL(iframe.src).hostname;
            if (iframeHost && iframeHost !== currentHost) count++;
        } catch (e) {
            // Ignore invalid URLs
        }
    });
    return count;
}

function getImagesResizedInBrowser() {
    const imagesResized = [];
    document.querySelectorAll('img').forEach((img) => {
        const isSmaller = img.clientWidth < img.naturalWidth || img.clientHeight < img.naturalHeight;
        // Exclude 1px tracking pixels
        if (!isSmaller || img.naturalWidth <= 1) return;
        imagesResized.push({
            src: img.src,
            clientWidth: img.clientWidth,
            clientHeight: img.clientHeight,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
        });
    });
    return imagesResized;
}
