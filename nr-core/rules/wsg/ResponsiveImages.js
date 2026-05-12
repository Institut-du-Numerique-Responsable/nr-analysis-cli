rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'ResponsiveImages',
    comment: '',
    detailComment: '',

    initialize: function () {
        this.complianceLevel = 'A';
        this.comment = '';
        this.detailComment = '';
    },

    check: function () {
        const images = document.querySelectorAll('img');
        if (images.length === 0) return;

        let total = 0;
        let withSrcset = 0;

        images.forEach((img) => {
            if (img.width < 100) return;
            total++;
            const picture = img.closest && img.closest('picture');
            const pictureHasSrcset = picture && picture.querySelector('source[srcset]');
            if (img.srcset || img.sizes || pictureHasSrcset) {
                withSrcset++;
            } else {
                this.detailComment += chrome.i18n.getMessage(
                    'rule_ResponsiveImages_DetailComment',
                    img.src || ''
                ) + '<br>';
            }
        });

        if (total === 0) return;

        const ratio = (withSrcset / total) * 100;
        this.complianceLevel = ratio >= 100 ? 'A' : ratio >= 50 ? 'B' : 'C';
        this.comment = chrome.i18n.getMessage('rule_ResponsiveImages_Comment', String(Math.round(ratio)));
    },
}, 'frameMeasuresReceived');
