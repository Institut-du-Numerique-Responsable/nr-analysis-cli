const https = require('https');

// ISO 3166-1 alpha-2 → alpha-3 (subset covering all common CDN PoPs / hosting countries).
const ISO2_TO_ISO3 = {
    AE: 'ARE', AR: 'ARG', AT: 'AUT', AU: 'AUS', BE: 'BEL', BG: 'BGR', BR: 'BRA',
    CA: 'CAN', CH: 'CHE', CL: 'CHL', CN: 'CHN', CO: 'COL', CZ: 'CZE', DE: 'DEU',
    DK: 'DNK', EE: 'EST', EG: 'EGY', ES: 'ESP', FI: 'FIN', FR: 'FRA', GB: 'GBR',
    GR: 'GRC', HK: 'HKG', HR: 'HRV', HU: 'HUN', ID: 'IDN', IE: 'IRL', IL: 'ISR',
    IN: 'IND', IS: 'ISL', IT: 'ITA', JP: 'JPN', KE: 'KEN', KR: 'KOR', LT: 'LTU',
    LU: 'LUX', LV: 'LVA', MA: 'MAR', MX: 'MEX', MY: 'MYS', NG: 'NGA', NL: 'NLD',
    NO: 'NOR', NZ: 'NZL', PE: 'PER', PH: 'PHL', PK: 'PAK', PL: 'POL', PT: 'PRT',
    QA: 'QAT', RO: 'ROU', RS: 'SRB', RU: 'RUS', SA: 'SAU', SE: 'SWE', SG: 'SGP',
    SI: 'SVN', SK: 'SVK', TH: 'THA', TR: 'TUR', TW: 'TWN', UA: 'UKR', US: 'USA',
    VN: 'VNM', ZA: 'ZAF',
};

// CloudFront PoP IATA code → ISO-3 country (covers ~80% of x-amz-cf-pop values).
const IATA_TO_ISO3 = {
    CDG: 'FRA', MRS: 'FRA', LHR: 'GBR', MAN: 'GBR', LON: 'GBR', AMS: 'NLD',
    FRA: 'DEU', MUC: 'DEU', HAM: 'DEU', DUS: 'DEU', BER: 'DEU', VIE: 'AUT',
    ZRH: 'CHE', GVA: 'CHE', MAD: 'ESP', BCN: 'ESP', MXP: 'ITA', FCO: 'ITA',
    MIL: 'ITA', WAW: 'POL', PRG: 'CZE', BUH: 'ROU', ARN: 'SWE', OSL: 'NOR',
    HEL: 'FIN', CPH: 'DNK', DUB: 'IRL', IAD: 'USA', JFK: 'USA', EWR: 'USA',
    ORD: 'USA', DFW: 'USA', LAX: 'USA', SFO: 'USA', SEA: 'USA', MIA: 'USA',
    ATL: 'USA', BOS: 'USA', DEN: 'USA', PHX: 'USA', YUL: 'CAN', YYZ: 'CAN',
    YVR: 'CAN', NRT: 'JPN', HND: 'JPN', KIX: 'JPN', ICN: 'KOR', SIN: 'SGP',
    HKG: 'HKG', SYD: 'AUS', MEL: 'AUS', BOM: 'IND', DEL: 'IND', MAA: 'IND',
    BLR: 'IND', CCU: 'IND', HYD: 'IND', GRU: 'BRA', GIG: 'BRA', EZE: 'ARG',
    SCL: 'CHL', BOG: 'COL', MEX: 'MEX', JNB: 'ZAF', CPT: 'ZAF', DXB: 'ARE',
    AUH: 'ARE', TLV: 'ISR', IST: 'TUR',
};

function ipApiLookup(ip, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const req = https.get(
            `https://ipapi.co/${ip}/country/`,
            { timeout: timeoutMs },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    const code = (data || '').trim().toUpperCase();
                    resolve(/^[A-Z]{2}$/.test(code) ? code : null);
                });
            }
        );
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Detect datacenter ISO-3 country, in order: x-amz-cf-pop → cf-ray → ipapi.co on IPv4.
async function detectDatacenterCountry({ headers, ips, override }) {
    if (override) return override.toUpperCase();
    const h = headers || {};
    const cfPop = h['x-amz-cf-pop'];
    if (typeof cfPop === 'string') {
        const iata = cfPop.slice(0, 3).toUpperCase();
        if (IATA_TO_ISO3[iata]) return { iso3: IATA_TO_ISO3[iata], source: `x-amz-cf-pop:${iata}` };
    }
    const cfRay = h['cf-ray'];
    if (typeof cfRay === 'string') {
        const match = cfRay.match(/-([A-Z]{3})$/i);
        if (match && IATA_TO_ISO3[match[1].toUpperCase()]) {
            return { iso3: IATA_TO_ISO3[match[1].toUpperCase()], source: `cf-ray:${match[1].toUpperCase()}` };
        }
    }
    if (ips && ips.length) {
        const iso2 = await ipApiLookup(ips[0]);
        if (iso2 && ISO2_TO_ISO3[iso2]) return { iso3: ISO2_TO_ISO3[iso2], source: `ipapi:${iso2}` };
    }
    return null;
}

module.exports = { detectDatacenterCountry, ISO2_TO_ISO3, IATA_TO_ISO3 };
