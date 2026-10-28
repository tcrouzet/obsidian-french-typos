# French Typos

**La typographie française, au fil de vos phrases.**

Vous écrivez, les apostrophes se courbent, les guillemets s’ouvrent et les dialogues prennent leur tiret. French Typos transforme les signes courants du clavier pendant la saisie dans Obsidian. Les alinéas, la césure et l’espacement des paragraphes donnent à vos notes une allure de livre.

[Installer French Typos depuis Obsidian](https://community.obsidian.md/plugins/french-typos) · [Signaler un problème](https://github.com/tcrouzet/obsidian-french-typos/issues)

> « J’écris, dit-elle. Et les bons signes suivent. »

## Installer French Typos

1. Dans Obsidian, ouvrir **Réglages → Plugins communautaires → Parcourir**.
2. Chercher **French Typos**, puis choisir **Installer** et **Activer**.
3. Ouvrir une note en **Aperçu en direct** et commencer à écrire.

Obsidian **1.14 ou ultérieur** est requis. Les transformations pendant la saisie fonctionnent dans l’éditeur de la note en Aperçu en direct. Le frontmatter YAML et les champs de réglages sont exclus ; les réglages de lecture sont décrits ci-dessous.

## Écrire avec les bons signes

| Vous tapez | French Typos insère |
| --- | --- |
| `'` | Une apostrophe courbe `’`, comme dans `l’écriture` |
| `"` | Un guillemet ouvrant `« `, puis un fermant ` »`, avec une espace insécable |
| `---` suivi d’une espace | Un tiret cadratin et une espace insécable `— ` |
| `--` suivi d’une espace | Un tiret demi-cadratin et une espace insécable `– ` |
| `''`, avec l’option correspondante | Un guillemet anglais `“`, ou `”` si un guillemet est déjà ouvert |

Les espaces insécables gardent le guillemet avec le texte et le tiret avec le début du dialogue, même en fin de ligne.

Pour les guillemets anglais, activer **Double apostrophes to curly quotes** dans **Réglages → French Typos**. Saisir `''bonjour''` donne `“bonjour”`. L’option est désactivée par défaut ; elle fonctionne aussi avec la conversion en apostrophes courbes active.

Une note contient déjà des apostrophes droites ? Ouvrir la palette de commandes (`Cmd+P` sur Mac, `Ctrl+P` sur Windows/Linux) et lancer **French Typos: Apostrophes**. La commande les remplace dans le corps de la note en conservant le frontmatter YAML.

## Donner à vos notes une allure de livre

Dans **Réglages → French Typos**, ajuster la présentation à votre façon d’écrire :

- **First line indent** ajoute un alinéa aux paragraphes en Aperçu en direct et en mode Lecture. Activé par défaut, il se désactive immédiatement, indépendamment des lignes vides et de la césure.
- **Empty lines** conserve les lignes vides à leur hauteur normale, les réduit ou les masque à l’écran en Aperçu en direct. Le texte Markdown reste intact.
- **Hyphenate French rules** active la césure française en mode Lecture, pour répartir les mots en fin de ligne.
- **Two Enters for one** insère deux sauts de ligne à chaque appui sur Entrée, pour créer un paragraphe Markdown. L’option est désactivée par défaut.

Recharger le coffre après avoir modifié **Empty lines** ou **Hyphenate French rules**. Pour harmoniser ensuite le Markdown, **Two Enters for one** peut être associé au plugin [Linter](https://github.com/platers/obsidian-linter).

## Voir les espaces invisibles

Une espace insécable ressemble à une espace ordinaire. French Typos la met en évidence, ainsi que les tirets cadratins et demi-cadratins, pour faciliter la relecture. Les tabulations apparaissent avec une flèche bleue `→` dans l’éditeur, sans modifier le texte ni leur largeur.

Cliquer sur **¶**, dans la barre d’état, pour activer ou désactiver cette mise en évidence. Les options **Highlight** et **Highlight status bar button**, dans les réglages, permettent de choisir le surlignage et l’affichage du bouton.

## Installer avec BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) permet d’installer le plugin directement depuis GitHub et de le maintenir à jour.

1. Installer et activer **BRAT** depuis les plugins communautaires d’Obsidian.
2. Ouvrir la palette de commandes et lancer **BRAT: Add a beta plugin for testing**.
3. Saisir `tcrouzet/obsidian-french-typos`, puis cliquer sur **Add Plugin**.
4. Activer **French Typos** dans **Réglages → Plugins communautaires**.

Pour mettre à jour, lancer la recherche de mises à jour de BRAT depuis la palette. Répéter l’installation dans chaque coffre concerné. Voir le [guide de BRAT](https://tfthacker.com/brat-quick-guide).

## Installer depuis le terminal

Il faut **Bash et curl** : sur Mac ou Linux, ou sous Windows avec Git Bash.

Fermer Obsidian, remplacer `/chemin/vers/Mon coffre` par le chemin du coffre, puis lancer :

```bash
(
  set -eu
  cd "/chemin/vers/Mon coffre/.obsidian"
  download_dir=$(mktemp -d)
  trap 'rm -rf -- "$download_dir"' EXIT

  for file in main.js manifest.json styles.css; do
    curl -fL "https://github.com/tcrouzet/obsidian-french-typos/releases/latest/download/$file" \
      -o "$download_dir/$file"
  done

  mkdir -p plugins/french-typos
  cp "$download_dir/"* plugins/french-typos/
)
```

Les fichiers sont téléchargés avant de remplacer ceux du plugin. Les notes et le fichier de réglages `data.json` ne sont pas modifiés. Si le dossier de configuration porte un autre nom, remplacer `.obsidian` dans la commande. Pour une installation existante dans un autre dossier, adapter aussi `plugins/french-typos` à son emplacement.

Rouvrir Obsidian et activer **French Typos** dans **Réglages → Plugins communautaires**. Pour mettre à jour, relancer les mêmes commandes après avoir fermé Obsidian.

## Installer manuellement

1. Ouvrir la [dernière release](https://github.com/tcrouzet/obsidian-french-typos/releases/latest) et télécharger `main.js`, `manifest.json` et `styles.css`.
2. Dans le coffre, créer le dossier `.obsidian/plugins/french-typos/` et y placer les fichiers.
3. Redémarrer Obsidian, puis activer **French Typos** dans **Réglages → Plugins communautaires**.

Sur Mac, `Cmd+Maj+.` affiche les dossiers cachés dans le Finder.

## Un problème, une idée ?

[Ouvrir un ticket sur GitHub](https://github.com/tcrouzet/obsidian-french-typos/issues), en précisant la version d’Obsidian, le système et un court exemple du texte saisi.

French Typos est un plugin indépendant, non officiel, créé par [Thierry Crouzet](https://tcrouzet.com).
