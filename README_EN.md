[Version française](./README.md)

# nr-analysis-cli

Node.js CLI for analyzing the ecological footprint of web pages, based on the [GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis) Chrome extension.

The tool simulates running the extension on specified pages opened in Chromium via Puppeteer. The cache is disabled to ensure reliable analysis. It computes the **EcoIndex**, water consumption, GHG emissions, and checks eco-design best practices.

---

## What's new — 2026 update

This version brings a comprehensive refresh of eco-design rules and new CLI features, aligned with the state of the art of the web in 2026.

### New CLI features

| Feature | Description |
| ------- | ----------- |
| `--url <url>` | Directly analyze a URL without a YAML file — HTML report auto-saved to `~/Downloads/` |
| `--recursive` | Automatically crawl internal links from a starting URL |
| `--depth <n>` | Maximum crawl depth (default: 5) |
| `--max_pages <n>` | Maximum number of pages to crawl and analyze (default: 200) |
| `--language en` | Reports available in French and English |

### Updated eco-design rules

**8 new rules** covering modern best practices:

| Rule | What it checks |
| ---- | -------------- |
| **Modern image formats** | Detects JPEG, PNG, GIF, BMP — recommends AVIF, WebP or **JPEG XL** (supported by all major browsers as of 2026) |
| **Lazy loading for images & iframes** | Checks `loading="lazy"` on both `<img>` **and** `<iframe>` elements (native universal support) |
| **Tracking scripts** | Detects 30+ tracking domains: Google, Meta, **TikTok Pixel**, **Snapchat Pixel**, **Pinterest Tag**, **Reddit Pixel**, OneTrust, Cookiebot, Klaviyo, Brevo… |
| **Autoplay video/audio** | Flags any `<video>` or `<audio>` with the `autoplay` attribute |
| **Font optimization** | Controls font file count (≤ 2) and total weight (≤ 100 KB) |
| **Render-blocking resources** | Detects `<script>` tags in `<head>` without `async`, `defer`, or `type="module"` |
| **External iframes** | Counts iframes pointing to third-party domains |
| **Excessive preload/prefetch** | Flags more than 5 `<link rel="preload/prefetch">` directives |

**6 existing rules improved:**

| Rule | Improvement |
| ---- | ----------- |
| **Social network widgets** | X (Twitter) URLs updated, extended detection to X.com and LinkedIn badges |
| **HTTP compression** | Documentation updated (Brotli recommended over gzip) |
| **Browser plugins** | Extended to `<object>` and `<embed>` (Flash, Java, Silverlight all obsolete) |
| **Modern formats** | FR/EN locales updated to mention 2026 support for all 3 formats |
| **Lazy loading** | FR/EN locales reflect the extension to iframes |
| **Tracking** | FR/EN locales include TikTok Pixel in examples |

### Technical stack

- **Puppeteer 23.9+** — modern headless Chromium, SSL error ignore, non-headless mode
- **Node.js ES2020+** — CommonJS modules, native async/await
- **Bilingual reports** — Mustache templates, full FR/EN i18n

---

# Summary

- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Analysis](#analysis)
    - [Direct URL analysis](#direct-url-analysis)
    - [Analysis from a YAML file](#analysis-from-a-yaml-file)
      - [Input file structure](#input-file-structure)
      - [Waiting conditions](#waiting-conditions)
      - [Actions](#actions)
        - [click](#click)
        - [press](#press)
        - [scroll](#scroll)
        - [select](#select)
        - [text](#text)
    - [Recursive analysis (crawl)](#recursive-analysis-crawl)
    - [Full command reference](#full-command-reference)
    - [Report formats](#report-formats)
      - [Excel (xlsx)](#excel-xlsx)
      - [HTML](#html)
      - [InfluxDB/Grafana](#influxdbgrafana)
  - [ParseSiteMap](#parsesitemap)
  - [General flags](#general-flags)
- [Terms of use](#terms-of-use)

---

# Getting started

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)

## Installation

```bash
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install
npm link
```

`npm link` creates a global symlink so you can use `nr` directly in your terminal.

---

# Usage

## Analysis

### Direct URL analysis

The fastest way to analyze a website:

```bash
nr analyse --url https://www.example.com
```

The HTML report is automatically saved to `~/Downloads/<hostname>.html`.

Useful options with `--url`:

```bash
nr analyse --url https://www.example.com --output /tmp/report.html --format html
```

### Analysis from a YAML file

To analyze multiple pages or define complex user journeys, create a YAML file:

```bash
nr analyse url.yaml results.html
```

A sample file is available in the `samples/` folder.

#### Input file structure

The `<url_input_file>` lists URLs to analyze in YAML format.

| Parameter           | Type    | Mandatory | Description                                                          |
| ------------------- | ------- | --------- | -------------------------------------------------------------------- |
| `url`               | string  | Yes       | URL of the page to analyze                                           |
| `name`              | string  | No        | Name displayed in the report                                         |
| `waitForSelector`   | string  | No        | Wait for the HTML element defined by the CSS selector to be visible  |
| `waitForXPath`      | string  | No        | Wait for the HTML element defined by the XPath to be visible         |
| `waitForNavigation` | string  | No        | Wait for the page to finish loading. Values: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `waitForTimeout`    | int     | No        | Wait X ms                                                            |
| `screenshot`        | string  | No        | Take a screenshot of the page (even on error)                        |
| `actions`           | list    | No        | Perform a series of actions before analyzing the page                |

#### Waiting conditions

The `waitForNavigation` parameter uses Puppeteer features to detect page load completion:

- `load`: navigation is complete when the `load` event fires.
- `domcontentloaded`: navigation is complete when the `DOMContentLoaded` event fires.
- `networkidle0`: no more than 0 network connections for at least 500 ms.
- `networkidle2`: no more than 2 network connections for at least 500 ms.

By default (no `waitFor` parameter defined), the tool waits for the `load` event.

Example `url.yaml` file:

```yaml
- name: 'Home'
  url: 'https://www.example.com/'

- name: 'About'
  url: 'https://www.example.com/about'
  waitForSelector: '#main-content'
  screenshot: 'results/screenshots/about.png'

- url: 'https://www.example.com/contact'
  waitForXPath: '//h1'
```

#### Actions

Actions allow you to define a user journey before the analysis runs.

| Parameter           | Type    | Mandatory | Description                                                                |
| ------------------- | ------- | --------- | -------------------------------------------------------------------------- |
| `name`              | string  | No        | Name of the action                                                         |
| `type`              | string  | Yes       | Type: `click`, `press`, `scroll`, `select`, `text`                         |
| `element`           | string  | No        | CSS selector of the target DOM element                                     |
| `pageChange`        | boolean | No        | If `true`, the action triggers a page change. Default: `false`             |
| `timeoutBefore`     | int     | No        | Wait time before the action (ms). Default: 1000                            |
| `waitForSelector`   | string  | No        | Wait for the CSS selector to be visible after the action                   |
| `waitForXPath`      | string  | No        | Wait for the XPath to be visible after the action                          |
| `waitForNavigation` | string  | No        | Wait for the page to finish loading after the action                       |
| `waitForTimeout`    | int     | No        | Wait X ms after the action                                                 |
| `screenshot`        | string  | No        | Take a screenshot after the action (even on error)                         |

##### click

Simulates a click on a page element.

| Parameter | Type   | Mandatory | Description                        |
| --------- | ------ | --------- | ---------------------------------- |
| `element` | string | Yes       | CSS selector of the element to click |

```yaml
- name: 'Example with click'
  url: 'https://www.example.com/'
  actions:
    - name: 'Open menu'
      type: 'click'
      element: 'button[aria-label="Menu"]'
      pageChange: true
      waitForSelector: '#nav-menu'
```

##### press

Simulates pressing a keyboard key.

| Parameter | Type   | Mandatory | Description                                              |
| --------- | ------ | --------- | -------------------------------------------------------- |
| `key`     | string | Yes       | Keyboard key recognized by Puppeteer (e.g. `Enter`, `Tab`) |

```yaml
- name: 'Example with key press'
  url: 'https://www.example.com/'
  actions:
    - name: 'Submit with Enter'
      type: 'press'
      key: 'Enter'
      waitForTimeout: 1500
```

##### scroll

Simulates scrolling to the bottom of the page.

```yaml
- name: 'Page with scroll'
  url: 'https://www.example.com/'
  actions:
    - name: 'Auto scroll to bottom'
      type: 'scroll'
```

##### select

Simulates selecting values from a dropdown list.

| Parameter | Type   | Mandatory | Description                          |
| --------- | ------ | --------- | ------------------------------------ |
| `element` | string | Yes       | CSS selector of the `<select>`       |
| `values`  | list   | Yes       | List of values to select             |

```yaml
- name: 'Example with select'
  url: 'https://www.example.com/'
  actions:
    - name: 'Choose a category'
      type: 'select'
      element: '#category'
      values: ['technology']
```

##### text

Simulates typing text into a form field.

| Parameter | Type   | Mandatory | Description                      |
| --------- | ------ | --------- | -------------------------------- |
| `element` | string | Yes       | CSS selector of the input field  |
| `content` | string | Yes       | Text to type                     |

```yaml
- name: 'Contact form'
  url: 'https://www.example.com/contact'
  actions:
    - name: 'Enter email'
      type: 'text'
      element: '#email'
      content: 'test@example.com'
      timeoutBefore: 1000
```

### Recursive analysis (crawl)

The tool can automatically crawl internal links from a starting URL:

```bash
nr analyse --url https://www.example.com --recursive --depth 3 --max_pages 50
```

| Option        | Description                                             | Default |
| ------------- | ------------------------------------------------------- | ------- |
| `--recursive` | Enable recursive crawl of internal links (requires `--url`) | false   |
| `--depth`     | Maximum crawl depth                                     | 5       |
| `--max_pages` | Maximum number of pages to crawl and analyze            | 200     |

### Full command reference

```
nr analyse [url_input_file] [report_output_file] [options]
```

**Positional parameters:**

| Parameter            | Description                                   | Default         |
| -------------------- | --------------------------------------------- | --------------- |
| `url_input_file`     | Path to the YAML file listing URLs to analyze | `url.yaml`      |
| `report_output_file` | Path to the output report file                | `results.xlsx`  |

**Options:**

| Option                | Alias | Description                                                               | Default   |
| --------------------- | ----- | ------------------------------------------------------------------------- | --------- |
| `--url`               |       | URL to analyze directly (bypasses the YAML file)                          |           |
| `--output`            | `-o`  | Report output path (used with `--url`)                                    |           |
| `--format`            | `-f`  | Report format: `xlsx`, `html`, `influxdb`, `influxdbhtml`                 |           |
| `--device`            | `-d`  | Device to emulate                                                         | `desktop` |
| `--headers`           | `-h`  | Path to a YAML file with HTTP headers                                     |           |
| `--headless`          |       | Browser headless mode (`true`/`false`)                                    | `true`    |
| `--language`          |       | Report language (`fr`, `en`)                                              | `fr`      |
| `--login`             | `-l`  | Path to a YAML login configuration file                                   |           |
| `--max_tab`           |       | Number of URLs analyzed in parallel                                       | `40`      |
| `--mobile`            |       | Mobile (`true`) or wired (`false`) connection                             | `false`   |
| `--proxy`             | `-p`  | Path to a YAML proxy configuration file                                   |           |
| `--retry`             | `-r`  | Number of additional attempts on failure                                  | `2`       |
| `--timeout`           | `-t`  | URL load timeout (ms)                                                     | `180000`  |
| `--worst_pages`       |       | Number of priority pages shown in the summary                             | `5`       |
| `--worst_rules`       |       | Number of priority rules shown in the summary                             | `5`       |
| `--recursive`         |       | Recursive crawl of internal links (requires `--url`)                      | `false`   |
| `--depth`             |       | Maximum crawl depth                                                       | `5`       |
| `--max_pages`         |       | Maximum number of pages to crawl and analyze                              | `200`     |
| `--grafana_link`      |       | Grafana dashboard URL (for `influxdbhtml` format)                         |           |
| `--influxdb_hostname` |       | InfluxDB instance URL                                                     |           |
| `--influxdb_org`      |       | InfluxDB organization name                                                |           |
| `--influxdb_token`    |       | InfluxDB connection token                                                 |           |
| `--influxdb_bucket`   |       | InfluxDB bucket                                                           |           |

**Supported devices (`--device`):**

`desktop`, `galaxyS9`, `galaxyS20`, `iPhone8`, `iPhone8Plus`, `iPhoneX`, `iPad`

**Example `headers.yaml`:**

```yaml
accept: 'text/html,application/xhtml+xml,application/xml'
accept-encoding: 'gzip, deflate, br'
accept-language: 'en-US,en;q=0.9'
```

**Example `login.yaml`:**

```yaml
url: 'https://www.example.com/login'
fields:
  - selector: '#username'
    value: mylogin
  - selector: '#password'
    value: mypassword
loginButtonSelector: '#btn-login'
waitForTimeout: 2000
```

**Example `proxy.yaml`:**

```yaml
server: '<host>:<port>'
user: '<username>'
password: '<password>'
```

### Report formats

#### Excel (xlsx)

```bash
nr analyse url.yaml results.xlsx
# or
nr analyse url.yaml results --format xlsx
```

The Excel report contains:
- A global tab: average EcoIndex, priority pages and rules to fix.
- A tab per URL: EcoIndex, water/GHG indicators, best practices table.

![Global tab](./docs/rapport-xlsx-global.png)
![Page tab](./docs/rapport-xlsx-detail-page.png)

#### HTML

```bash
nr analyse url.yaml results.html
# or
nr analyse --url https://www.example.com --format html
```

The HTML report contains:
- A summary page: number of scenarios, errors, summary table, non-compliant best practices.
- One page per scenario: HTTP requests, page size/weight, EcoIndex, water, GHG, best practices.

![Global page](./docs/rapport-html-global.jpeg)
![Scenario page](./docs/rapport-html-detail-page.jpeg)
![Scenario page with page change](./docs/rapport-html-detail-page-avec-changement-page.jpeg)

#### InfluxDB/Grafana

Sends data to an InfluxDB instance for visualization in Grafana:

```bash
nr analyse url.yaml --format influxdb \
  --influxdb_hostname http://localhost:8086 \
  --influxdb_org my-org \
  --influxdb_token my-token \
  --influxdb_bucket my-bucket
```

To simultaneously generate an HTML report with a Grafana link:

```bash
nr analyse url.yaml results.html --format influxdbhtml \
  --influxdb_hostname http://localhost:8086 \
  --influxdb_org my-org \
  --influxdb_token my-token \
  --influxdb_bucket my-bucket \
  --grafana_link http://localhost:3000/d/YoK0Xjb4k/nr-analysis
```

![Grafana dashboard](./docs/grafana-dashboard.png)
![HTML report with InfluxDB](./docs/rapport-html-global-avec-influxdb.jpeg)

---

## ParseSiteMap

Converts an XML sitemap into a YAML file usable by `nr analyse`:

```bash
nr parseSitemap https://www.example.com/sitemap.xml url.yaml
```

| Parameter          | Description                          | Default    |
| ------------------ | ------------------------------------ | ---------- |
| `sitemap_url`      | URL of the sitemap to convert        | *(required)* |
| `yaml_output_file` | Path to the generated YAML file      | `url.yaml` |

## General flags

| Flag   | Description                                              |
| ------ | -------------------------------------------------------- |
| `--ci` | Disables the progress bar for CI/CD environments         |

---

# Terms of use

This tool relies on the GreenIT-Analysis extension API which **does not allow commercial use**.
