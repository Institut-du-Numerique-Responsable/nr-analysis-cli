rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'NoExcessivePreload',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var count = measures.preloadCount || 0;
        if (count <= 5) this.complianceLevel = 'A';
        else if (count <= 10) this.complianceLevel = 'B';
        else this.complianceLevel = 'C';

        if (count > 0) {
            this.comment = chrome.i18n.getMessage('rule_NoExcessivePreload_Comment', String(count));
        }
    }
}, 'frameMeasuresReceived');
