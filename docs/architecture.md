[English version](./architecture.en.md) · [Retour au README](../README.md)

# Architecture et guide du contributeur

Ce document décrit comment le projet est organisé et comment y ajouter du code.
Il complète [CONTRIBUTING.md](../CONTRIBUTING.md), qui traite du DCO et du
processus de pull request.

## 1. Deux moitiés de code, deux environnements

Le code est coupé en deux moitiés qui ne s'exécutent pas au même endroit.

| Répertoire | S'exécute où | Peut faire `require()` | Accès au DOM |
| ---------- | ------------ | ---------------------- | ------------ |
| `nr-core/` | dans la page auditée, injecté par Puppeteer | non | oui |
| `cli-core/`, `commands/` | dans Node.js | oui | non |

`nr-core/` n'est jamais chargé tel quel. Le script `builder.js` concatène tous
ses fichiers dans un bundle unique `dist/nrBundle.js`, et Puppeteer injecte ce
bundle dans la page.

> **Vous modifiez `nr-core/`, vous régénérez le bundle. Sinon votre code ne
> s'exécute pas.**

```bash
npm run build   # régénère dist/nrBundle.js
```

Le build tourne aussi automatiquement au `npm install`, via le hook
`postinstall`. `dist/` est gitignoré : le bundle n'est jamais versionné.

Comme `nr-core/` n'a pas de système de modules, tout y est global. Les fichiers
communiquent par des variables globales (`rulesManager`, `har`, `resources`) et
l'ordre de concaténation compte. Il est fixé dans `builder.js` :
`analyseFrameCore.js`, puis `utils.js`, `rulesManager.js`, les règles, les
règles WSG, les contrôles d'accessibilité, et enfin `greenpanel.js`.

## 2. Le chemin d'une analyse

```
nr analyse --url https://exemple.fr
  │
  ├─ nr                       déclaration yargs des commandes et des options
  ├─ commands/analyse.js      résout entrées/sorties, crawle si --recursive,
  │                           lance Chromium, choisit le format de rapport
  │
  └─ cli-core/analysis.js     pour chaque page :
       ├─ ouvre un onglet, applique --device, --headers, --proxy
       ├─ désactive cache et service worker (sinon le poids transféré est faussé)
       ├─ joue les actions du scénario YAML (click, text, scroll, select, press)
       ├─ capture le HAR (puppeteer-har) et l'arbre de ressources (CDP)
       ├─ injecte un faux objet `chrome.i18n` alimenté par le catalogue de traduction
       ├─ injecte dist/nrBundle.js, appelle launchAnalyse(), retire le script
       ├─ interroge les services externes : co2Client.js, geoLookup.js
       └─ audite le serveur hors navigateur : serverAudit.js
  │
  ├─ cli-core/scoring.js, socialScoring.js, auditScoring.js, synthetic.js
  │                           calculent les scores des 4 axes puis le score de synthèse
  ├─ cli-core/reportGlobal.js agrège les pages, classe les pires pages et règles
  └─ reportHtml.js | reportExcel.js | influxdb.js  produisent la sortie
```

Le format de sortie est choisi par `--format`, sinon déduit de l'extension du
fichier de sortie. Les quatre valeurs acceptées sont `xlsx`, `html`, `influxdb`
et `influxdbhtml` (`getReportFormat` dans `commands/analyse.js`).

## 3. Carte des fichiers

### Racine

| Fichier | Rôle |
| ------- | ---- |
| `nr` | binaire déclaré dans `package.json` (`bin.nr`). Déclare les commandes `analyse` et `parseSitemap` et toutes les options yargs |
| `builder.js` | concatène `nr-core/**` en `dist/nrBundle.js` |
| `sizes.js` | profils d'appareils pour `--device` : `desktop`, `galaxyS9`, `galaxyS20`, `iPhone8`, `iPhone8Plus`, `iPhoneX`, `iPad` |
| `conf/rules.js` | registre des règles : `bestPractice`, `priority`, `effort`, `impact`, `wsgCategory`, `wsgId` |

### `cli-core/` : orchestration côté Node

| Fichier | Ce qu'il expose |
| ------- | --------------- |
| `analysis.js` | `createJsonReports`, `login`. Pilotage des onglets, HAR, injection du bundle |
| `reportGlobal.js` | `create_global_report` : agrégation multi-pages, pires pages, pires règles |
| `reportHtml.js` | rapport HTML, gabarits Mustache dans `cli-core/template/` |
| `reportExcel.js` | rapport XLSX via exceljs |
| `influxdb.js` | `write` : envoi des séries vers InfluxDB |
| `scoring.js` | `computeScore`, `scoreToGrade` pour l'axe environnement |
| `socialScoring.js` | `computeSocialScore`, `CHECK_WEIGHTS` pour l'axe accessibilité |
| `auditScoring.js` | `computeSecurityScore`, `computeServerScore` pour les axes cyber et performance |
| `synthetic.js` | `computeSynthetic`, `buildRecommendations` : score combinant EcoIndex et SWDM v4 |
| `co2Client.js` | `checkGreenHosting`, `computeCo2`, `computeEcoIndexImpact`, adossés à `@tgwf/co2` |
| `geoLookup.js` | `detectDatacenterCountry` par en-têtes CDN et géolocalisation IP, tables ISO2 vers ISO3 et IATA vers ISO3 |
| `serverAudit.js` | `auditServer`, `SEVERITY`, `getSeverity` : TLS, en-têtes de sécurité, DNS |
| `checkDescriptions.js` | `DESCRIPTIONS` : libellés des contrôles serveur et accessibilité |
| `translator.js` | `translator`, adossé à `locales/fr.json` et `locales/en.json` |
| `utils.js` | barre de progression et utilitaires Node |

### `nr-core/` : code injecté dans la page

| Fichier | Rôle |
| ------- | ---- |
| `analyseFrameCore.js` | point d'entrée du bundle, collecte les mesures de la frame |
| `rulesManager.js` | `registerRule`, instanciation et exécution des règles par évènement |
| `greenpanel.js` | agrège les résultats de règles en un objet remonté à Node |
| `ecoIndex.js` | calcul de l'EcoIndex à partir du DOM, des requêtes et du poids |
| `utils.js` | utilitaires navigateur partagés par les règles |
| `rules/*.js` | 32 règles d'éco-conception, une par fichier |
| `rules/wsg/*.js` | 5 règles issues des Web Sustainability Guidelines |
| `a11y/tanaguruChecks.js` | 12 contrôles Tanaguru et RGAA |
| `a11y/nrChecks.js` | 5 contrôles d'accessibilité complémentaires INR |

## 4. Ajouter une règle d'éco-conception

Une règle se déclare en cinq endroits. Si vous en oubliez un, la règle ne
s'exécute pas, ou elle s'exécute sans libellé lisible dans le rapport.

**Étape 1. Créer le fichier.** Dans `nr-core/rules/` pour une règle NR, dans
`nr-core/rules/wsg/` pour une règle adossée aux Web Sustainability Guidelines.
Le nom du fichier doit être exactement l'identifiant de la règle.

```js
// nr-core/rules/MaNouvelleRegle.js
rulesManager.registerRule({
    complianceLevel: 'A',
    id: 'MaNouvelleRegle',
    comment: '',
    detailComment: '',

    check: function (measures) {
        // measures contient les mesures collectées dans la page
        if (condition_ideale) this.complianceLevel = 'A';
        else if (condition_acceptable) this.complianceLevel = 'B';
        else this.complianceLevel = 'C';

        this.comment = chrome.i18n.getMessage('rule_MaNouvelleRegle_Comment', String(valeur));
    },
}, 'frameMeasuresReceived');
```

Le second argument de `registerRule` est l'évènement qui déclenche la règle :
`frameMeasuresReceived` (mesures du DOM), `harReceived` (analyse du réseau) ou
`resourceContentReceived` (contenu d'une ressource). Une règle peut aussi
définir une méthode `initialize()`, appelée avant la première vérification.

Les trois niveaux de conformité sont `A` (règle respectée), `B` (amélioration
mineure) et `C` (règle non respectée).

**Étape 2. Enregistrer la règle dans `conf/rules.js`.**

```js
{ bestPractice: 'MaNouvelleRegle', priority: 4, effort: 3, impact: 4, wsgCategory: 'NR', wsgId: 'WD14' },
```

`priority`, `effort` et `impact` sont notés de 1 à 9 et alimentent la
pondération du score ainsi que le classement des recommandations. `wsgId` reste
facultatif pour une règle sans correspondance dans les WSG.

**Étape 3. Ajouter les traductions** dans `locales/fr.json` et `locales/en.json`.
Quatre clés par règle, toutes préfixées par `rule_` :

| Clé | Contenu |
| --- | ------- |
| `rule_MaNouvelleRegle` | libellé court, affiché dans les tableaux |
| `rule_MaNouvelleRegle_DetailDescription` | explication longue, affichée dans le rapport détaillé |
| `rule_MaNouvelleRegle_Comment` | commentaire paramétré, `%s` est remplacé par les valeurs passées à `getMessage` |
| `rule_MaNouvelleRegle_DetailComment` | commentaire détaillé, paramétrable de la même façon |

Les deux catalogues doivent rester synchronisés : une clé absente de `en.json`
fait échouer le rendu du rapport en anglais.

**Étape 4. Reconstruire le bundle** avec `npm run build`.

**Étape 5. Documenter la règle** dans le tableau du référentiel, section
« Référentiel des règles évaluées » de `README.md` et de `README_EN.md`, en
mettant à jour le nombre de règles annoncé en tête de section.

## 5. Ajouter un contrôle serveur, accessibilité ou sécurité

Les contrôles serveur ne passent pas par le navigateur. Ils vivent dans
`cli-core/serverAudit.js`, sont notés par `cli-core/auditScoring.js` et leurs
libellés sont dans `cli-core/checkDescriptions.js`.

Les contrôles d'accessibilité s'exécutent dans la page, dans
`nr-core/a11y/tanaguruChecks.js` et `nr-core/a11y/nrChecks.js`. Ils sont pondérés
par `CHECK_WEIGHTS` dans `cli-core/socialScoring.js` et nécessitent, eux aussi,
un `npm run build`.

## 6. Vérifier une modification

`npm test` reconstruit le bundle puis lance les tests de `tests/` (régressions,
serveur, navigateur via Puppeteer). Ils ne couvrent pas tout : avant d'ouvrir
une pull request, lancez-les puis faites au minimum ceci :

```bash
npm run build
./nr analyse --url https://institutnr.org --format html
```

Puis ouvrir le rapport produit dans `~/Downloads/` et contrôler que la règle ou
le contrôle modifié apparaît, avec son libellé traduit et un niveau de
conformité cohérent. Pour valider les deux langues, relancer avec
`--language en`.

Une analyse multi-pages se vérifie avec la liste d'exemple fournie :

```bash
./nr analyse urls.txt
```

Le rapport sort alors dans `resultat/` à la racine du dépôt.

## 7. Conventions

- Formatage géré par Prettier, configuré dans `.prettierrc` : indentation de
  4 espaces, guillemets simples, point-virgules, virgule finale en mode `es5`.
- `.editorconfig` fixe l'encodage UTF-8, l'indentation de 4 espaces (2 pour le
  YAML) et une longueur de ligne de 120 caractères.
- CommonJS partout, pas d'ESM. Node 18 ou plus récent.
- Les en-têtes de copyright AGPL présents dans `nr-core/` proviennent de
  GreenIT-Analysis et d'EcoMeter. Ils doivent être conservés en l'état.

## 8. Pièges connus

- Le bundle injecté s'appelle `dist/nrBundle.js`, mais le filtre qui écarte les
  requêtes réseau générées par l'analyse elle-même, dans
  `isNetworkEventGeneratedByAnalysis` (`cli-core/analysis.js`), teste encore le
  nom historique `greenItBundle.js`. Le filtre ne retire donc plus rien.
- Puppeteer est lancé avec `--no-sandbox`, nécessaire pour tourner en conteneur.
  C'est un compromis de sécurité assumé, à ne pas reproduire sur des pages non
  fiables hors environnement isolé.
- `dist/`, `results/`, `resultat/`, `*.xlsx`, `*.yaml` et `urls-*.txt` sont
  gitignorés. Seul `urls.txt` est versionné, comme exemple.
- La branche `master` du dépôt distant est historique et figée. Le
  développement se fait sur `main`.
