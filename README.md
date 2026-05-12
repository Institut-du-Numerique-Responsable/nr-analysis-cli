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
| `--grafana_link`      |       | URL du dashboard Grafana (format `influxdbhtml`)                          |           |
| `--influxdb_hostname` |       | URL de la base InfluxDB                                                   |           |
| `--influxdb_org`      |       | Nom de l'organisation InfluxDB                                            |           |
| `--influxdb_token`    |       | Token de connexion InfluxDB                                               |           |
| `--influxdb_bucket`   |       | Bucket InfluxDB                                                           |           |

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

# Conditions d'utilisation

Cet outil s'appuie sur l'API de l'extension GreenIT-Analysis qui **ne permet pas une utilisation à des fins commerciales**.
