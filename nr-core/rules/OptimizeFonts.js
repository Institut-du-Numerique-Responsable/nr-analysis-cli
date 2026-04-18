rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'OptimizeFonts',
    comment: '',
    detailComment: '',
    fontCount: 0,
    totalFontSizeKo: 0,

    initialize: function () {
        this.fontCount = 0;
        this.totalFontSizeKo = 0;
        this.detailComment = '';
    },

    check: function (measures) {
        const fontMimes = ['font/woff2', 'font/woff', 'font/ttf', 'font/otf',
            'application/font-woff', 'application/font-woff2', 'application/x-font-ttf'];
        const fontExtRe = /\.(woff2?|ttf|otf|eot)(\?|$)/i;

        if (measures.entries && measures.entries.length) {
            measures.entries.forEach(function(entry) {
                const mime = ((entry.response.content.mimeType) || '').split(';')[0].trim();
                const url = entry.request.url || '';
                if (fontMimes.includes(mime) || fontExtRe.test(url)) {
                    this.fontCount++;
                    const sizeKo = Math.round((entry.response.content.size || 0) / 1000);
                    this.totalFontSizeKo += sizeKo;
                    this.detailComment += chrome.i18n.getMessage('rule_OptimizeFonts_DetailComment', [url, String(sizeKo)]) + '<br>';
                }
            }, this);
        }

        if (this.fontCount > 0) {
            const goodCount = this.fontCount <= 2;
            const goodSize  = this.totalFontSizeKo <= 100;
            const medCount  = this.fontCount <= 4;
            const medSize   = this.totalFontSizeKo <= 200;

            if (goodCount && goodSize) this.complianceLevel = 'A';
            else if (medCount || medSize) this.complianceLevel = 'B';
            else this.complianceLevel = 'C';

            this.comment = chrome.i18n.getMessage('rule_OptimizeFonts_Comment',
                [String(this.fontCount), String(this.totalFontSizeKo)]);
        }
    }
}, 'harReceived');
