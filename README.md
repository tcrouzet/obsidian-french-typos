# French Typos

French Typos applique la typographie française pendant la saisie dans Obsidian, principalement en mode **Aperçu en direct** : apostrophes courbes, guillemets français et tirets de dialogue.

**Obsidian 1.14 ou ultérieur est requis.**

## Installer

### Sans terminal, avec BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) permet d’installer des plugins depuis GitHub et de les maintenir à jour.

1. Dans **Réglages → Plugins communautaires → Parcourir**, installer et activer **BRAT**.
2. Ouvrir la palette de commandes (`Cmd+P` sur Mac, `Ctrl+P` sur Windows/Linux) et lancer **BRAT: Add a beta plugin for testing**.
3. Saisir `tcrouzet/obsidian-french-typos`, puis cliquer sur **Add Plugin**.
4. Activer **French Typos** dans **Réglages → Plugins communautaires**.

Pour mettre à jour, lancer la recherche de mises à jour de BRAT depuis la palette. Répéter l’installation dans chaque coffre concerné. Voir le [guide de BRAT](https://tfthacker.com/brat-quick-guide).

### Avec le terminal

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

### Installation manuelle

1. Ouvrir la [dernière release](https://github.com/tcrouzet/obsidian-french-typos/releases/latest) et télécharger `main.js`, `manifest.json` et `styles.css`.
2. Dans le coffre, créer le dossier `.obsidian/plugins/french-typos/` et y placer les fichiers.
3. Redémarrer Obsidian, puis activer **French Typos** dans **Réglages → Plugins communautaires**.

Sur Mac, `Cmd+Maj+.` affiche les dossiers cachés dans le Finder.

## Utiliser French Typos

En mode **Aperçu en direct**, pendant la saisie :

- `'` devient `’`.
- `"` insère alternativement `« ` et ` »`, avec une espace insécable.
- `---` suivi d’une espace devient `— ` ; `--` suivi d’une espace devient `– `.

La commande **French Typos: Apostrophes**, accessible depuis la palette, remplace les apostrophes droites dans toute la note.

Dans **Réglages → French Typos**, choisir les transformations actives, l’espacement des lignes vides et la césure française en mode Lecture. L’option **Two Enters for one** insère deux sauts de ligne pour chaque appui sur Entrée ; elle peut être associée au plugin [Linter](https://github.com/platers/obsidian-linter) pour harmoniser le Markdown.

Le bouton **¶**, dans la barre d’état, active ou désactive la mise en évidence des espaces insécables et des tirets. Il peut être masqué dans les réglages.

French Typos est un plugin indépendant, non officiel.
