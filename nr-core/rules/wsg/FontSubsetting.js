rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'FontSubsetting',
    comment: '',
    detailComment: '',
    _fontFaceCount: 0,
    _subsettedCount: 0,

    initialize: function () {
        this.complianceLevel = 'A';
        this.comment = '';
        this.detailComment = '';
        this._fontFaceCount = 0;
        this._subsettedCount = 0;
    },

    check: function (measures, resource) {
        if (!resource || resource.type !== 'stylesheet' || !resource.content) return;

        const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
        let match;
        while ((match = fontFaceRegex.exec(resource.content)) !== null) {
            this._fontFaceCount++;
            if (match[1].includes('unicode-range')) {
                this._subsettedCount++;
            } else {
                this.detailComment += chrome.i18n.getMessage(
                    'rule_FontSubsetting_DetailComment',
                    resource.url || ''
                ) + '<br>';
            }
        }

        if (this._fontFaceCount === 0) return;

        const ratio = (this._subsettedCount / this._fontFaceCount) * 100;
        this.complianceLevel = ratio >= 100 ? 'A' : ratio >= 50 ? 'B' : 'C';
        this.comment = chrome.i18n.getMessage(
            'rule_FontSubsetting_Comment',
            String(this._fontFaceCount - this._subsettedCount)
        );
    },
}, 'resourceContentReceived');
