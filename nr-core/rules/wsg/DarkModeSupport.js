rulesManager.registerRule({
    complianceLevel: 'C',
    id: 'DarkModeSupport',
    comment: '',
    detailComment: '',

    initialize: function () {
        this.complianceLevel = 'C';
        this.comment = '';
        this.detailComment = '';
    },

    check: function () {
        if (document.querySelector('meta[name="color-scheme"]')) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_DarkModeSupport_Comment_OK');
            return;
        }
        try {
            const cs = getComputedStyle(document.documentElement).colorScheme;
            if (cs && /\b(?:dark|light\s+dark|dark\s+light|only\s+dark)\b/i.test(cs)) {
                this.complianceLevel = 'A';
                this.comment = chrome.i18n.getMessage('rule_DarkModeSupport_Comment_OK');
                return;
            }
        } catch (_) {}
        this.comment = chrome.i18n.getMessage('rule_DarkModeSupport_Comment_Missing');
    },
}, 'frameMeasuresReceived');
