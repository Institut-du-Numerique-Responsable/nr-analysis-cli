var NR_TRACKING_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
    'connect.facebook.net', 'facebook.net',
    'hotjar.com', 'static.hotjar.com',
    'segment.io', 'segment.com',
    'mixpanel.com', 'amplitude.com',
    'intercom.io', 'intercom.com', 'widget.intercom.io',
    'crisp.chat', 'client.crisp.chat',
    'tawk.to',
    'hs-analytics.net', 'hubspot.com', 'js.hs-scripts.com',
    'analytics.twitter.com', 'static.ads-twitter.com',
    'snap.licdn.com', 'px.ads.linkedin.com',
    'bat.bing.com', 'clarity.ms',
    'matomo.cloud',
];

rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'TrackingScripts',
    comment: '',
    detailComment: '',

    check: function (measures) {
        var detected = new Set();

        if (measures.entries && measures.entries.length) {
            measures.entries.forEach(function(entry) {
                var url = entry.request.url || '';
                NR_TRACKING_DOMAINS.forEach(function(domain) {
                    if (!detected.has(domain) && url.includes(domain)) {
                        detected.add(domain);
                        this.detailComment += chrome.i18n.getMessage('rule_TrackingScripts_DetailComment', domain) + '<br>';
                    }
                }, this);
            }, this);
        }

        var count = detected.size;
        if (count === 0) {
            this.complianceLevel = 'A';
        } else {
            this.complianceLevel = count === 1 ? 'B' : 'C';
            this.comment = chrome.i18n.getMessage('rule_TrackingScripts_Comment', String(count));
        }
    }
}, 'harReceived');
