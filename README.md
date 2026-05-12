[English version](./README_EN.md)

# nr-analysis-cli

CLI Node.js d'analyse de l'empreinte écologique de pages web, basé sur l'extension Chrome [GreenIT-Analysis](https://github.com/cnumr/GreenIT-Analysis).

L'outil simule l'exécution de l'extension sur les pages spécifiées, ouvertes dans Chromium via Puppeteer. Le cache est désactivé pour fiabiliser l'analyse. Il calcule l'**EcoIndex**, la consommation d'eau et les émissions de GES, et vérifie le respect de bonnes pratiques d'éco-conception.

---

## Nouveautés — mise à jour 2026

Cette version apporte une refonte complète des règles d'éco-conception et de nouvelles fonctionnalités CLI, alignées sur l'état de l'art du web en 2026.

### Nouvelles fonctionnalités CLI

| Fonctionnalité | Description |
| -------------- | ----------- |
| `--url <url>` | Analyse directe d'une URL sans fichier YAML, rapport HTML auto-généré dans `~/Downloads/` |
| `--recursive` | Crawl automatique des liens internes depuis une URL de départ |
| `--depth <n>` | Profondeur maximale du crawl (défaut : 5) |
| `--max_pages <n>` | Nombre maximum de pages à crawler et analyser (défaut : 200) |
| `--language en` | Rapports disponibles en français et en anglais |

### Règles d'éco-conception mises à jour

**8 nouvelles règles** couvrant les pratiques modernes :

| Règle | Quoi ? |
| ----- | ------- |
| **Formats d'image modernes** | Détecte JPEG, PNG, GIF, BMP — recommande AVIF, WebP ou **JPEG XL** (supporté par tous les navigateurs majeurs en 2026) |
| **Lazy loading images & iframes** | Vérifie `loading="lazy"` sur les `<img>` **et** les `<iframe>` (support natif universel) |
| **Scripts de tracking** | Détecte 30+ domaines de tracking : Google, Meta, **TikTok Pixel**, **Snapchat Pixel**, **Pinterest Tag**, **Reddit Pixel**, OneTrust, Cookiebot, Klaviyo, Brevo… |
| **Autoplay vidéo/audio** | Signale tout `<video>` ou `<audio>` avec l'attribut `autoplay` |
| **Optimisation des polices** | Contrôle nombre (≤ 2) et poids total (≤ 100 Ko) des fichiers de polices chargés |
| **Ressources bloquant le rendu** | Détecte les `<script>` dans `<head>` sans `async`, `defer` ou `type="module"` |
| **Iframes externes** | Compte les iframes pointant vers des domaines tiers |
| **Preload/Prefetch excessifs** | Signale plus de 5 directives `<link rel="preload/prefetch">` |

**6 règles existantes améliorées :**

| Règle | Amélioration |
| ----- | ------------ |
| **Widgets réseaux sociaux** | URLs X (Twitter) mises à jour, détection étendue à X.com, LinkedIn badges |
| **Compression HTTP** | Documentation actualisée (Brotli recommandé en priorité sur gzip) |
| **Plugins navigateur** | Portée étendue : `<object>` et `<embed>` (Flash, Java, Silverlight tous obsolètes) |
| **Formats modernes** | Locales FR/EN mises à jour pour mentionner le support 2026 des 3 formats |
| **Lazy loading** | Locales FR/EN reflètent l'extension aux iframes |
| **Tracking** | Locales FR/EN incluent TikTok Pixel dans les exemples |

### Stack technique

- **Puppeteer 23.9+** — Chromium headless moderne, support SSL ignore, mode non-headless
- **Node.js ES2020+** — modules CommonJS, async/await natif
- **Rapports bilingues** — Mustache templates, i18n FR/EN complet

---

# Sommaire

- [Pour commencer](#pour-commencer)
  - [Prérequis](#prérequis)
  - [Installation](#installation)
- [Usage](#usage)
  - [Analyse](#analyse)
    - [Analyse directe d'une URL](#analyse-directe-dune-url)
    - [Analyse via fichier YAML](#analyse-via-fichier-yaml)
      - [Construction du fichier d'entrée](#construction-du-fichier-dentrée)
      - [Conditions d'attente](#conditions-dattente)
      - [Actions](#actions)
        - [click](#click)
        - [press](#press)
        - [scroll](#scroll)
        - [select](#select)
        - [text](#text)
    - [Analyse récursive (crawl)](#analyse-récursive-crawl)
    - [Commande complète](#commande-complète)
    - [Formats des rapports](#formats-des-rapports)
      - [Excel (xlsx)](#excel-xlsx)
      - [HTML](#html)
      - [InfluxDB/Grafana](#influxdbgrafana)
  - [ParseSiteMap](#parsesitemap)
  - [Flags généraux](#flags-généraux)
- [Conditions d'utilisation](#conditions-dutilisation)

---

# Pour commencer

## Démarrage rapide (5 min)

Si vous découvrez l'outil, voici les 4 étapes minimales pour produire votre premier rapport.

```bash
# 1. Installer Node.js (LTS) — https://nodejs.org/
# 2. Récupérer et installer le projet
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install
npm link

# 3. Auditer une URL
nr analyse --url https://isit-europe.org/fr/

# 4. Auditer plusieurs pages depuis urls.txt (fourni)
nr analyse urls.txt
```

Le rapport HTML s'ouvre dans n'importe quel navigateur (`open` sur macOS, `xdg-open` sur Linux, double-clic sur Windows).

### Commande type — audit crawl complet d'un site français

Cas typique : crawler automatiquement un site grand public hébergé/consulté en France, avec méthodologie SWDM v4 enrichie NegaOctet/ARCEP/ADEME.

```bash
nr analyse \
  --url https://www.bigben-connected.com/ \
  --recursive \
  --depth 2 \
  --max_pages 25 \
  --country FRA \
  --methodology negaoctet \
  --language fr \
  --ci
```

| Flag                     | Rôle |
| ------------------------ | ---- |
| `--url <URL>`            | URL de départ (obligatoire pour `--recursive`) |
| `--recursive`            | Crawl automatique des liens internes |
| `--depth 2`              | Profondeur 2 (URL initiale + 2 niveaux) |
| `--max_pages 25`         | Plafond à 25 pages analysées |
| `--country FRA`          | Visiteur en France (mix électrique 44 gCO₂/kWh) |
| `--methodology negaoctet`| Ajoute l'overhead ACV terminal (NegaOctet/ARCEP/ADEME) → empreinte ~1,5–2 g/visite cohérente avec études FR |
| `--language fr`          | Rapport en français |
| `--ci`                   | Désactive la barre de progression (sortie texte exploitable) |

Le rapport global sort dans `~/Downloads/<date>_<host>.html` (mode `--url`) ou `resultat/<date>_<host>_index.html` (mode fichier `urls.txt`).

### Alias shell (optionnel)

Pour éviter de répéter les flags FR/NegaOctet, ajouter à `~/.zshrc` (ou `~/.bashrc`) :

```bash
alias nr-fr='nr analyse --country FRA --methodology negaoctet --language fr --ci'
alias nr-fr-crawl='nr analyse --country FRA --methodology negaoctet --language fr --ci --recursive --depth 2 --max_pages 25'
```

Puis :

```bash
nr-fr --url https://www.example.com           # audit page unique
nr-fr urls.txt                                # audit fichier de liste
nr-fr-crawl --url https://www.example.com     # crawl 25 pages depth 2
```

## Prérequis

- **[Node.js](https://nodejs.org/) 18 ou supérieur** (LTS recommandée). Vérifier avec `node -v`.
- **npm** (livré avec Node.js). Vérifier avec `npm -v`.
- **git** pour cloner le dépôt.
- Une connexion Internet (l'outil télécharge Chromium au premier `npm install`).

Pas besoin d'installer Chrome séparément : Puppeteer embarque sa propre version de Chromium.

## Installation détaillée

```bash
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install
npm link
```

- `npm install` installe les dépendances **et** Chromium (~150 Mo, premier lancement uniquement).
- `npm link` crée un lien symbolique global pour utiliser la commande `nr` depuis n'importe quel dossier.

### Vérifier l'installation

```bash
nr --help
```

Vous devez voir la liste des commandes (`analyse`, `parseSitemap`).

### Résolution des problèmes courants

| Problème | Solution |
| -------- | -------- |
| `nr: command not found` après `npm link` | Sur Linux/macOS, ajouter `$(npm prefix -g)/bin` au `PATH`, ou relancer le terminal. Sur Windows, utiliser PowerShell en mode administrateur. |
| `EACCES` lors du `npm link` | `sudo npm link` (ou configurer un préfixe npm utilisateur — voir [npm docs](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)). |
| Chromium ne se télécharge pas | Réessayer avec `PUPPETEER_DOWNLOAD_HOST=https://storage.googleapis.com npm install`. |
| Erreur `SSL` sur un site interne | L'outil ignore déjà les erreurs SSL par défaut (Puppeteer 23+). |

---

# Usage

## Analyse

### Analyse directe d'une URL

La manière la plus rapide d'analyser un site :

```bash
nr analyse --url https://www.example.com
```

Le rapport HTML est automatiquement enregistré dans `~/Downloads/<hostname>.html`.

Options utiles en mode `--url` :

```bash
nr analyse --url https://www.example.com --output /tmp/rapport.html --format html
```

### Analyse multi-pages via fichier plat `urls.txt`

C'est la manière la plus simple d'auditer un lot de pages : une URL par ligne dans un fichier texte. Le rapport global agrège les moyennes, les **classements meilleures/pires pages** (environnement et accessibilité) et conserve le détail de chaque page.

#### 1. Compléter `urls.txt`

Un fichier d'exemple est fourni à la racine du dépôt (`urls.txt`). Format :

```
# Les commentaires commencent par #
# Une URL par ligne, lignes vides ignorées

https://www.example.com/
https://www.example.com/produits
https://www.example.com/contact
```

Règles :
- 1 URL par ligne, sans guillemets ni séparateurs
- les lignes commençant par `#` sont ignorées (commentaires)
- les lignes vides sont ignorées
- les URLs doivent inclure le protocole (`https://`)

#### 2. Lancer l'audit

```bash
nr analyse urls.txt
```

Sorties générées dans le dossier `resultat/` à la racine du dépôt :

Les fichiers sont préfixés par la date (`YYYYMMDDHHMM`) et le hostname du premier site afin de ne pas écraser les audits précédents.

| Fichier | Contenu |
| ------- | ------- |
| `resultat/<date>_<host>_index.html` | Rapport global : moyennes env + social + cyber + serveur, KPIs CO₂ / eau / énergie pour 1 M visites, classements top/flop, table des pages |
| `resultat/<date>_<host>_<n>.html` | Rapport détaillé de chaque page auditée (a11y, bonnes pratiques, étapes, contrôles cyber + serveur) |

Exemple : `resultat/202605120945_isit-europe.org_index.html`

Ouvrir le rapport :

```bash
open resultat/index.html       # macOS
xdg-open resultat/index.html   # Linux
```

#### 3. Options utiles

```bash
# Ajuster le nombre de pages affichées dans les classements
nr analyse urls.txt --worst_pages 10

# Audit mobile
nr analyse urls.txt --mobile

# Rapport en anglais
nr analyse urls.txt --language en
```

### Analyse via fichier YAML (parcours utilisateur)

Pour définir des **parcours utilisateur** (clic, saisie, login, scroll), créez un fichier YAML :

```bash
nr analyse url.yaml results.html
```

Un exemple de fichier est disponible dans le dossier `samples/`.

#### Construction du fichier d'entrée

Le fichier `<url_input_file>` liste les URL à analyser au format YAML.

| Paramètre           | Type    | Obligatoire | Description                                                         |
| ------------------- | ------- | ----------- | ------------------------------------------------------------------- |
| `url`               | string  | Oui         | URL de la page à analyser                                           |
| `name`              | string  | Non         | Nom affiché dans le rapport                                         |
| `waitForSelector`   | string  | Non         | Attend que l'élément HTML défini par le sélecteur CSS soit visible  |
| `waitForXPath`      | string  | Non         | Attend que l'élément HTML défini par le XPath soit visible          |
| `waitForNavigation` | string  | Non         | Attend la fin du chargement. Valeurs : `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `waitForTimeout`    | int     | Non         | Attend X ms                                                         |
| `screenshot`        | string  | Non         | Réalise une capture d'écran de la page (même en cas d'erreur)       |
| `actions`           | list    | Non         | Réalise une suite d'actions avant d'analyser la page                |

#### Conditions d'attente

Le paramètre `waitForNavigation` exploite les fonctionnalités de Puppeteer :

- `load` : navigation terminée quand l'événement `load` est déclenché.
- `domcontentloaded` : navigation terminée quand `DOMContentLoaded` est déclenché.
- `networkidle0` : pas plus de 0 connexion réseau pendant 500 ms.
- `networkidle2` : pas plus de 2 connexions réseau pendant 500 ms.

Par défaut (aucun `waitFor` défini), l'outil attend l'événement `load`.

Exemple de fichier `url.yaml` :

```yaml
- name: 'Page d'accueil'
  url: 'https://www.example.com/'

- name: 'À propos'
  url: 'https://www.example.com/about'
  waitForSelector: '#main-content'
  screenshot: 'results/screenshots/about.png'

- url: 'https://www.example.com/contact'
  waitForXPath: '//h1'
```

#### Actions

Les actions permettent de définir un parcours utilisateur avant l'analyse.

| Paramètre           | Type    | Obligatoire | Description                                                                 |
| ------------------- | ------- | ----------- | --------------------------------------------------------------------------- |
| `name`              | string  | Non         | Nom de l'action                                                             |
| `type`              | string  | Oui         | Type : `click`, `press`, `scroll`, `select`, `text`                         |
| `element`           | string  | Non         | Sélecteur CSS de l'élément DOM cible                                        |
| `pageChange`        | boolean | Non         | Si `true`, l'action déclenche un changement de page. Défaut : `false`       |
| `timeoutBefore`     | int     | Non         | Temps d'attente avant l'action (ms). Défaut : 1000                          |
| `waitForSelector`   | string  | Non         | Attend que le sélecteur CSS soit visible après l'action                     |
| `waitForXPath`      | string  | Non         | Attend que le XPath soit visible après l'action                             |
| `waitForNavigation` | string  | Non         | Attend la fin du chargement après l'action                                  |
| `waitForTimeout`    | int     | Non         | Attend X ms après l'action                                                  |
| `screenshot`        | string  | Non         | Capture d'écran après l'action (même en cas d'erreur)                       |

##### click

Simule un clic sur un élément de la page.

| Paramètre | Type   | Obligatoire | Description                            |
| --------- | ------ | ----------- | -------------------------------------- |
| `element` | string | Oui         | Sélecteur CSS de l'élément à cliquer   |

```yaml
- name: 'Exemple avec clic'
  url: 'https://www.example.com/'
  actions:
    - name: 'Ouvrir le menu'
      type: 'click'
      element: 'button[aria-label="Menu"]'
      pageChange: true
      waitForSelector: '#nav-menu'
```

##### press

Simule l'appui sur une touche du clavier.

| Paramètre | Type   | Obligatoire | Description                                             |
| --------- | ------ | ----------- | ------------------------------------------------------- |
| `key`     | string | Oui         | Touche clavier reconnue par Puppeteer (ex. `Enter`, `Tab`) |

```yaml
- name: 'Exemple avec touche'
  url: 'https://www.example.com/'
  actions:
    - name: 'Valider avec Entrée'
      type: 'press'
      key: 'Enter'
      waitForTimeout: 1500
```

##### scroll

Simule le défilement vers le bas de la page.

```yaml
- name: 'Page avec scroll'
  url: 'https://www.example.com/'
  actions:
    - name: 'Scroll automatique'
      type: 'scroll'
```

##### select

Simule la sélection de valeurs dans une liste déroulante.

| Paramètre | Type   | Obligatoire | Description                                              |
| --------- | ------ | ----------- | -------------------------------------------------------- |
| `element` | string | Oui         | Sélecteur CSS du `<select>`                              |
| `values`  | list   | Oui         | Liste des valeurs à sélectionner                         |

```yaml
- name: 'Exemple avec select'
  url: 'https://www.example.com/'
  actions:
    - name: 'Choisir une catégorie'
      type: 'select'
      element: '#category'
      values: ['technology']
```

##### text

Simule la saisie de texte dans un champ de formulaire.

| Paramètre | Type   | Obligatoire | Description                            |
| --------- | ------ | ----------- | -------------------------------------- |
| `element` | string | Oui         | Sélecteur CSS du champ                 |
| `content` | string | Oui         | Texte à saisir                         |

```yaml
- name: 'Formulaire de contact'
  url: 'https://www.example.com/contact'
  actions:
    - name: 'Saisir l'email'
      type: 'text'
      element: '#email'
      content: 'test@example.com'
      timeoutBefore: 1000
```

### Analyse récursive (crawl)

L'outil peut crawler automatiquement les liens internes d'un site à partir d'une URL de départ :

```bash
nr analyse --url https://www.example.com --recursive --depth 3 --max_pages 50
```

| Option        | Description                                               | Défaut |
| ------------- | --------------------------------------------------------- | ------ |
| `--recursive` | Active le crawl des liens internes (nécessite `--url`)    | false  |
| `--depth`     | Profondeur maximale du crawl                              | 5      |
| `--max_pages` | Nombre maximum de pages à analyser                        | 200    |

### Commande complète

```
nr analyse [url_input_file] [report_output_file] [options]
```

**Paramètres positionnels :**

| Paramètre            | Description                                      | Défaut          |
| -------------------- | ------------------------------------------------ | --------------- |
| `url_input_file`     | Chemin vers le fichier YAML listant les URL      | `url.yaml`      |
| `report_output_file` | Chemin du fichier de rapport généré              | `results.xlsx`  |

**Options :**

| Option                | Alias | Description                                                               | Défaut    |
| --------------------- | ----- | ------------------------------------------------------------------------- | --------- |
| `--url`               |       | URL à analyser directement (bypass du fichier YAML)                       |           |
| `--output`            | `-o`  | Chemin du rapport (utilisé avec `--url`)                                  |           |
| `--format`            | `-f`  | Format du rapport : `xlsx`, `html`, `influxdb`, `influxdbhtml`            |           |
| `--device`            | `-d`  | Terminal à émuler                                                         | `desktop` |
| `--headers`           | `-h`  | Chemin vers un fichier YAML de headers HTTP                               |           |
| `--headless`          |       | Mode headless du navigateur (`true`/`false`)                              | `true`    |
| `--language`          |       | Langue du rapport (`fr`, `en`)                                            | `fr`      |
| `--login`             | `-l`  | Chemin vers un fichier YAML de configuration de login                     |           |
| `--max_tab`           |       | Nombre d'URL analysées en parallèle                                       | `40`      |
| `--mobile`            |       | Connexion mobile (`true`) ou filaire (`false`)                            | `false`   |
| `--proxy`             | `-p`  | Chemin vers un fichier YAML de configuration du proxy                     |           |
| `--retry`             | `-r`  | Nombre d'essais supplémentaires en cas d'échec                            | `2`       |
| `--timeout`           | `-t`  | Timeout de chargement d'une URL (ms)                                      | `180000`  |
| `--worst_pages`       |       | Nombre de pages prioritaires dans le résumé                               | `5`       |
| `--worst_rules`       |       | Nombre de bonnes pratiques prioritaires dans le résumé                    | `5`       |
| `--recursive`         |       | Crawl récursif des liens internes (nécessite `--url`)                     | `false`   |
| `--depth`             |       | Profondeur maximale du crawl                                              | `5`       |
| `--max_pages`         |       | Nombre maximum de pages à crawler et analyser                             | `200`     |
| `--country`           |       | Pays du visiteur/terminal — ISO 3166-1 alpha-3 (`FRA`, `USA`, `DEU`…). Drive l'intensité carbone du segment device dans SWDM v4 | `FRA` |
| `--dc_country`        |       | Pays du datacenter/origine — ISO 3166-1 alpha-3. Auto-détecté via `x-amz-cf-pop`, `cf-ray` puis IP geolocation (ipapi.co) si omis | auto |
| `--grid_device_gco2`  |       | Override intensité carbone terminal en gCO₂/kWh (plug une valeur Electricity Maps à jour). Prioritaire sur `--country`                       |           |
| `--grid_dc_gco2`      |       | Override intensité carbone datacenter en gCO₂/kWh                         |           |
| `--grid_network_gco2` |       | Override intensité carbone réseau en gCO₂/kWh                             |           |
| `--methodology`       |       | Modèle CO₂ : `swdm-v4` (octets transférés seuls) ou `negaoctet` (SWDM v4 + overhead ACV terminal calibré NegaOctet/ARCEP/ADEME pour la France) | `swdm-v4` |
| `--grafana_link`      |       | URL du dashboard Grafana (format `influxdbhtml`)                          |           |
| `--influxdb_hostname` |       | URL de la base InfluxDB                                                   |           |
| `--influxdb_org`      |       | Nom de l'organisation InfluxDB                                            |           |
| `--influxdb_token`    |       | Token de connexion InfluxDB                                               |           |
| `--influxdb_bucket`   |       | Bucket InfluxDB                                                           |           |

### Empreinte carbone — choix méthodologique

L'outil expose **trois indicateurs complémentaires** dans le rapport :

| Indicateur | Modèle | À quoi ça sert |
| ---------- | ------ | -------------- |
| **SWDM v4** | bytes × kWh/GB × gCO₂/kWh (Sustainable Web Design v4, Green Web Foundation) | Bilan GES, scope **livraison** (terminal + réseau + datacenter origine) |
| **EcoIndex** | formule officielle ecoindex.fr (DOM × 3, requêtes × 2, poids × 1) | Pilotage écoconception structurelle |
| **Score synthétique** | EcoIndex et SWD normalisés puis pondérés 50/50 + confidence | Score global d'une page |

Le flag `--methodology negaoctet` enrichit SWDM v4 avec un **overhead per-visit** calibré sur les études françaises (NegaOctet 2022, ARCEP/ADEME 2022, ADEME Base Empreinte 2024) pour capturer la part ACV terminal/lifecycle absente du modèle bytes-only. Recommandé pour un site grand public hébergé/consulté en France.

Le flag `--dc_country` (ou auto-détection via CDN/IP) dissocie l'intensité carbone du datacenter de celle du visiteur. Critique quand DC ≠ pays visiteur (ex. visiteur France + hébergement AWS Ireland).

**Terminaux supportés (`--device`) :**

`desktop`, `galaxyS9`, `galaxyS20`, `iPhone8`, `iPhone8Plus`, `iPhoneX`, `iPad`

**Exemple de `headers.yaml` :**

```yaml
accept: 'text/html,application/xhtml+xml,application/xml'
accept-encoding: 'gzip, deflate, br'
accept-language: 'fr-FR,fr;q=0.9'
```

**Exemple de `login.yaml` :**

```yaml
url: 'https://www.example.com/login'
fields:
  - selector: '#username'
    value: monlogin
  - selector: '#password'
    value: monmotdepasse
loginButtonSelector: '#btn-login'
waitForTimeout: 2000
```

**Exemple de `proxy.yaml` :**

```yaml
server: '<host>:<port>'
user: '<username>'
password: '<password>'
```

### Formats des rapports

#### Excel (xlsx)

```bash
nr analyse url.yaml results.xlsx
# ou
nr analyse url.yaml results --format xlsx
```

Le rapport Excel contient :
- Un onglet global : moyenne de l'EcoIndex, pages et règles prioritaires à corriger.
- Un onglet par URL : EcoIndex, consommation eau/GES, tableau des bonnes pratiques.

![Onglet global](./docs/rapport-xlsx-global.png)
![Onglet page](./docs/rapport-xlsx-detail-page.png)

#### HTML

```bash
nr analyse url.yaml results.html
# ou
nr analyse --url https://www.example.com --format html
```

Le rapport HTML contient :
- Une page résumé : nombre de scénarios, erreurs, tableau récapitulatif, bonnes pratiques non respectées.
- Une page par scénario : détail des requêtes, poids, EcoIndex, eau, GES et bonnes pratiques.

![Page globale](./docs/rapport-html-global.jpeg)
![Page scénario](./docs/rapport-html-detail-page.jpeg)
![Page scénario avec changement de page](./docs/rapport-html-detail-page-avec-changement-page.jpeg)

#### InfluxDB/Grafana

Envoie les données vers une instance InfluxDB pour visualisation dans Grafana :

```bash
nr analyse url.yaml --format influxdb \
  --influxdb_hostname http://localhost:8086 \
  --influxdb_org mon-org \
  --influxdb_token mon-token \
  --influxdb_bucket mon-bucket
```

Pour générer simultanément un rapport HTML avec lien Grafana :

```bash
nr analyse url.yaml results.html --format influxdbhtml \
  --influxdb_hostname http://localhost:8086 \
  --influxdb_org mon-org \
  --influxdb_token mon-token \
  --influxdb_bucket mon-bucket \
  --grafana_link http://localhost:3000/d/YoK0Xjb4k/nr-analysis
```

![Dashboard Grafana](./docs/grafana-dashboard.png)
![Rapport HTML avec InfluxDB](./docs/rapport-html-global-avec-influxdb.jpeg)

---

## ParseSiteMap

Convertit une sitemap XML en fichier YAML utilisable par `nr analyse` :

```bash
nr parseSitemap https://www.example.com/sitemap.xml url.yaml
```

| Paramètre          | Description                                   | Défaut     |
| ------------------ | --------------------------------------------- | ---------- |
| `sitemap_url`      | URL de la sitemap à transformer               | *(requis)* |
| `yaml_output_file` | Chemin du fichier YAML généré                 | `url.yaml` |

## Flags généraux

| Flag   | Description                                                        |
| ------ | ------------------------------------------------------------------ |
| `--ci` | Désactive la barre de progression pour les environnements CI/CD    |

---

# Référentiel des règles évaluées

Chaque page auditée est notée sur 4 axes indépendants. Le grade global va de **A** (excellent) à **G** (très mauvais).

| Axe | Score | Source des règles |
| --- | ----- | ----------------- |
| **Environnement** | 0–100 | 38 règles d'éco-conception (RGESN, GR491, WSG) exécutées dans la page |
| **Social (a11y)** | 0–100 | 12 contrôles Tanaguru/RGAA + 5 contrôles complémentaires NR |
| **Sécurité (cyber)** | 0–100 | 13 contrôles serveur (TLS, en-têtes HTTP, cookies, DNSSEC…) |
| **Performance serveur** | 0–100 | 9 contrôles d'infrastructure (HTTP/2, compression, cache, CDN…) |

Chaque règle renvoie un **niveau de conformité** :

- `A` : règle respectée
- `B` : amélioration mineure
- `C` : règle non respectée

Le score global d'un axe est la moyenne pondérée des niveaux selon la criticité.

---

## 1. Environnement — règles d'éco-conception (38)

### 1.1 Optimisation du transfert (poids et requêtes)

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Limiter le nombre de domaines | `DomainsNumber` | Nombre de domaines tiers contactés | < 3 |
| Limiter le nombre de requêtes HTTP | `HttpRequests` | Nombre total de requêtes | < 27 |
| Compresser les ressources | `CompressHttp` | Taux de ressources servies en gzip/brotli | ≥ 95 % |
| Ajouter des en-têtes de cache | `AddExpiresOrCacheControlHeaders` | `Expires` ou `Cache-Control` sur les ressources statiques | ≥ 95 % |
| Utiliser des ETags | `UseETags` | Présence de l'en-tête `ETag` | ≥ 95 % |
| Pas de cookie pour les ressources statiques | `NoCookieForStaticRessources` | Absence de `Cookie` sur images, CSS, JS | 100 % |
| Limiter la taille des cookies | `MaxCookiesLength` | Poids par domaine | < 512 octets |
| Éviter les redirections | `NoRedirect` | Nombre de redirections HTTP rencontrées | 0 |
| Éviter les requêtes en erreur | `HttpError` | Nombre de réponses HTTP 4xx/5xx | 0 |

### 1.2 Optimisation des assets

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Minifier les CSS | `MinifiedCss` | Taux de fichiers CSS minifiés | ≥ 95 % |
| Minifier les JS | `MinifiedJs` | Taux de fichiers JS minifiés | ≥ 95 % |
| Externaliser les CSS | `ExternalizeCss` | CSS dans un fichier `.css`, pas inline | présent |
| Externaliser les JS | `ExternalizeJs` | JS dans un fichier `.js`, pas inline | présent |
| Limiter le nombre de fichiers CSS | `StyleSheets` | Nombre de fichiers CSS chargés | < 3 |
| Valider le JavaScript | `JsValidate` | Erreurs JS détectées dans la console | 0 |

### 1.3 Images

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Ne pas retailler dans le navigateur | `DontResizeImageInBrowser` | Images dont la taille rendue ≪ taille source | 0 |
| Ne pas télécharger des images inutilement | `ImageDownloadedNotDisplayed` | Images chargées mais non affichées | 0 |
| Éviter les `<img src="">` vides | `EmptySrcTag` | Tags `<img src="">` vides | 0 |
| Optimiser les images bitmap | `OptimizeBitmapImages` | Compression suffisante des JPEG/PNG | seuil interne |
| Optimiser les images SVG | `OptimizeSvg` | Compression et nettoyage des SVG | seuil interne |
| Utiliser des formats modernes | `ModernImageFormats` | Taux d'images bitmap servies en **AVIF / WebP / JPEG XL** | 100 % |
| Lazy-loading images & iframes | `LazyLoadImages` | `loading="lazy"` sur les `<img>` et `<iframe>` hors viewport | ≥ 80 % |
| Images responsives (`srcset`) | `ResponsiveImages` | Attribut `srcset` / `sizes` ou `<picture><source>` parent | ≥ 50 % |

### 1.4 Polices

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Polices standards | `UseStandardTypefaces` | Pas plus de N fichiers de polices personnalisées | seuil interne |
| Optimiser le chargement des polices | `OptimizeFonts` | Nombre de fichiers ≤ 2 **et** poids total ≤ 100 Ko | les deux |
| Sous-ensemble (unicode-range) | `FontSubsetting` | Utilisation de `unicode-range` dans `@font-face` | au moins 1 |

### 1.5 Performances de rendu

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Éviter les ressources bloquantes | `NoRenderBlockingResources` | `<script>` dans `<head>` sans `async` / `defer` / `module` | 0 |
| Ne pas abuser des preload/prefetch | `NoExcessivePreload` | Nombre de `<link rel="preload"\|prefetch">` | ≤ 5 |
| Pas d'autoplay vidéo/audio | `NoAutoplayVideo` | Présence d'attributs `autoplay` | 0 |
| Pas de plugins navigateur | `Plugins` | `<object>`, `<embed>` (Flash, Java, Silverlight) | 0 |

### 1.6 Confidentialité et empreinte indirecte

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Limiter les scripts de tracking | `TrackingScripts` | Domaines connus (Google, Meta, TikTok, Snap, Pinterest, Reddit, OneTrust, Cookiebot…) | 0 |
| Limiter les iframes tierces | `NoExternalIframes` | iframes vers des domaines tiers | seuil interne |
| Pas de widgets sociaux officiels | `SocialNetworkButton` | Présence X/Twitter, LinkedIn badges, Facebook Like, etc. | 0 |

### 1.7 Adaptation à l'utilisateur

| Règle | ID | Ce qu'elle mesure | Critère de réussite |
| ----- | -- | ----------------- | ------------------- |
| Print CSS | `PrintStyleSheet` | `@media print` ou stylesheet `media="print"` | présent |
| Respect `prefers-reduced-motion` | `ReducedMotion` | `@media (prefers-reduced-motion)` dans le CSS | présent |
| Support du mode sombre | `DarkModeSupport` | `<meta name="color-scheme">` **ou** `color-scheme` CSS sur `:root` | présent |
| Sous-titres vidéo | `VideoSubtitles` | `<track kind="captions\|subtitles">` sur chaque `<video>` | tous |

---

## 2. Social — accessibilité (17 contrôles)

### 2.1 Tanaguru / RGAA (12)

| Contrôle | ID | Ce qu'il vérifie |
| -------- | -- | ---------------- |
| Alternatives textuelles | `ImgAlt` | Toutes les `<img>` non décoratives portent un attribut `alt` |
| Langue du document | `DocumentLanguage` | `<html lang="...">` présent et valide |
| Titre de page | `PageTitle` | `<title>` non vide, distinct entre pages |
| Structure des titres | `HeadingStructure` | Un seul `<h1>`, hiérarchie h1-h6 sans saut |
| Étiquettes de formulaire | `FormLabel` | Chaque champ a un `<label>` ou `aria-label` |
| Intitulés de liens | `LinkText` | Pas de « cliquez ici », « en savoir plus » seuls |
| Nom des boutons | `ButtonName` | Texte visible ou `aria-label` sur tout `<button>` |
| Landmarks ARIA | `Landmarks` | `<main>`, `<nav>`, `<header>`, `<footer>` ou rôles équivalents |
| En-têtes de tableau | `TableHeaders` | `<th>` dans les tableaux de données |
| Contraste des couleurs | `ColorContrast` | Ratio ≥ 4.5:1 (texte normal) / 3:1 (grand texte) |
| Titre des iframes | `IframeTitle` | Attribut `title` sur chaque `<iframe>` |
| Ordre de tabulation | `TabIndex` | Pas de `tabindex` > 0 |

### 2.2 Contrôles NR complémentaires (5)

| Contrôle | ID | Ce qu'il vérifie |
| -------- | -- | ---------------- |
| `font-display: swap` | `FontDisplaySwap` | Évite le FOIT (texte invisible pendant le chargement) |
| Preload des polices critiques | `FontPreload` | `<link rel="preload" as="font">` pour polices `font-display: swap` |
| Sous-ensemble de polices | `FontSubset` | Présence d'`unicode-range` |
| Bandeau consentement | `ConsentBanner` | Bandeau RGPD détecté avant le dépôt de cookies |
| Cookies tiers | `ThirdPartyCookies` | Cookies déposés par des domaines tiers avant consentement |

---

## 3. Cyber — sécurité serveur (13 contrôles)

| Contrôle | ID | Ce qu'il vérifie | Sévérité |
| -------- | -- | ---------------- | -------- |
| Version TLS | `Tls` | TLS 1.2 ou 1.3 uniquement | Critique |
| HSTS | `Hsts` | En-tête `Strict-Transport-Security` ≥ 6 mois | Important |
| CSP | `Csp` | En-tête `Content-Security-Policy` présent | Important |
| X-Content-Type-Options | `XContentTypeOptions` | `nosniff` | Important |
| X-Frame-Options | `XFrameOptions` | `DENY` ou `SAMEORIGIN` (anti-clickjacking) | Important |
| Referrer-Policy | `ReferrerPolicy` | Politique restrictive | Recommandé |
| Permissions-Policy | `PermissionsPolicy` | Restriction des APIs sensibles (caméra, micro…) | Recommandé |
| Drapeaux cookies | `CookieFlags` | `Secure`, `HttpOnly`, `SameSite` sur tous les `Set-Cookie` | Critique |
| Fuite serveur | `ServerLeak` | En-tête `Server` ne révèle pas la version | Recommandé |
| security.txt | `SecurityTxt` | `/.well-known/security.txt` conforme RFC 9116 | Recommandé |
| Redirection HTTP→HTTPS | `HttpToHttpsRedirect` | Redirection 301 du `http://` vers `https://` | Critique |
| Cross-Origin Isolation | `CrossOriginIsolation` | COOP + CORP (protection Spectre) | Recommandé |
| DNSSEC | `Dnssec` | Zone DNS signée | Recommandé |

---

## 4. Performance serveur (9 contrôles)

| Contrôle | ID | Ce qu'il vérifie | Sévérité |
| -------- | -- | ---------------- | -------- |
| OCSP Stapling | `OcspStapling` | TLS handshake court (révocation pré-signée) | Recommandé |
| Version HTTP | `HttpVersion` | HTTP/2 ou HTTP/3 (multiplexage) | Important |
| Cache-Control | `CacheControl` | Politique de cache explicite | Important |
| Compression | `Compression` | gzip ou Brotli activés (Brotli recommandé) | Important |
| IPv6 DNS | `DnsIpv6` | Au moins 1 enregistrement AAAA | Recommandé |
| Redondance DNS | `DnsRedundancy` | ≥ 2 IPs distinctes en A/AAAA | Recommandé |
| TLS Resumption | `TlsResumption` | Session tickets ou session ID actifs | Recommandé |
| CDN | `Cdn` | Signature CDN détectée (Cloudflare, Fastly, OVH CDN…) | Informatif |

---

## 5. Métriques environnementales calculées

En plus des règles, l'outil estime pour chaque page :

| Métrique | Modèle | Unité |
| -------- | ------ | ----- |
| **Score de durabilité** | Pondération des règles d'éco-conception | 0–100 (A–G) |
| **CO₂ par visite** | Sustainable Web Design v4 + green hosting (Green Web Foundation) | g CO₂eq |
| **Eau par visite** | SWD v4 × WUE (1.8 L/kWh — moyenne UNESCO) | cL |
| **Énergie par visite** | SWD v4 (0.81 kWh/GB transféré) | Wh |
| **CO₂ pour 1 M visites** | extrapolation linéaire | kg CO₂eq |
| **Eau pour 1 M visites** | extrapolation linéaire | L |
| **Énergie pour 1 M visites** | extrapolation linéaire | kWh |
| **Hébergement vert** | API Green Web Foundation | booléen (A/C) |

---

# Conditions d'utilisation

Cet outil s'appuie sur l'API de l'extension GreenIT-Analysis qui **ne permet pas une utilisation à des fins commerciales**.
