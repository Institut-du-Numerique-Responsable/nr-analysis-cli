rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'NoAutoplayVideo',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var count = measures.autoplayMediaCount || 0;
        if (count > 0) {
            this.complianceLevel = 'C';
            this.comment = chrome.i18n.getMessage('rule_NoAutoplayVideo_Comment', String(count));
            this.detailComment = chrome.i18n.getMessage('rule_NoAutoplayVideo_DetailComment', String(count));
        }
    }
}, 'frameMeasuresReceived');
