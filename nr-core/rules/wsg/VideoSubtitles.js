rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'VideoSubtitles',
    comment: '',
    detailComment: '',

    initialize: function () {
        this.complianceLevel = 'A';
        this.comment = '';
        this.detailComment = '';
    },

    check: function () {
        const videos = document.querySelectorAll('video');
        if (videos.length === 0) return;

        let missing = 0;
        videos.forEach((video) => {
            const hasCaptions = video.querySelector('track[kind="captions"], track[kind="subtitles"]');
            if (!hasCaptions) {
                missing++;
                this.detailComment += chrome.i18n.getMessage(
                    'rule_VideoSubtitles_DetailComment',
                    video.src || video.currentSrc || 'video'
                ) + '<br>';
            }
        });

        if (missing === 0) {
            this.complianceLevel = 'A';
            this.comment = chrome.i18n.getMessage('rule_VideoSubtitles_Comment_OK', String(videos.length));
        } else if (missing < videos.length) {
            this.complianceLevel = 'B';
            this.comment = chrome.i18n.getMessage('rule_VideoSubtitles_Comment', String(missing));
        } else {
            this.complianceLevel = 'C';
            this.comment = chrome.i18n.getMessage('rule_VideoSubtitles_Comment', String(missing));
        }
    },
}, 'frameMeasuresReceived');
