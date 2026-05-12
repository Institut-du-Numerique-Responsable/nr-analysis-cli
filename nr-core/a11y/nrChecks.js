/*
 * Additional NR / privacy checks run in the page context.
 * Returns same compliance schema as Tanaguru checks.
 */

function runNrChecks() {
    return {
        FontDisplaySwap: checkFontDisplaySwap(),
        FontPreload: checkFontPreload(),
        FontSubset: checkFontSubset(),
        ConsentBanner: checkConsentBanner(),
        ThirdPartyCookies: checkThirdPartyCookies(),
    };
}

function collectCssRules() {
    const out = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            const cssRules = sheet.cssRules || sheet.rules || [];
            for (const r of Array.from(cssRules)) out.push(r);
        } catch (_e) {
            // Cross-origin sheet skipped
        }
    }
    return out;
}

function checkFontDisplaySwap() {
    const rules = collectCssRules();
    const fontFaceRules = rules.filter((r) => r.type === 5);
    if (fontFaceRules.length === 0) {
        return { complianceLevel: 'A', comment: 'aucune police declaree', detailComment: '', examples: [] };
    }
    const missing = fontFaceRules.filter((r) => {
        const text = r.cssText || '';
        return !/font-display\s*:\s*(swap|optional|fallback)/i.test(text);
    });
    const ratio = missing.length / fontFaceRules.length;
    return {
        complianceLevel: ratio === 0 ? 'A' : (ratio < 0.5 ? 'B' : 'C'),
        comment: `${fontFaceRules.length - missing.length}/${fontFaceRules.length} ont font-display`,
        detailComment: missing.length ? `${missing.length} @font-face sans font-display` : '',
        examples: missing.slice(0, 5).map((r) => {
            const m = /font-family\s*:\s*["']?([^;"']+)["']?/i.exec(r.cssText || '');
            return m ? m[1] : '(@font-face)';
        }),
    };
}

function checkFontPreload() {
    const fontFaceCount = collectCssRules().filter((r) => r.type === 5).length;
    if (fontFaceCount === 0) {
        return { complianceLevel: 'A', comment: 'aucune police', detailComment: '', examples: [] };
    }
    const preloads = document.querySelectorAll('link[rel="preload"][as="font"]');
    return {
        complianceLevel: preloads.length > 0 ? 'A' : 'B',
        comment: `${preloads.length} preload font / ${fontFaceCount} @font-face`,
        detailComment: preloads.length === 0 ? 'Aucune police critique prechargee' : '',
        examples: [],
    };
}

function checkFontSubset() {
    const rules = collectCssRules();
    const fontFaceRules = rules.filter((r) => r.type === 5);
    if (fontFaceRules.length === 0) {
        return { complianceLevel: 'A', comment: 'aucune police', detailComment: '', examples: [] };
    }
    const withRange = fontFaceRules.filter((r) => /unicode-range\s*:/i.test(r.cssText || ''));
    const ratio = withRange.length / fontFaceRules.length;
    return {
        complianceLevel: ratio >= 0.5 ? 'A' : (ratio > 0 ? 'B' : 'C'),
        comment: `${withRange.length}/${fontFaceRules.length} avec unicode-range`,
        detailComment: ratio === 0 ? 'Aucun @font-face ne declare unicode-range' : '',
        examples: [],
    };
}

function checkConsentBanner() {
    const signatures = [
        { name: 'Tarteaucitron', selector: '#tarteaucitronRoot, #tarteaucitronAlertBig' },
        { name: 'Cookiebot', selector: '#CybotCookiebotDialog, [id^="CybotCookiebot"]' },
        { name: 'Axeptio', selector: '#axeptio_overlay, [id^="axeptio"]' },
        { name: 'OneTrust', selector: '#onetrust-banner-sdk, #onetrust-consent-sdk' },
        { name: 'Didomi', selector: '#didomi-host, .didomi-popup-container' },
        { name: 'Quantcast', selector: '.qc-cmp2-container, #qc-cmp2-ui' },
        { name: 'Klaro', selector: '.klaro' },
        { name: 'Generic', selector: '[id*="cookie-consent"], [class*="cookie-banner"], [id*="cookie-banner"]' },
    ];
    const detected = signatures.filter((s) => document.querySelector(s.selector));
    if (detected.length === 0) {
        return { complianceLevel: 'C', comment: 'aucun bandeau de consentement detecte', detailComment: '', examples: [] };
    }
    return { complianceLevel: 'A', comment: detected.map((d) => d.name).join(', '), detailComment: '', examples: [] };
}

function checkThirdPartyCookies() {
    const host = location.hostname.replace(/^www\./, '');
    const entries = performance.getEntriesByType('resource');
    const thirdPartyDomains = new Set();
    entries.forEach((e) => {
        try {
            const h = new URL(e.name).hostname;
            const base = h.replace(/^www\./, '');
            if (base !== host && !base.endsWith('.' + host)) thirdPartyDomains.add(base);
        } catch (_) {}
    });
    if (thirdPartyDomains.size === 0) {
        return { complianceLevel: 'A', comment: 'aucun domaine tiers', detailComment: '', examples: [] };
    }
    if (thirdPartyDomains.size <= 3) {
        return { complianceLevel: 'B', comment: `${thirdPartyDomains.size} domaines tiers`, detailComment: '', examples: Array.from(thirdPartyDomains).slice(0, 5) };
    }
    return { complianceLevel: 'C', comment: `${thirdPartyDomains.size} domaines tiers (risque cookies/trackers)`, detailComment: '', examples: Array.from(thirdPartyDomains).slice(0, 5) };
}
