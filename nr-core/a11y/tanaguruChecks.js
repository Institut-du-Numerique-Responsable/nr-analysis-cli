/*
 *  Lightweight WCAG 2.1 / RGAA 4 checks inspired by the Tanaguru 2020 engine
 *  (https://gitlab.tanaguru.com/open-source/tanaguru2020-engine). Re-implemented
 *  in JS to run in the Puppeteer page context. Each check returns a result with
 *  a compliance level (A = pass, B = warning, C = fail), counts and short
 *  details, aligned with the existing nr-core best-practice schema.
 */

function runTanaguruChecks() {
    const nrExtras = (typeof runNrChecks === 'function') ? runNrChecks() : {};
    const checks = Object.assign({}, nrExtras, {
        ImgAlt: checkImgAlt(),
        DocumentLanguage: checkDocumentLanguage(),
        PageTitle: checkPageTitle(),
        HeadingStructure: checkHeadingStructure(),
        FormLabel: checkFormLabel(),
        LinkText: checkLinkText(),
        ButtonName: checkButtonName(),
        Landmarks: checkLandmarks(),
        TableHeaders: checkTableHeaders(),
        ColorContrast: checkColorContrast(),
        IframeTitle: checkIframeTitle(),
        TabIndex: checkTabIndex(),
    });
    const issues = [];
    let pass = 0, warn = 0, fail = 0;
    for (const [id, r] of Object.entries(checks)) {
        if (r.complianceLevel === 'A') pass++;
        else if (r.complianceLevel === 'B') warn++;
        else fail++;
        if (r.complianceLevel !== 'A' && r.examples && r.examples.length) {
            issues.push({ id, examples: r.examples.slice(0, 5) });
        }
    }
    return { checks, summary: { pass, warn, fail, total: pass + warn + fail }, issues };
}

function pickExamples(nodes, mapper) {
    return Array.from(nodes).slice(0, 5).map(mapper);
}

function tagSnippet(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    return `<${tag}${id}${cls}>`;
}

function checkImgAlt() {
    const imgs = document.querySelectorAll('img');
    const missing = Array.from(imgs).filter((img) => {
        if (img.hasAttribute('role') && img.getAttribute('role') === 'presentation') return false;
        if (img.getAttribute('aria-hidden') === 'true') return false;
        return !img.hasAttribute('alt');
    });
    return {
        complianceLevel: missing.length === 0 ? 'A' : (missing.length <= 2 ? 'B' : 'C'),
        comment: `${missing.length}/${imgs.length}`,
        detailComment: missing.length ? `${missing.length} images sans attribut alt` : '',
        examples: pickExamples(missing, (el) => el.src || tagSnippet(el)),
    };
}

function checkDocumentLanguage() {
    const lang = document.documentElement.getAttribute('lang');
    const ok = !!(lang && lang.trim().length >= 2);
    return {
        complianceLevel: ok ? 'A' : 'C',
        comment: lang || '∅',
        detailComment: ok ? '' : 'Attribut lang manquant sur <html>',
        examples: [],
    };
}

function checkPageTitle() {
    const t = (document.title || '').trim();
    const ok = t.length >= 3 && t.length <= 150;
    return {
        complianceLevel: ok ? 'A' : 'C',
        comment: t ? `${t.length} car.` : '∅',
        detailComment: ok ? '' : 'Titre de page absent ou inadéquat',
        examples: [],
    };
}

function checkHeadingStructure() {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    if (headings.length === 0) {
        return { complianceLevel: 'C', comment: '0', detailComment: 'Aucun titre', examples: [] };
    }
    const h1Count = headings.filter((h) => h.tagName === 'H1').length;
    let levelJumps = 0;
    let last = 0;
    headings.forEach((h) => {
        const lvl = parseInt(h.tagName.substring(1), 10);
        if (last && lvl - last > 1) levelJumps++;
        last = lvl;
    });
    const ok = h1Count === 1 && levelJumps === 0;
    const warn = h1Count !== 1 || levelJumps <= 2;
    return {
        complianceLevel: ok ? 'A' : (warn ? 'B' : 'C'),
        comment: `${headings.length} h, h1=${h1Count}, sauts=${levelJumps}`,
        detailComment: ok ? '' : `h1: ${h1Count}, sauts de niveau: ${levelJumps}`,
        examples: [],
    };
}

function checkFormLabel() {
    const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
    const unlabeled = Array.from(fields).filter((f) => {
        if (f.getAttribute('aria-label')) return false;
        if (f.getAttribute('aria-labelledby')) return false;
        if (f.id && document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) return false;
        if (f.closest('label')) return false;
        if (f.getAttribute('title')) return false;
        return true;
    });
    return {
        complianceLevel: unlabeled.length === 0 ? 'A' : (unlabeled.length <= 1 ? 'B' : 'C'),
        comment: `${unlabeled.length}/${fields.length}`,
        detailComment: unlabeled.length ? `${unlabeled.length} champs sans étiquette` : '',
        examples: pickExamples(unlabeled, tagSnippet),
    };
}

function checkLinkText() {
    const links = document.querySelectorAll('a[href]');
    const bad = Array.from(links).filter((a) => {
        const text = (a.textContent || '').trim();
        const aria = a.getAttribute('aria-label') || a.getAttribute('title');
        const hasAccessibleName = text.length >= 2 || (aria && aria.trim().length >= 2)
            || a.querySelector('img[alt]:not([alt=""])');
        if (!hasAccessibleName) return true;
        const genericTerms = ['cliquez ici', 'click here', 'ici', 'here', 'en savoir plus', 'read more', 'plus'];
        return text && genericTerms.includes(text.toLowerCase());
    });
    return {
        complianceLevel: bad.length === 0 ? 'A' : (bad.length <= 3 ? 'B' : 'C'),
        comment: `${bad.length}/${links.length}`,
        detailComment: bad.length ? `${bad.length} liens sans intitulé explicite` : '',
        examples: pickExamples(bad, (a) => a.href || tagSnippet(a)),
    };
}

function checkButtonName() {
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
    const bad = Array.from(buttons).filter((b) => {
        const text = (b.textContent || b.value || '').trim();
        const aria = b.getAttribute('aria-label') || b.getAttribute('title');
        return !(text.length >= 1 || (aria && aria.trim().length >= 1));
    });
    return {
        complianceLevel: bad.length === 0 ? 'A' : (bad.length <= 1 ? 'B' : 'C'),
        comment: `${bad.length}/${buttons.length}`,
        detailComment: bad.length ? `${bad.length} boutons sans nom accessible` : '',
        examples: pickExamples(bad, tagSnippet),
    };
}

function checkLandmarks() {
    const hasMain = !!document.querySelector('main, [role="main"]');
    const hasNav = !!document.querySelector('nav, [role="navigation"]');
    const hasHeader = !!document.querySelector('header, [role="banner"]');
    const hasFooter = !!document.querySelector('footer, [role="contentinfo"]');
    const score = [hasMain, hasNav, hasHeader, hasFooter].filter(Boolean).length;
    const level = hasMain ? (score >= 3 ? 'A' : 'B') : 'C';
    return {
        complianceLevel: level,
        comment: `${score}/4`,
        detailComment: hasMain ? '' : 'Pas de <main> ou role="main"',
        examples: [],
    };
}

function checkTableHeaders() {
    const tables = document.querySelectorAll('table');
    const dataTables = Array.from(tables).filter((t) => !t.hasAttribute('role') || t.getAttribute('role') !== 'presentation');
    const bad = dataTables.filter((t) => t.querySelectorAll('th').length === 0 && t.querySelectorAll('tr').length > 1);
    return {
        complianceLevel: bad.length === 0 ? 'A' : (bad.length <= 1 ? 'B' : 'C'),
        comment: `${bad.length}/${dataTables.length}`,
        detailComment: bad.length ? `${bad.length} tableaux sans en-tête <th>` : '',
        examples: pickExamples(bad, tagSnippet),
    };
}

function checkColorContrast() {
    // Heuristic only: sample text nodes, parse rgb, compute WCAG contrast ratio
    const samples = Array.from(document.querySelectorAll('p, span, a, li, h1, h2, h3, h4, h5, h6, td, button'))
        .filter((el) => el.offsetParent !== null && (el.textContent || '').trim().length >= 2)
        .slice(0, 200);
    let lowContrast = 0;
    const bad = [];
    samples.forEach((el) => {
        const cs = window.getComputedStyle(el);
        const fg = parseColor(cs.color);
        const bg = findBackground(el);
        if (!fg || !bg) return;
        const ratio = contrastRatio(fg, bg);
        const fontSize = parseFloat(cs.fontSize) || 14;
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = fontSize >= 24 || (bold && fontSize >= 18.66);
        const threshold = large ? 3 : 4.5;
        if (ratio < threshold) {
            lowContrast++;
            if (bad.length < 5) bad.push(`${tagSnippet(el)} ratio ${ratio.toFixed(2)} < ${threshold}`);
        }
    });
    const level = lowContrast === 0 ? 'A' : (lowContrast <= 3 ? 'B' : 'C');
    return {
        complianceLevel: level,
        comment: `${lowContrast}/${samples.length}`,
        detailComment: lowContrast ? `${lowContrast} éléments avec contraste insuffisant (échantillon)` : '',
        examples: bad,
    };
}

function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    if (parts.length < 3) return null;
    const a = parts.length === 4 ? parts[3] : 1;
    if (a < 0.1) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
}

function findBackground(el) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
        const cs = window.getComputedStyle(cur);
        const c = parseColor(cs.backgroundColor);
        if (c) return c;
        cur = cur.parentElement;
    }
    return { r: 255, g: 255, b: 255 };
}

function relLuminance({ r, g, b }) {
    const toLin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(a, b) {
    const la = relLuminance(a);
    const lb = relLuminance(b);
    const [lo, hi] = la > lb ? [lb, la] : [la, lb];
    return (hi + 0.05) / (lo + 0.05);
}

function checkIframeTitle() {
    const iframes = document.querySelectorAll('iframe');
    const bad = Array.from(iframes).filter((f) => !(f.title && f.title.trim()) && !f.getAttribute('aria-label'));
    return {
        complianceLevel: bad.length === 0 ? 'A' : (bad.length <= 1 ? 'B' : 'C'),
        comment: `${bad.length}/${iframes.length}`,
        detailComment: bad.length ? `${bad.length} iframes sans title` : '',
        examples: pickExamples(bad, (f) => f.src || tagSnippet(f)),
    };
}

function checkTabIndex() {
    const positive = document.querySelectorAll('[tabindex]');
    const bad = Array.from(positive).filter((e) => parseInt(e.getAttribute('tabindex'), 10) > 0);
    return {
        complianceLevel: bad.length === 0 ? 'A' : (bad.length <= 2 ? 'B' : 'C'),
        comment: `${bad.length}`,
        detailComment: bad.length ? `${bad.length} tabindex positifs (anti-pattern)` : '',
        examples: pickExamples(bad, tagSnippet),
    };
}
