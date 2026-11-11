[English version](./README_EN.md) · [Page projet](https://institut-du-numerique-responsable.github.io/nr-analysis-cli/) · [Guide détaillé](./docs/guide.md)

# nr-analysis-cli

[![Tests](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/actions/workflows/test.yml/badge.svg)](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/actions/workflows/test.yml)
[![Version](https://img.shields.io/github/v/release/Institut-du-Numerique-Responsable/nr-analysis-cli?label=version)](https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/releases)
[![Licence AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0--or--later-blue)](./LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%E2%89%A5%2018-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![RGESN](https://img.shields.io/badge/r%C3%A9f%C3%A9rentiel-RGESN%20%C2%B7%20WSG%20%C2%B7%20RGAA-2e7d32)](./docs/guide.md#référentiel-des-règles-évaluées)

Outil en ligne de commande qui audite des pages web et mesure leur niveau de
conformité en **éco-conception**, **accessibilité**, **sécurité** et
**performance serveur**. Il produit un rapport HTML, Excel ou InfluxDB, avec
des recommandations priorisées.

L'outil ouvre chaque page dans Chromium (via Puppeteer), cache désactivé,
exécute les règles dans la page puis interroge le serveur. Il dérive de
l'extension Chrome [GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis).

## Ce que mesure l'outil

Chaque page reçoit une note de 0 à 100 et un grade de **A** à **G** sur quatre
axes indépendants :

| Axe | Ce qui est vérifié |
| --- | ------------------ |
| Environnement | 37 règles d'éco-conception (RGESN, GR491, Web Sustainability Guidelines) |
| Accessibilité | 17 contrôles (12 Tanaguru / RGAA + 5 contrôles NR) |
| Sécurité | 14 contrôles serveur : TLS, en-têtes HTTP, cookies, DNSSEC… |
| Performance serveur | 7 contrôles : HTTP/2, compression, cache, CDN… |

Le rapport donne aussi l'EcoIndex, le CO₂, l'eau et l'énergie par visite
(modèle Sustainable Web Design v4), et un score de synthèse.

## Installation

Prérequis : [Node.js](https://nodejs.org/) 18 ou plus récent, et git. Chrome
n'est pas nécessaire : Puppeteer télécharge son propre Chromium (~150 Mo) au
premier `npm install`.

```bash
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install
npm link
```

`npm link` rend la commande `nr` disponible partout. Vérifiez l'installation :

```bash
nr --help
```

En cas de souci (`nr: command not found`, `EACCES`, Chromium absent), voir
[Résolution des problèmes courants](./docs/guide.md#résolution-des-problèmes-courants).

## Utilisation

### Auditer une page

```bash
nr analyse --url https://www.example.com
```

Le rapport HTML est enregistré dans `~/Downloads/`. Ouvrez-le dans un
navigateur.

### Auditer tout un site (crawl)

```bash
nr analyse --url https://www.example.com --recursive --depth 2 --max_pages 25
```

L'outil suit les liens internes jusqu'à 2 niveaux de profondeur, dans la limite
de 25 pages.

### Auditer une liste de pages

Écrivez une URL par ligne dans `urls.txt` (les lignes commençant par `#` sont
ignorées), puis :

```bash
nr analyse urls.txt
```

Le rapport global est écrit dans `resultat/`.

### Options courantes

| Option | Effet |
| ------ | ----- |
| `--language en` | Rapport en anglais (défaut : `fr`) |
| `--format xlsx` | Rapport Excel au lieu de HTML (avec `--url`) |
| `--mobile` | Simule une connexion mobile |
| `--device iPhoneX` | Simule un appareil (voir `nr analyse --help`) |
| `--country FRA` | Pays des visiteurs, pour l'intensité carbone (défaut : `FRA`) |
| `--wait_until networkidle2` | À essayer si une page part en timeout |
| `--ci` | Sortie texte sans barre de progression |

Toutes les options, les scénarios YAML (clics, saisie, défilement), l'export
InfluxDB/Grafana et le détail des règles sont dans le
[guide d'utilisation détaillé](./docs/guide.md).

## Documentation

- [Guide d'utilisation détaillé](./docs/guide.md) : toutes les options et le
  référentiel complet des règles.
- [Architecture et guide du contributeur](./docs/architecture.md) : organisation
  du code et ajout d'une règle.
- [Journal des modifications](./CHANGELOG.md)
- [Politique de sécurité](./SECURITY.md)

## Contribuer

Les contributions sont bienvenues, y compris les corrections de documentation.
Lisez le [guide de contribution](./CONTRIBUTING.md) : les commits doivent être
signés avec `git commit -s` (DCO). Lancez `npm test` avant d'ouvrir une pull
request.

Le code de `nr-core/` est regroupé dans `dist/nrBundle.js`, injecté dans la
page auditée. Après toute modification de `nr-core/`, relancez `npm run build`.

## Licence

[AGPL-3.0-or-later](./LICENSE). L'usage commercial est autorisé. Si vous
proposez l'outil, modifié ou non, comme service accessible en réseau, vous devez
publier son code source. Détails dans la section
[Licence du guide](./docs/guide.md#licence-et-conditions-dutilisation).

Le projet intègre du code dérivé de
[GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis) (© 2019
didierfred) et d'[EcoMeter](https://gitlab.com/ecoconceptionweb/ecometer)
(© 2016), tous deux sous AGPL-3.0.

Crédits : [collectif GreenIT.fr](https://collectif.greenit.fr/) et
[ecoindex.fr](https://www.ecoindex.fr/) pour l'EcoIndex et les règles,
[Green Web Foundation](https://www.thegreenwebfoundation.org/) pour le modèle
Sustainable Web Design v4. Intégration CLI, refonte 2026 et modèle de synthèse :
[Institut du Numérique Responsable](https://institutnr.org/).
