[Version française](./README.md) · [Project page](https://institut-du-numerique-responsable.github.io/nr-analysis-cli/) · [Detailed guide](./docs/guide.en.md)

# nr-analysis-cli

[![Tests](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/actions/workflows/test.yml/badge.svg)](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/actions/workflows/test.yml)
[![Version](https://img.shields.io/github/v/release/Institut-du-Numerique-Responsable/nr-analysis-cli?label=version)](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/releases)
[![License AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](./LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%E2%89%A5%2018-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![RGESN](https://img.shields.io/badge/standards-RGESN%20%C2%B7%20WSG%20%C2%B7%20RGAA-2e7d32)](./docs/guide.en.md#rules-reference)

Command-line tool that audits web pages and measures their compliance in
**eco-design**, **accessibility**, **security** and **server performance**. It
produces an HTML, Excel or InfluxDB report with prioritised recommendations.

The tool opens each page in Chromium (through Puppeteer) with the cache
disabled, runs the rules inside the page, then probes the server. It derives
from the [GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis) Chrome
extension.

## What it measures

Each page gets a score from 0 to 100 and a grade from **A** to **G** on four
independent axes:

| Axis | What is checked |
| ---- | --------------- |
| Environment | 37 eco-design rules (RGESN, GR491, Web Sustainability Guidelines) |
| Accessibility | 17 checks (12 Tanaguru / RGAA + 5 NR checks) |
| Security | 14 server checks: TLS, HTTP headers, cookies, DNSSEC… |
| Server performance | 7 checks: HTTP/2, compression, caching, CDN… |

The report also gives the EcoIndex, CO₂, water and energy per visit
(Sustainable Web Design v4 model), and a summary score.

## Installation

Requirements: [Node.js](https://nodejs.org/) 18 or later, and git. You do not
need Chrome: Puppeteer downloads its own Chromium (~150 MB) on the first
`npm install`.

```bash
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install
npm link
```

`npm link` makes the `nr` command available everywhere. Check the install:

```bash
nr --help
```

If something goes wrong (`nr: command not found`, `EACCES`, missing Chromium),
see [Common troubleshooting](./docs/guide.en.md#common-troubleshooting).

## Usage

### Audit one page

```bash
nr analyse --url https://www.example.com --language en
```

The HTML report is saved in `~/Downloads/`. Open it in a browser.

### Audit a whole site (crawl)

```bash
nr analyse --url https://www.example.com --recursive --depth 2 --max_pages 25 --language en
```

The tool follows internal links up to 2 levels deep, with a limit of 25 pages.

### Audit a list of pages

Write one URL per line in `urls.txt` (lines starting with `#` are ignored),
then:

```bash
nr analyse urls.txt --language en
```

The global report is written to `resultat/`.

### Common options

| Option | Effect |
| ------ | ------ |
| `--language en` | Report in English (default: `fr`) |
| `--format xlsx` | Excel report instead of HTML (with `--url`) |
| `--mobile` | Simulates a mobile connection |
| `--device iPhoneX` | Simulates a device (see `nr analyse --help`) |
| `--country FRA` | Visitor country, for carbon intensity (default: `FRA`) |
| `--wait_until networkidle2` | Try this when a page times out |
| `--ci` | Plain text output, no progress bar |

Every option, YAML scenarios (clicks, typing, scrolling), the InfluxDB/Grafana
export and the full rules reference are in the
[detailed user guide](./docs/guide.en.md).

## Documentation

- [Detailed user guide](./docs/guide.en.md): every option and the full rules
  reference.
- [Architecture and contributor guide](./docs/architecture.en.md): how the code
  is organised and how to add a rule.
- [Changelog](./CHANGELOG.md)
- [Security policy](./SECURITY.md)

## Contributing

Contributions are welcome, documentation fixes included. Read the
[contribution guide](./CONTRIBUTING.md): commits must be signed off with
`git commit -s` (DCO). Run `npm test` before opening a pull request.

The code in `nr-core/` is bundled into `dist/nrBundle.js`, which is injected
into the audited page. After any change to `nr-core/`, run `npm run build`
again.

## License

[AGPL-3.0-or-later](./LICENSE). Commercial use is allowed. If you offer the
tool, modified or not, as a network-accessible service, you must publish its
source code. Details in the
[guide's license section](./docs/guide.en.md#license-and-terms-of-use).

The project includes code derived from
[GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis) (© 2019
didierfred) and [EcoMeter](https://gitlab.com/ecoconceptionweb/ecometer)
(© 2016), both under AGPL-3.0.

Credits: [GreenIT.fr collective](https://collectif.greenit.fr/) and
[ecoindex.fr](https://www.ecoindex.fr/) for the EcoIndex and the rules,
[Green Web Foundation](https://www.thegreenwebfoundation.org/) for the
Sustainable Web Design v4 model. CLI integration, 2026 overhaul and summary
model: [Institut du Numérique Responsable](https://institutnr.org/).
