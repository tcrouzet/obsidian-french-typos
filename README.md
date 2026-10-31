# French Typos

**La typographie française, au fil de vos phrases.**

Vous écrivez, les apostrophes se courbent, les guillemets s’ouvrent et les dialogues prennent leur tiret. French Typos transforme les signes courants du clavier pendant la saisie dans Obsidian. Les alinéas, la césure et l’espacement des paragraphes donnent à vos notes une allure de livre.

[Installer French Typos depuis Obsidian](https://community.obsidian.md/plugins/french-typos) · [Signaler un problème](https://github.com/tcrouzet/obsidian-french-typos/issues)

> « J’écris, dit-elle. Et les bons signes suivent. »

## Installer French Typos

1. Dans Obsidian, ouvrir **Réglages → Plugins communautaires → Parcourir**.
2. Chercher **French Typos**, puis choisir **Installer** et **Activer**.
3. Ouvrir une note en **Aperçu en direct** et commencer à écrire.

Obsidian **1.14 ou ultérieur** est requis. L’interface suit automatiquement la langue choisie dans Obsidian : français ou anglais, avec l’anglais pour les autres langues. Les traductions sont regroupées dans `locales/fr.json` et `locales/en.json`. Les transformations pendant la saisie fonctionnent dans l’éditeur de la note en Aperçu en direct. Le frontmatter YAML et les champs de réglages sont exclus.

## Écrire avec les bons signes

| Vous tapez | French Typos insère |
| --- | --- |
| `'` | Une apostrophe courbe `’`, comme dans `l’écriture` |
| `"` | Un guillemet ouvrant `« `, puis un fermant ` »`, avec une espace insécable |
| `---` suivi d’une espace | Un tiret cadratin et une espace insécable `— ` |
| `--` suivi d’une espace | Un tiret demi-cadratin et une espace insécable `– ` |
| `''`, avec l’option correspondante | Un guillemet anglais `“`, ou `”` si un guillemet est déjà ouvert |

Les espaces insécables gardent le guillemet avec le texte et le tiret avec le début du dialogue, même en fin de ligne.

Pour les guillemets anglais, activer **Deux apostrophes pour des guillemets anglais** dans **Réglages → French Typos**. Saisir `''bonjour''` donne `“bonjour”`. L’option est désactivée par défaut ; elle fonctionne aussi avec la conversion en apostrophes courbes active.

Une note contient déjà des apostrophes droites ? Ouvrir la palette de commandes (`Cmd+P` sur Mac, `Ctrl+P` sur Windows/Linux) et lancer **French Typos: Apostrophes**. La commande les remplace dans le corps de la note en conservant le frontmatter YAML.

## Donner à vos notes une allure de livre

Dans **Réglages → French Typos → Aperçu en direct**, ajuster la présentation à votre façon d’écrire :

- **Alinéas** active l’indentation des paragraphes en Aperçu en direct et en mode Lecture. Ce réglage est activé par défaut et s’applique immédiatement, indépendamment des lignes vides et de la césure.
- **Lignes vides** permet de conserver les lignes vides à leur hauteur normale, de les réduire ou de les masquer à l’écran en Aperçu en direct. Le texte Markdown reste intact.
- **Deux retours à la ligne pour un** insère deux sauts de ligne à chaque appui sur Entrée, pour créer un paragraphe Markdown. L’option est désactivée par défaut.

Les changements de présentation s’appliquent immédiatement, sans recharger le coffre. Pour harmoniser ensuite le Markdown, **Deux retours à la ligne pour un** peut être associé au plugin [Linter](https://github.com/platers/obsidian-linter).

## Relire en aperçu livre, continuer à écrire

Dans le menu du stylo de la barre d’état, choisir **Aperçu livre** pour changer la présentation de la note dans le même onglet. Le texte reste éditable et la position du curseur est conservée. **Aperçu en direct** retrouve la présentation habituelle ; **Mode source** reste disponible. Le mode Lecture est retiré de ce menu pendant que French Typos est actif.

Le bouton On/Off en tête de **Réglages → French Typos → Aperçu livre** permet aussi d’activer ce mode pour la note courante. Le désactiver ramène à l’aperçu en direct. Sans note ouverte, le bouton est désactivé.

L’aperçu livre masque les panneaux latéraux, dont l’explorateur de fichiers. En quittant ce mode, les panneaux ouverts auparavant sont rétablis et ceux qui étaient fermés le restent.

La section **Aperçu livre** des réglages possède son propre profil : police, taille du texte de 12 à 40 pixels, justification, suppression de l’espace entre paragraphes, alinéas et césure française. Par défaut : **police serif du système, 20 pixels, justification, paragraphes sans espacement, alinéas et césure activés**. Les changements s’appliquent immédiatement aux notes affichées en Aperçu livre, sans modifier les réglages de l’aperçu habituel.

Le bouton **Choisir** du réglage **Police** ouvre une liste avec recherche parmi les polices installées sur l’ordinateur et celles déjà chargées dans Obsidian. Le nom peut aussi être saisi directement. Les citations, images, séparateurs et blocs de code gardent leur structure ; les alinéas concernent uniquement les paragraphes courants.

## Voir les espaces invisibles

Une espace insécable ressemble à une espace ordinaire. French Typos la met en évidence, ainsi que les tirets cadratins et demi-cadratins, pour faciliter la relecture. Les tabulations apparaissent avec une flèche `→` dans l’éditeur, sans modifier le texte ni leur largeur.

Cliquer sur **¶**, dans la barre d’état, pour activer ou désactiver cette mise en évidence. Les options **Mise en évidence** et **Bouton**, dans les réglages, permettent de choisir le surlignage et l’affichage du bouton.

Dans le groupe **Mise en évidence**, **Épaisseur du curseur** épaissit le curseur du texte des notes jusqu’à 6 pixels. Tout à gauche, **Standard** rétablit le curseur habituel. **Couleur** choisit une couleur commune au curseur, aux espaces insécables, aux tabulations et aux tirets mis en évidence ; le bouton **Thème** rétablit la couleur des titres H1 du thème, suivie automatiquement en clair et en sombre. Le curseur reste standard dans le frontmatter YAML et les champs de réglages. Cette option fonctionne indépendamment de la mise en évidence des caractères invisibles.

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
