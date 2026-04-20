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
        } else {
            this.comment = chrome.i18n.getMessage('rule_DarkModeSupport_Comment_Missing');
        }
    },
}, 'frameMeasuresReceived');
