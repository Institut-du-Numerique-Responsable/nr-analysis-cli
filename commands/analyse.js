const fs = require('fs');
const os = require('os');
const path = require('path');
const YAML = require('yaml');
const puppeteer = require('puppeteer');
const { createJsonReports, login } = require('../cli-core/analysis.js');
const { create_global_report } = require('../cli-core/reportGlobal.js');
const { create_XLSX_report } = require('../cli-core/reportExcel.js');
const { create_html_report } = require('../cli-core/reportHtml.js');
const { write: writeToInflux } = require('../cli-core/influxdb');
const { translator } = require('../cli-core/translator.js');

function parseYamlFile(filepath, optionLabel) {
    try {
        return YAML.parse(fs.readFileSync(filepath).toString());
    } catch (error) {
        throw ` ${optionLabel} : "${filepath}" is not a valid YAML file: ${error.code} at ${JSON.stringify(error.linePos)}.`;
    }
}

async function extractInternalLinks(browser, url, origin) {
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return await page.evaluate(
            (origin) =>
                [...document.querySelectorAll('a[href]')]
                    .map((a) => a.href)
                    .filter((href) => href.startsWith(origin)),
            origin
        );
    } catch {
        return [];
    } finally {
        await page.close();
    }
}

async function crawlUrls(browser, startUrl, maxDepth, maxPages) {
    const origin = new URL(startUrl).origin;
    const visited = new Set();
    const queue = [{ url: startUrl, depth: 0 }];
    const result = [];

    while (queue.length > 0 && result.length < maxPages) {
        const { url, depth } = queue.shift();
        if (visited.has(url)) continue;
        visited.add(url);
        result.push({ url });

        if (depth < maxDepth) {
            const links = await extractInternalLinks(browser, url, origin);
            for (const link of links) {
                if (!visited.has(link)) {
                    queue.push({ url: link, depth: depth + 1 });
                }
            }
        }
    }

    console.log(`Crawl terminé : ${result.length} page(s) trouvée(s).`);
    return result;
}

async function analyse_core(options) {
    // Resolve output file (--output overrides the positional argument)
    if (options.output) {
        options.report_output_file = options.output;
    }

    if (options.recursive && !options.url) {
        throw '--recursive nécessite --url pour définir le point de départ du crawl.';
    }

    // Determine the list of pages to analyse
    let pagesInformations;
    if (options.url) {
        if (!options.output) {
            const hostname = new URL(options.url).hostname.replace(/^www\./, '');
            const ext = options.format === 'xlsx' ? 'xlsx' : 'html';
            options.report_output_file = path.join(os.homedir(), 'Downloads', `${hostname}.${ext}`);
        }
        if (!options.format) options.format = 'html';
        pagesInformations = [{ url: options.url }];
    } else {
        const URL_YAML_FILE = path.resolve(options.url_input_file);
        pagesInformations = parseYamlFile(URL_YAML_FILE, 'url_input_file');
    }

    const browserArgs = [
        '--no-sandbox', // required to run in Docker
        '--disable-setuid-sandbox', // known security trade-off
    ];

    // Proxy configuration
    let proxy = {};
    if (options.proxy) {
        proxy = readProxy(options.proxy);
        browserArgs.push(`--proxy-server=${proxy.server}`);
        if (proxy.bypass) {
            browserArgs.push(`--proxy-bypass-list=${proxy.bypass}`);
        }
    }

    const headers = options.headers ? readHeaders(options.headers) : undefined;

    const reportFormat = getReportFormat(options.format, options.report_output_file);
    if (!reportFormat) {
        throw 'Format not supported. Use --format option or report file extension to define a supported extension.';
    }

    const browser = await puppeteer.launch({
        headless: options.headless === false ? false : 'new',
        args: browserArgs,
        // Keep GPU horsepower in headless mode
        ignoreDefaultArgs: ['--disable-gpu'],
        ignoreHTTPSErrors: true,
    });

    translator.setLocale(options.language);

    let reports;
    try {
        if (options.login) {
            const LOGIN_YAML_FILE = path.resolve(options.login);
            const loginInfos = parseYamlFile(LOGIN_YAML_FILE, '--login');
            await login(browser, loginInfos, options);
        }
        if (options.recursive) {
            pagesInformations = await crawlUrls(browser, options.url, options.depth, options.max_pages);
        }
        reports = await createJsonReports(browser, pagesInformations, options, proxy, headers, translator);
    } finally {
        await browser.close();
    }

    const reportObj = await create_global_report(reports, { ...options, proxy }, translator);
    switch (reportFormat) {
        case 'influxdbhtml':
            await writeToInflux(reports, options);
            await create_html_report(reportObj, options, translator, true);
            break;
        case 'html':
            await create_html_report(reportObj, options, translator, false);
            break;
        case 'influxdb':
            await writeToInflux(reports, options);
            break;
        default:
            await create_XLSX_report(reportObj, options, translator);
    }
}

function readProxy(proxyFile) {
    const PROXY_FILE = path.resolve(proxyFile);
    const proxy = parseYamlFile(PROXY_FILE, 'proxy_config_file');
    if (!proxy.server || !proxy.user || !proxy.password) {
        throw `proxy_config_file : Bad format "${PROXY_FILE}". Expected server, user and password.`;
    }
    return proxy;
}

function readHeaders(headersFile) {
    return parseYamlFile(path.resolve(headersFile), '--headers');
}

const SUPPORTED_FORMATS = ['xlsx', 'html', 'influxdb', 'influxdbhtml'];

function getReportFormat(format, filename) {
    if (format && SUPPORTED_FORMATS.includes(format.toLowerCase())) {
        return format.toLowerCase();
    }

    // Fall back to the output file extension
    const filenameLC = filename.toLowerCase();
    const extensionFormat = SUPPORTED_FORMATS.find((f) => filenameLC.endsWith(`.${f}`));
    if (extensionFormat) {
        console.log(`No output format specified, defaulting to ${extensionFormat} based on output file name.`);
    }
    return extensionFormat;
}

function analyse(options) {
    analyse_core(options).catch((e) => console.error('ERROR : \n', e));
}

module.exports = analyse;
