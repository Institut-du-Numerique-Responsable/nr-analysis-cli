rulesManager.registerRule({
    complianceLevel: 'C',
    id: 'ReducedMotion',
    comment: '',
    detailComment: '',

    initialize: function () {
        this.complianceLevel = 'C';
        this.comment = '';
        this.detailComment = '';
    },

    check: function (measures) {
        let hasMotion = false;
        let hasPreference = false;
        let unreadable = false;
        const inspectStyle = (style) => {
            if (!style) return;
            const nonzero = value => (value || '').split(',').some(x => parseFloat(x) > 0);
            if ((style.animationName && style.animationName !== 'none' && nonzero(style.animationDuration)) ||
                nonzero(style.transitionDuration) || style.scrollBehavior === 'smooth') hasMotion = true;
        };
        const inspectRules = (rules) => {
            for (const rule of rules || []) {
                // Motion in this branch is disabled when the user requests reduction.
                if (/^\s*\(prefers-reduced-motion\s*:\s*no-preference\)\s*$/i.test(rule.conditionText || '')) continue;
                if (/prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(rule.conditionText || '')) hasPreference = true;
                inspectStyle(rule.style);
                try {
                    if (rule.cssRules) inspectRules(rule.cssRules);
                    if (rule.styleSheet) inspectRules(rule.styleSheet.cssRules);
                } catch (_) { unreadable = true; }
            }
        };
        for (const sheet of document.styleSheets || []) {
            try { inspectRules(sheet.cssRules); } catch (_) { unreadable = true; }
        }
        for (const element of document.querySelectorAll('[style]')) inspectStyle(element.style);
        // CSS animations/transitions are already covered by their conditional rules.
        // Web Animations created by script still need a manual preference check.
        if (document.getAnimations && document.getAnimations().some(animation =>
            !['CSSAnimation', 'CSSTransition'].includes(animation.constructor.name))) hasMotion = true;
        const autoplay = measures.autoplayMediaCount > 0;
        if (!autoplay && hasPreference) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_ReducedMotion_Comment_OK');
        } else if (!autoplay && !hasMotion && !unreadable) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_ReducedMotion_Comment_NoMotion');
        } else {
            this.complianceLevel = !autoplay && !hasMotion && unreadable ? 'B' : 'C';
            this.comment = chrome.i18n.getMessage(unreadable && !hasMotion && !autoplay
                ? 'rule_ReducedMotion_Comment_Unknown' : 'rule_ReducedMotion_Comment_KO');
        }
    },
}, 'frameMeasuresReceived');
