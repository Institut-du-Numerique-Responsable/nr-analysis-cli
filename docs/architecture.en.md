[Version française](./architecture.md) · [Back to the README](../README_EN.md)

# Architecture and contributor guide

This document explains how the project is laid out and how to add code to it.
It complements [CONTRIBUTING.md](../CONTRIBUTING.md), which covers the DCO and
the pull request process.

## 1. Two halves of the code, two environments

The code is split in two halves that do not run in the same place.

| Directory | Runs where | Can use `require()` | DOM access |
| --------- | ---------- | ------------------- | ---------- |
| `nr-core/` | inside the audited page, injected by Puppeteer | no | yes |
| `cli-core/`, `commands/` | in Node.js | yes | no |

`nr-core/` is never loaded as is. The `builder.js` script concatenates all of
its files into a single `dist/nrBundle.js` bundle, and Puppeteer injects that
bundle into the page.

> **Change `nr-core/`, rebuild the bundle. Skip the rebuild and your code never
> runs.**

```bash
npm run build   # regenerates dist/nrBundle.js
```

The build also runs automatically on `npm install`, through the `postinstall`
hook. `dist/` is gitignored: the bundle is never committed.

Since `nr-core/` has no module system, everything in it is global. Files talk to
each other through global variables (`rulesManager`, `har`, `resources`) and the
concatenation order matters. It is set in `builder.js`: `analyseFrameCore.js`,
then `utils.js`, `rulesManager.js`, the rules, the WSG rules, the accessibility
checks, and finally `greenpanel.js`.

## 2. What happens during an analysis

```
nr analyse --url https://example.org
  │
  ├─ nr                       yargs declaration of commands and options
  ├─ commands/analyse.js      resolves input/output, crawls when --recursive,
  │                           launches Chromium, picks the report format
  │
  └─ cli-core/analysis.js     for each page:
       ├─ opens a tab, applies --device, --headers, --proxy
       ├─ disables cache and service worker (otherwise transfer size is wrong)
       ├─ plays the YAML scenario actions (click, text, scroll, select, press)
       ├─ captures the HAR (puppeteer-har) and the resource tree (CDP)
       ├─ injects a fake `chrome.i18n` object backed by the translation catalog
       ├─ injects dist/nrBundle.js, calls launchAnalyse(), removes the script
       ├─ queries external services: co2Client.js, geoLookup.js
       └─ audits the server outside the browser: serverAudit.js
  │
  ├─ cli-core/scoring.js, socialScoring.js, auditScoring.js, synthetic.js
  │                           compute the four axis scores and the synthetic score
  ├─ cli-core/reportGlobal.js aggregates pages, ranks worst pages and worst rules
  └─ reportHtml.js | reportExcel.js | influxdb.js  produce the output
```

The output format comes from `--format`, or is inferred from the output file
extension. The four accepted values are `xlsx`, `html`, `influxdb` and
`influxdbhtml` (`getReportFormat` in `commands/analyse.js`).

## 3. File map

### Root

| File | Role |
| ---- | ---- |
| `nr` | binary declared in `package.json` (`bin.nr`). Declares the `analyse` and `parseSitemap` commands and every yargs option |
| `builder.js` | concatenates `nr-core/**` into `dist/nrBundle.js` |
| `sizes.js` | device profiles for `--device`: `desktop`, `galaxyS9`, `galaxyS20`, `iPhone8`, `iPhone8Plus`, `iPhoneX`, `iPad` |
| `conf/rules.js` | rule registry: `bestPractice`, `priority`, `effort`, `impact`, `wsgCategory`, `wsgId` |

### `cli-core/`: Node-side orchestration

| File | What it exposes |
| ---- | --------------- |
| `analysis.js` | `createJsonReports`, `login`. Tab handling, HAR, bundle injection |
| `reportGlobal.js` | `create_global_report`: multi-page aggregation, worst pages, worst rules |
| `reportHtml.js` | HTML report, Mustache templates in `cli-core/template/` |
| `reportExcel.js` | XLSX report through exceljs |
| `influxdb.js` | `write`: pushes series to InfluxDB |
| `scoring.js` | `computeScore`, `scoreToGrade` for the environment axis |
| `socialScoring.js` | `computeSocialScore`, `CHECK_WEIGHTS` for the accessibility axis |
| `auditScoring.js` | `computeSecurityScore`, `computeServerScore` for the cyber and performance axes |
| `synthetic.js` | `computeSynthetic`, `buildRecommendations`: score combining EcoIndex and SWDM v4 |
| `co2Client.js` | `checkGreenHosting`, `computeCo2`, `computeEcoIndexImpact`, backed by `@tgwf/co2` |
| `geoLookup.js` | `detectDatacenterCountry` from CDN headers and IP geolocation, ISO2 to ISO3 and IATA to ISO3 tables |
| `serverAudit.js` | `auditServer`, `SEVERITY`, `getSeverity`: TLS, security headers, DNS |
| `checkDescriptions.js` | `DESCRIPTIONS`: labels for server and accessibility checks |
| `translator.js` | `translator`, backed by `locales/fr.json` and `locales/en.json` |
| `utils.js` | progress bar and Node helpers |

### `nr-core/`: code injected into the page

| File | Role |
| ---- | ---- |
| `analyseFrameCore.js` | bundle entry point, collects frame measures |
| `rulesManager.js` | `registerRule`, rule instantiation and event-driven execution |
| `greenpanel.js` | aggregates rule results into the object returned to Node |
| `ecoIndex.js` | EcoIndex computation from DOM, requests and payload |
| `utils.js` | browser helpers shared by the rules |
| `rules/*.js` | 32 eco-design rules, one per file |
| `rules/wsg/*.js` | 5 rules from the Web Sustainability Guidelines |
| `a11y/tanaguruChecks.js` | 12 Tanaguru and RGAA checks |
| `a11y/nrChecks.js` | 5 additional INR accessibility checks |

## 4. Adding an eco-design rule

A rule is declared in five places. Miss one and the rule never runs, or it runs
without a readable label in the report.

**Step 1. Create the file.** In `nr-core/rules/` for an NR rule, in
`nr-core/rules/wsg/` for a rule mapped to the Web Sustainability Guidelines. The
file name must be exactly the rule identifier.

```js
// nr-core/rules/MyNewRule.js
rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'MyNewRule',
    comment: '',
    detailComment: '',

    check: function (measures) {
        // measures holds everything collected in the page
        if (ideal_condition) this.complianceLevel = 'A';
        else if (acceptable_condition) this.complianceLevel = 'B';
        else this.complianceLevel = 'C';

        this.comment = chrome.i18n.getMessage('rule_MyNewRule_Comment', String(value));
    },
}, 'frameMeasuresReceived');
```

The second argument of `registerRule` is the event that triggers the rule:
`frameMeasuresReceived` (DOM measures), `harReceived` (network analysis) or
`resourceContentReceived` (content of one resource). A rule may also define an
`initialize()` method, called before the first check.

The three compliance levels are `A` (rule met), `B` (minor improvement) and
`C` (rule not met).

**Step 2. Register the rule in `conf/rules.js`.**

```js
{ bestPractice: 'MyNewRule', priority: 4, effort: 3, impact: 4, wsgCategory: 'NR', wsgId: 'WD14' },
```

`priority`, `effort` and `impact` are rated from 1 to 9 and feed both the score
weighting and the ranking of recommendations. `wsgId` is optional for a rule
with no WSG counterpart.

**Step 3. Add the translations** to `locales/fr.json` and `locales/en.json`.
Four keys per rule, all prefixed with `rule_`:

| Key | Content |
| --- | ------- |
| `rule_MyNewRule` | short label, shown in tables |
| `rule_MyNewRule_DetailDescription` | long explanation, shown in the detailed report |
| `rule_MyNewRule_Comment` | parameterised comment, `%s` is replaced by the values passed to `getMessage` |
| `rule_MyNewRule_DetailComment` | detailed comment, parameterised the same way |

Both catalogs must stay in sync: a key missing from `en.json` breaks the English
report rendering.

**Step 4. Rebuild the bundle** with `npm run build`.

**Step 5. Document the rule** in the reference table, "Rules reference" section
of `README.md` and `README_EN.md`, updating the rule count stated at the top of
the section.

## 5. Adding a server, accessibility or security check

Server checks do not go through the browser. They live in
`cli-core/serverAudit.js`, are scored by `cli-core/auditScoring.js`, and their
labels are in `cli-core/checkDescriptions.js`.

Accessibility checks run in the page, in `nr-core/a11y/tanaguruChecks.js` and
`nr-core/a11y/nrChecks.js`. They are weighted by `CHECK_WEIGHTS` in
`cli-core/socialScoring.js` and, like the rules, require a `npm run build`.

## 6. Verifying a change

The project has no automated test suite yet: `npm test` fails by design. Before
opening a pull request, do at least this:

```bash
npm run build
./nr analyse --url https://institutnr.org --format html
```

Then open the report produced in `~/Downloads/` and confirm that the modified
rule or check shows up, with a translated label and a consistent compliance
level. To validate both languages, run it again with `--language en`.

A multi-page run can be checked with the sample list shipped in the repository:

```bash
./nr analyse urls.txt
```

The report then lands in `resultat/` at the repository root.

## 7. Conventions

- Formatting is handled by Prettier, configured in `.prettierrc`: 4-space
  indentation, single quotes, semicolons, `es5` trailing commas.
- `.editorconfig` sets UTF-8 encoding, 4-space indentation (2 for YAML) and a
  120-character line length.
- CommonJS throughout, no ESM. Node 18 or newer.
- The AGPL copyright headers in `nr-core/` come from GreenIT-Analysis and
  EcoMeter. They must be kept as they are.

## 8. Known pitfalls

- The injected bundle is named `dist/nrBundle.js`, but the filter that discards
  network requests generated by the analysis itself, in
  `isNetworkEventGeneratedByAnalysis` (`cli-core/analysis.js`), still tests the
  historical name `greenItBundle.js`. The filter therefore discards nothing.
- Puppeteer runs with `--no-sandbox`, which is required inside a container. It
  is an accepted security trade-off and should not be reproduced on untrusted
  pages outside an isolated environment.
- `dist/`, `results/`, `resultat/`, `*.xlsx`, `*.yaml` and `urls-*.txt` are
  gitignored. Only `urls.txt` is committed, as an example.
- The `master` branch on the remote is historical and frozen. Development
  happens on `main`.
