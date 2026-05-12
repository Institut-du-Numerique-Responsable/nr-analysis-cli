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

    check: function (measures, resource) {
        if (this.complianceLevel === 'A') return;
        if (resource && resource.type === 'stylesheet' && resource.content && resource.content.includes('prefers-reduced-motion')) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_ReducedMotion_Comment_OK');
            return;
        }
        try {
            const sheets = document.styleSheets || [];
            for (let i = 0; i < sheets.length; i++) {
                let rules;
                try { rules = sheets[i].cssRules; } catch (_) { continue; }
                if (!rules) continue;
                for (let j = 0; j < rules.length; j++) {
                    const r = rules[j];
                    if (r.type === CSSRule.MEDIA_RULE && r.conditionText && r.conditionText.includes('prefers-reduced-motion')) {
                        this.complianceLevel = 'A';
                        this.comment = chrome.i18n.getMessage('rule_ReducedMotion_Comment_OK');
                        return;
                    }
                }
            }
        } catch (_) {}
    },
}, 'resourceContentReceived');
