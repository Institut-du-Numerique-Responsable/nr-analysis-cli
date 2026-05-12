rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'ModernImageFormats',
    comment: '',
    detailComment: '',

    check: function (measures) {
        const modernTypes = ['image/avif', 'image/webp', 'image/jxl'];
        const legacyTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
        const MODERN_EXT_RE = /\.(?:avif|webp|jxl)(?:\?|#|$)/i;
        const LEGACY_EXT_RE = /\.(?:jpe?g|png|gif|bmp)(?:\?|#|$)/i;
        let total = 0;
        let modern = 0;

        if (measures.entries && measures.entries.length) {
            measures.entries.forEach(function(entry) {
                const mime = ((entry.response.content.mimeType) || '').split(';')[0].trim();
                const url = (entry.request && entry.request.url) || '';
                const isModern = modernTypes.includes(mime) || MODERN_EXT_RE.test(url);
                const isLegacy = !isModern && (legacyTypes.includes(mime) || LEGACY_EXT_RE.test(url));
                if (isModern || isLegacy) {
                    total++;
                    if (isModern) {
                        modern++;
                    } else {
                        this.detailComment += chrome.i18n.getMessage('rule_ModernImageFormats_DetailComment', url) + '<br>';
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
