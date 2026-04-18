rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'ModernImageFormats',
    comment: '',
    detailComment: '',

    check: function (measures) {
        const modernTypes = ['image/webp', 'image/avif'];
        const legacyTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
        let total = 0;
        let modern = 0;

        if (measures.entries && measures.entries.length) {
            measures.entries.forEach(function(entry) {
                const mime = ((entry.response.content.mimeType) || '').split(';')[0].trim();
                if (modernTypes.includes(mime) || legacyTypes.includes(mime)) {
                    total++;
                    if (modernTypes.includes(mime)) {
                        modern++;
                    } else {
                        this.detailComment += chrome.i18n.getMessage('rule_ModernImageFormats_DetailComment', entry.request.url) + '<br>';
                    }
                }
            }, this);
        }

        if (total > 0) {
            const ratio = modern / total * 100;
            if (ratio >= 100) this.complianceLevel = 'A';
            else if (ratio >= 50) this.complianceLevel = 'B';
            else this.complianceLevel = 'C';
            this.comment = chrome.i18n.getMessage('rule_ModernImageFormats_Comment', String(Math.round(ratio * 10) / 10));
        }
    }
}, 'harReceived');
