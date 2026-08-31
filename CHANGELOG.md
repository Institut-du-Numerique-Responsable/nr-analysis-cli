# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Documentation

- Guide d'architecture et de contribution, en français et en anglais
  (`docs/architecture.md`, `docs/architecture.en.md`) : découpage du code entre
  navigateur et Node, chemin d'une analyse, marche à suivre pour ajouter une
  règle ou un contrôle.
- Section « Contribuer » dans les deux README, sommaire français remis à jour.
- Ajout de ce journal des modifications et d'une politique de sécurité.
- Correction du nombre de règles d'éco-conception annoncé : 37 et non 38, dans
  les README et sur la page projet.
- Métadonnées du paquet complétées dans `package.json` (description, dépôt,
  auteur, mots-clés, version de Node requise).

## [1.0.0] - 2026-07-21

Première version publiée sous le nom nr-analysis-cli, à l'Institut du Numérique
Responsable. Le projet dérive de l'extension Chrome GreenIT-Analysis, dont il
reprend le moteur de règles exécuté dans la page.

### Ajouté

- Quatre axes d'évaluation notés indépendamment : environnement, accessibilité,
  sécurité serveur et performance serveur.
- Analyse directe d'une URL avec `--url`, sans fichier YAML, et rapport HTML
  généré dans `~/Downloads/`.
- Crawl récursif des liens internes avec `--recursive`, `--depth` et
  `--max_pages`.
- Listes d'URL en fichier plat `.txt` ou `.list`, en plus des scénarios YAML.
- 5 règles issues des Web Sustainability Guidelines : `ReducedMotion`,
  `DarkModeSupport`, `VideoSubtitles`, `ResponsiveImages`, `FontSubsetting`.
- 8 règles d'éco-conception couvrant des pratiques récentes : formats d'image
  modernes, lazy loading, scripts de tracking, autoplay, optimisation des
  polices, ressources bloquant le rendu, iframes externes, preload excessif.
- 12 contrôles d'accessibilité Tanaguru et RGAA, plus 5 contrôles
  complémentaires INR.
- Audit serveur : TLS, HSTS, CSP, HTTP/2 et HTTP/3, DNSSEC, IPv6, compression,
  politique de cache.
- Estimation carbone à deux modèles : Sustainable Web Design v4 et EcoIndex,
  avec score de synthèse et recommandations classées.
- Dissociation des intensités carbone terminal, réseau et centre de données,
  avec détection automatique du pays d'hébergement par en-têtes CDN et
  géolocalisation IP.
- Options `--country`, `--dc_country`, `--grid_device_gco2`, `--grid_dc_gco2`,
  `--grid_network_gco2` et `--methodology`.
- Option `--wait_until` pour choisir la condition de navigation Puppeteer.
- Rapports en français et en anglais avec `--language`.
- Indicateurs CO₂, eau et énergie ramenés à 1 million de visites, classements
  des pires pages et des pires règles.
- Horodatage des rapports au format `YYYYMMDDHHMM`.
- Page projet publiée sur GitHub Pages, métadonnées de citation `CITATION.cff`,
  fichiers d'indexation `llms.txt`, `robots.txt` et `sitemap.xml`.

### Modifié

- La méthodologie carbone par défaut passe à `negaoctet` : SWDM v4 complété par
  une surcouche ACV terminal calibrée sur les études ARCEP et ADEME.
- Le score de durabilité remplace l'EcoIndex comme note principale de l'axe
  environnement, l'EcoIndex restant calculé et affiché.
- Détection élargie des bonnes pratiques modernes : widgets X.com et LinkedIn,
  Brotli recommandé avant gzip, balises `<object>` et `<embed>` prises en compte
  dans la règle sur les plugins.

### Corrigé

- Cohérence de la licence AGPL-3.0-or-later entre `package.json` et les README.
- Propagation du drapeau `isGreen` dans `computeCo2`, pour un calcul correct sur
  les sites hébergés en vert.

## Avant 2026

Le dépôt reprend l'historique de GreenIT-Analysis-cli, dont la première version
remonte à mars 2021. Les évolutions antérieures à la refonte INR d'avril 2026
sont consultables dans l'historique Git.

[Non publié]: https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/compare/v1.0.0...main
[1.0.0]: https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli/releases/tag/v1.0.0
