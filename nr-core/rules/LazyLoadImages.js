rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'LazyLoadImages',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var stats = measures.lazyLoadStats;
        if (!stats || stats.total === 0) return;

        var ratio = stats.lazy / stats.total * 100;
        if (ratio >= 100) this.complianceLevel = 'A';
        else if (ratio >= 50) this.complianceLevel = 'B';
        else this.complianceLevel = 'C';

        this.comment = chrome.i18n.getMessage('rule_LazyLoadImages_Comment',
            String(Math.round(ratio * 10) / 10));

        if (stats.lazy < stats.total) {
            this.detailComment = chrome.i18n.getMessage('rule_LazyLoadImages_DetailComment',
                String(stats.total - stats.lazy));
        }
    }
}, 'frameMeasuresReceived');
