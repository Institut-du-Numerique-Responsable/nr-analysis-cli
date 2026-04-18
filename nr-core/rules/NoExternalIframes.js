rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'NoExternalIframes',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var count = measures.externalIframesCount || 0;
        if (count > 0) {
            this.complianceLevel = 'C';
            this.comment = chrome.i18n.getMessage('rule_NoExternalIframes_Comment', String(count));
            this.detailComment = chrome.i18n.getMessage('rule_NoExternalIframes_DetailComment', String(count));
        }
    }
}, 'frameMeasuresReceived');
