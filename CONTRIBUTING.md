# Guide de contribution et Certificat d'Origine (DCO)

Merci de l'intérêt que vous portez aux projets open source de l'Institut du Numérique Responsable (INR). Pour maintenir la transparence et la sécurité juridique de nos projets, nous demandons à tous les contributeurs d'accepter le Certificat d'Origine du Développeur (DCO).

## 1. Comment contribuer ?

Toute contribution (correction de bug, nouvelle fonctionnalité, documentation) doit suivre les étapes suivantes :

1.  **Forkez** le dépôt.
2.  **Créez une branche** pour votre modification.
3.  Effectuez vos modifications en suivant les **standards de code** du projet.
4.  **Signez vos commits** (voir section 4 ci-dessous).
5.  Soumettez une **Pull Request**.

## 2. Mettre en place l'environnement de développement

```bash
git clone https://github.com/Institut-du-Numerique-Responsable/nr-analysis-cli.git
cd nr-analysis-cli
npm install          # installe les dépendances et construit dist/nrBundle.js
./nr analyse --url https://institutnr.org --format html
```

Node.js 18 ou plus récent est requis.

Avant d'écrire du code, lisez le [guide d'architecture](./docs/architecture.md).
Il explique le découpage entre le code injecté dans la page auditée
(`nr-core/`) et le code Node (`cli-core/`), et détaille la marche à suivre pour
ajouter une règle ou un contrôle.

Attention au bundle : `builder.js` concatène `nr-core/` en un fichier
`dist/nrBundle.js`, et c'est ce fichier que Puppeteer injecte dans la page.
Modifiez `nr-core/` sans relancer `npm run build` et votre code ne s'exécute
pas.

Lancez `npm test` (tests de non-régression dans `tests/`). La section « Vérifier
une modification » du guide d'architecture décrit le contrôle manuel attendu en
complément.
Indiquez dans votre pull request ce que vous avez vérifié, et sur quelle page.

Le formatage suit Prettier, configuré dans `.prettierrc` :

```bash
npx prettier --write .
```

## 3. Certificat d'origine du développeur (DCO)

Version 1.1 Copyright (C) 2004, 2006 La Fondation Linux et ses contributeurs.

En apportant une contribution à ce projet, je certifie que :

a) La contribution a été créée en tout ou en partie par moi-même et j’ai le droit de la soumettre sous la licence open source indiquée dans le fichier ; ou bien

b) La contribution est basée sur un travail antérieur qui, à ma connaissance, est couvert par une licence open source appropriée et j’ai le droit, en vertu de cette licence, de soumettre ce travail avec des modifications, qu’il ait été créé en tout ou en partie par moi, sous la même licence open source (sauf si je suis autorisé à le soumettre sous une licence différente), comme indiqué dans le fichier ; ou  

c) La contribution m’a été fournie directement par une autre personne qui a certifié (a), (b) ou (c) et je ne l’ai pas modifiée.  

d) Je comprends et accepte que ce projet et la contribution sont publics et qu’un enregistrement de la contribution (y compris toutes les informations personnelles que je soumets avec elle, y compris ma signature) est conservé indéfiniment et peut être redistribué conformément à ce projet ou à la (aux) licence·s open source concernée·s.

## 4. Comment signer votre accord ?

Pour confirmer votre acceptation du certificat ci-dessus, vous devez ajouter une ligne "Signed-off-by" à la fin de chaque message de commit.

### Utilisation de la ligne de commande

Utilisez l'option `-s` lors de vos commits :

```bash
git commit -s -m "Description de ma contribution"
```

Cela ajoutera automatiquement la mention suivante à votre message :
`Signed-off-by: Votre Nom <votre.email@exemple.com>`

> [!NOTE]
> Nous n'acceptons pas les Pull Requests dont les commits ne sont pas signés. Si vous avez oublié de signer vos commits, vous pouvez utiliser `git commit --amend -s` pour le dernier commit ou un rebase interactif pour les précédents.
