import { App, Editor, MarkdownView, PluginSettingTab, Plugin, Setting, Component, TFile } from 'obsidian';
import { EditorView, Decoration, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

declare module "obsidian" {
    interface Plugin {
        addStyle(css: string): void;
    }
}

interface FrenchTyposSettings {
	apostrophe: boolean;
	quotationmarks: boolean;
	emdashes: boolean;
	twoenters: boolean;
	desactivatelinks: boolean;
	hyphenate: boolean;
	emptytlines: string;
	highlightEnabled: boolean;
	highlightButton: boolean;
}

const DEFAULT_SETTINGS: FrenchTyposSettings = {
	apostrophe: true,
	quotationmarks: true,
	emdashes: true,
	twoenters: false,
	desactivatelinks: true,
	hyphenate: true,
	emptytlines: 'small',
	highlightEnabled: true,
	highlightButton: true,
}

export default class FrenchTypos extends Plugin {
	settings: FrenchTyposSettings;
	private openQuote: boolean = true; // Variable pour suivre l'état des guillemets

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.addSettingTab(new FrenchTyposSettingTab(this.app, this));

		this.addCommand({
			id: 'Apostrophes',
			name: 'Apostrophes',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.updateApostrophes(editor);
			}
		});

		this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView || activeView.getMode() !== 'source') {
				return;
			}

			const activeState = this.app.workspace.getLeaf().getViewState().state

			if (activeView && activeView.getMode() === 'source' && activeState["source"] === false) {
				const editor = activeView.editor;
				const cursor = editor.getCursor();

				if (event.key === "'" && this.settings.apostrophe) {
					event.preventDefault();
					const selection = editor.getSelection();
				
					if (selection.length > 0) {
						// Remplace le texte sélectionné par l’apostrophe
						editor.replaceSelection("’");
					} else {
						// Insère l’apostrophe à la position du curseur
						editor.replaceRange("’", cursor);
						editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
					}
				
				} else if (event.key === '"' && this.settings.quotationmarks) {
					event.preventDefault();
					if (this.openQuote) {
						editor.replaceRange("« ", cursor);
					} else {
						editor.replaceRange(" »", cursor);
					}
					editor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
					this.openQuote = !this.openQuote;

				} else if (event.key === ' ' && editor.getRange({ line: cursor.line, ch: cursor.ch - 2 }, cursor) === '--' && this.settings.emdashes) {
					event.preventDefault();
					editor.replaceRange("— ", { line: cursor.line, ch: cursor.ch - 2 }, { line: cursor.line, ch: cursor.ch });
				
				} else if (event.key === 'Enter'  && this.settings.twoenters) {
					event.preventDefault();
					editor.replaceRange("\n\n", cursor);
					editor.setCursor({ line: cursor.line + 2, ch: cursor.ch });
				}
			}
		});

		this.registerDomEvent(document, 'click', (event: MouseEvent) => {

			const target = event.target as HTMLElement;
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView)
				return;

			const mode = activeView?.getMode()
			if (mode == "source" || mode == "preview")
				return;
		
			// Vérifier si le clic est dans l'éditeur actif
			const editorEl = activeView.containerEl.querySelector('.cm-editor');
			if (editorEl && !editorEl.contains(target)) {
				return;
			}
		
			const parent = target.parentNode as HTMLElement;
			const ancertor = parent.parentNode;
			const activeState = this.app.workspace.getLeaf().getViewState().state;
		
			// Empêcher l'ouverture des liens cm-link
			if (activeView && activeView.getMode() === 'source' && activeState["source"] === false && parent.classList.contains('cm-link') && this.settings.desactivatelinks) {
				event.preventDefault();
				event.stopPropagation();
				const editor = activeView.editor;
				const linktext = target.textContent ?? '';
				const longtext = ancertor?.textContent ?? '';
				this.MoveCursor(editor, longtext, linktext);
			}
	
		}, true);

		if (this.settings.emptytlines == "invisible") {
			document.body.classList.add('french-typos-nobr');
		}else if (this.settings.emptytlines == "small"){
			document.body.classList.add('french-typos-small_interline');
		}

		if (this.settings.hyphenate) {
			await this.setLanguage();
			document.body.classList.add('french-typos-hyphens');
		}

		// Highlighting zone
		document.body.classList.add('french-typos-highlight');


		this.registerEditorExtension(this.createDecorations());

        // Add a status bar item
		this.updateStatusBarButton();

	}

	updateApostrophes(editor: Editor) {
		const cursor = editor.getCursor();
		const text = editor.getValue();
		const updatedText = text.replace(/'/g, "’");
		editor.setValue(updatedText);
		editor.setCursor(cursor);
	}

	MoveCursor(editor: Editor, longtext: string, linktext: string) {
		const markdownContent = editor.getValue();
		const lines = markdownContent.split('\n');
		//console.log(longtext);
		//console.log(linktext)

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const nolink = this.noLinks(lines[lineIndex]);
			const lIndex = nolink.indexOf(this.noLinks(longtext));
	
			if (lIndex !== -1) {
				//console.log("Line: "+lIndex);
				//console.log(lines[lineIndex]);
				const search = "["+linktext+"]";
				//console.log(search);
				let localIndex = lines[lineIndex].indexOf(search);
				if (localIndex !== -1) {
					const coords = { line: lineIndex, ch: localIndex }
					//console.log(coords)
					editor.setCursor(coords);
				}
			}
		}
	}

	noLinks(makdown: string){
		return makdown.replace(/\[(.*?)\]\(.*?\)/g, '$1');
	}

	async setLanguage() {
        document.documentElement.setAttribute('lang', 'fr');
    }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateStatusBarButton();
	}

	// Highlighting zone

    createDecorations() {
        const invisibleCharDecoration = Decoration.mark({
            class: 'invisible-char'
        });

	    const emDashDecoration = Decoration.mark({
			class: 'em-dash-char'
		});
		const plugin = this;

        return ViewPlugin.fromClass(class {
            decorations: any;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView) {
                const builder = new RangeSetBuilder<Decoration>();
				if (plugin.settings.highlightEnabled) {
					for (let { from, to } of view.visibleRanges) {
						let text = view.state.doc.sliceString(from, to);
						for (let i = 0; i < text.length; i++) {
							if (text[i] === '\u00A0') { // Unicode for non-breaking space
								builder.add(from + i, from + i + 1, invisibleCharDecoration);
							}
							if (text[i] === '—') { // Unicode for em dash
								builder.add(from + i, from + i + 1, emDashDecoration);
							}
						}
					}
				}
                return builder.finish();
            }
        }, {
            decorations: v => v.decorations
        });
    }

	addStatusBarButton() {
		if (!this.settings.highlightButton) return;

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.id = "highlight-status-bar-button"; // Ajoutez un ID unique
		
		// Ajouter les classes standard d'Obsidian
		statusBarItemEl.addClass("mod-clickable");
		
		// Créer la structure HTML similaire aux autres boutons
		const iconSpan = document.createElement('span');
		iconSpan.classList.add('status-bar-item-icon');
		iconSpan.textContent = '¶';
		statusBarItemEl.appendChild(iconSpan);

		// Ajouter les attributs pour le tooltip
		statusBarItemEl.setAttribute("aria-label", "Toggle highlight");
		statusBarItemEl.setAttribute("data-tooltip-position", "top");
	
		// Mettre à jour l'apparence en fonction de l'état
		const updateAppearance = () => {
			statusBarItemEl.toggleClass('highlight-enabled', this.settings.highlightEnabled);
		};
	
		// Initialiser l'apparence
		updateAppearance();
	
		// Gérer le clic
		statusBarItemEl.onClickEvent(() => {
			this.toggleHighlight();
			updateAppearance();
		});
	}

	updateStatusBarButton() {
		const existingButton = document.getElementById('highlight-status-bar-button');
		if (this.settings.highlightButton) {
			if (!existingButton) {
				this.addStatusBarButton();
			}
		} else {
			if (existingButton) {
				existingButton.remove(); // Supprimer le bouton existant
			}
		}
	}

    toggleHighlight() {
        this.settings.highlightEnabled = !this.settings.highlightEnabled;
		this.saveSettings(); // Save the new state	
		this.refreshDecorations();
    }

	refreshDecorations() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView && leaf.view.editor) {
				const editorView = (leaf.view.editor as any).cm as EditorView;
				
				if (editorView) {
					// Forcer un changement complet du document pour recalculer les décorations
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: editorView.state.doc.toString()
						}
					});
				}
			}
		});
	}

	hardspaces(content: string) {
		// Extraire les sections HTML et YAML
		const htmlRegex = /<[^>]*>/g;
		const yamlRegex = /---[\s\S]+?---/g;
	
		let htmlMatches = content.match(htmlRegex) || [];
		let yamlMatches = content.match(yamlRegex) || [];
	
		// Remplacer ces sections par des marqueurs temporaires
		content = content.replace(htmlRegex, 'HTML_PLACEHOLDER');
		content = content.replace(yamlRegex, 'YAML_PLACEHOLDER');
	
		// Appliquer les règles d'espacement
		let regex = /(.)([:;?!»])/g;
		content = content.replace(regex, (match, p1, p2) => {
			if (p1 === ' ' || p1 === '\u00A0') {
				return '\u00A0' + p2;
			}
			return p1 + '\u00A0' + p2;
		});
	
		regex = /([«—])(.)?/g;
		content = content.replace(regex, (match, p1, p2) => {
			if (p2 === ' ' || p2 === '\u00A0') {
				return p1 + '\u00A0';
			}
			return p1 + '\u00A0' + p2;
		});
	
		// Réintégrer les sections HTML et YAML
		htmlMatches.forEach(placeholder => {
			content = content.replace('HTML_PLACEHOLDER', placeholder);
		});
		yamlMatches.forEach(placeholder => {
			content = content.replace('YAML_PLACEHOLDER', placeholder);
		});

		// No Hard space in notes
		content = content.replace("]\u00A0:", "]:");
	
		return content;
	}

}

class FrenchTyposSettingTab extends PluginSettingTab {
	plugin: FrenchTypos;

	constructor(app: App, plugin: FrenchTypos) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('p', { text: 'French Typos works mainly in Live Preview mode.' });

		new Setting(containerEl)
			.setName('Apostrophe')
			.setDesc('Activate typographic apostrophe')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.apostrophe)
				.onChange(async (value) => {
					this.plugin.settings.apostrophe = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('French quotation marks and hard spaces')
		.setDesc('Convert standard quotation marks')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.quotationmarks)
			.onChange(async (value) => {
				this.plugin.settings.quotationmarks = value;
				await this.plugin.saveSettings();
			}));
	
		new Setting(containerEl)
		.setName('Em dashes')
		.setDesc('Convert "-- " into em dashes')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.emdashes)
			.onChange(async (value) => {
				this.plugin.settings.emdashes = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Two Enters for one')
		.setDesc('One Enter create a Markdown paragraph')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.twoenters)
			.onChange(async (value) => {
				this.plugin.settings.twoenters = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Simulate Shift+Click on links')
		.setDesc('Display the URL instead of opening')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.desactivatelinks)
			.onChange(async (value) => {
				this.plugin.settings.desactivatelinks = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Empty lines')
		.setDesc('Reload your Vault to process…')
		.addDropdown(dropdown => {
			dropdown.addOptions({
				'normal': 'Normal',
				'small': 'Small',
				'invisible': 'Invisible'
			});
			dropdown.setValue(this.plugin.settings.emptytlines);
			dropdown.onChange(async (value) => {
				this.plugin.settings.emptytlines = value;
				await this.plugin.saveSettings();
			});
		});
	
		new Setting(containerEl)
		.setName('Hyphenate French rules')
		.setDesc('Only in Reading view (reload your Vault to process)')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.hyphenate)
			.onChange(async (value) => {
				this.plugin.settings.hyphenate = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl).setName('Highlight hidden hardspaces and em dashes').setHeading();
	
		new Setting(containerEl)
		.setName('Highlight')
		.setDesc('Enable highlight')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.highlightEnabled)
			.onChange(async (value) => {
				// console.log("Toggling highlightEnabled to:", value);
				this.plugin.settings.highlightEnabled = value;
				await this.plugin.saveSettings();
				this.plugin.refreshDecorations();
			}));

		new Setting(containerEl)
		.setName('Highlight status bar button')
		.setDesc('Show on/off button in status bar')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.highlightButton)
			.onChange(async (value) => {
				this.plugin.settings.highlightButton = value;
				await this.plugin.saveSettings();
			}));
	
	}
}