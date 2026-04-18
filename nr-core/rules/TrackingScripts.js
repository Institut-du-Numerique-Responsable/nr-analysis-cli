var NR_TRACKING_DOMAINS = [
    // Google
    'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
    // Meta (Facebook/Instagram)
    'connect.facebook.net', 'facebook.net',
    // Hotjar
    'hotjar.com', 'static.hotjar.com',
    // Segment / CDP
    'segment.io', 'segment.com',
    // Product analytics
    'mixpanel.com', 'amplitude.com',
    // Customer support / chat
    'intercom.io', 'intercom.com', 'widget.intercom.io',
    'crisp.chat', 'client.crisp.chat',
    'tawk.to',
    // HubSpot
    'hs-analytics.net', 'hubspot.com', 'js.hs-scripts.com',
    // X / Twitter ads
    'analytics.twitter.com', 'static.ads-twitter.com',
    't.co',
    // LinkedIn
    'snap.licdn.com', 'px.ads.linkedin.com',
    // Microsoft
    'bat.bing.com', 'clarity.ms',
    // Matomo SaaS
    'matomo.cloud',
    // TikTok Pixel
    'analytics.tiktok.com', 'static.tiktok.com',
    // Snapchat Pixel
    'tr.snapchat.com', 'sc-static.net',
    // Pinterest Tag
    'ct.pinterest.com', 's.pinimg.com',
    // Reddit Pixel
    'alb.reddit.com', 'pixel.reddit.com',
    // Consent management platforms
    'cdn.cookielaw.org',        // OneTrust
    'consent.cookiebot.com',    // Cookiebot / Usercentrics
    // Email marketing / CRM
    'static.klaviyo.com',
    'js.brevo.com',
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
