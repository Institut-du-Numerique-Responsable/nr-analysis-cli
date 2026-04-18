rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'NoRenderBlockingResources',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var count = measures.renderBlockingScriptsCount || 0;
        if (count === 0) this.complianceLevel = 'A';
        else if (count <= 2) this.complianceLevel = 'B';
        else this.complianceLevel = 'C';

        if (count > 0) {
            this.comment = chrome.i18n.getMessage('rule_NoRenderBlockingResources_Comment', String(count));
        }
    }
}, 'frameMeasuresReceived');
