# Politique de sécurité

*[English version below](#security-policy)*

## Versions suivies

| Version | Suivie |
| ------- | ------ |
| 1.0.x   | oui    |
| < 1.0   | non    |

Seule la dernière version publiée reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

Merci de ne pas ouvrir d'issue publique pour une vulnérabilité.

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis
**Report a vulnerability**. À défaut, contactez l'Institut du Numérique
Responsable via https://institutnr.org.

Un signalement utile contient : la version concernée, les étapes de
reproduction, l'impact estimé et, si vous en avez un, un correctif proposé.

Nous accusons réception sous 5 jours ouvrés et vous tenons informé jusqu'à la
publication du correctif. Nous vous créditons, sauf si vous préférez rester
anonyme.

## Portée

nr-analysis-cli ouvre des pages web arbitraires dans Chromium et interroge des
services externes. Deux comportements sont voulus :

- Chromium est lancé avec `--no-sandbox` et `--disable-setuid-sandbox`, un
  compromis nécessaire pour tourner en conteneur. Auditez des pages non fiables
  uniquement dans un environnement isolé.
- Les erreurs de certificat TLS sont ignorées (`ignoreHTTPSErrors`), afin de
  pouvoir auditer des préproductions. C'est aussi ce qui permet à l'audit
  serveur de qualifier une configuration TLS défaillante.

Les fichiers de configuration passés à `--login` et `--proxy` contiennent des
identifiants en clair. Gardez-les hors du dépôt : `*.yaml` est gitignoré.

---

# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | yes       |
| < 1.0   | no        |

Only the latest published version receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability.

Use GitHub private reporting: the repository's **Security** tab, then **Report a
vulnerability**. Failing that, contact the Institut du Numérique Responsable
through https://institutnr.org.

A useful report includes the affected version, reproduction steps, the estimated
impact and, if you have one, a suggested fix.

We acknowledge reports within 5 working days and keep the reporter informed
until a fix ships. Credit goes to you unless you prefer to stay anonymous.

## Scope

nr-analysis-cli opens arbitrary web pages in Chromium and queries external
services. Two behaviours are intentional:

- Chromium runs with `--no-sandbox` and `--disable-setuid-sandbox`, a trade-off
  required to run inside a container. Audit untrusted pages in an isolated
  environment only.
- TLS certificate errors are ignored (`ignoreHTTPSErrors`), so that staging
  environments can be audited. It is also what lets the server audit report a
  broken TLS setup.

Configuration files passed to `--login` and `--proxy` hold plaintext
credentials. Keep them out of the repository: `*.yaml` is gitignored.
