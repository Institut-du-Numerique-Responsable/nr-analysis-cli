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
        if (!resource || resource.type !== 'stylesheet' || !resource.content) return;
        if (this.complianceLevel === 'A') return;
        if (resource.content.includes('prefers-reduced-motion')) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_ReducedMotion_Comment_OK');
        }
    },
}, 'resourceContentReceived');
