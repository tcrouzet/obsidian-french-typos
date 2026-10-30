import { App, Editor, MarkdownView, MarkdownRenderChild, PluginSettingTab, Plugin, SettingDefinitionItem, addIcon, editorInfoField } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';

const refreshHighlight = StateEffect.define<null>();

declare module "obsidian" {
    interface Plugin {
        addStyle(css: string): void;
    }
}

interface FrenchTyposSettings {
	apostrophe: boolean;
	doubleApostropheQuotes: boolean;
	quotationmarks: boolean;
	emdashes: boolean;
	endashes: boolean;
	twoenters: boolean;
	desactivatelinks: boolean;
	hyphenate: boolean;
	firstLineIndent: boolean;
	emptytlines: string;
	highlightEnabled: boolean;
	highlightButton: boolean;
}

const DEFAULT_SETTINGS: FrenchTyposSettings = {
	apostrophe: true,
	doubleApostropheQuotes: false,
	quotationmarks: true,
	emdashes: true,
	endashes: true,
	twoenters: false,
	desactivatelinks: true,
	hyphenate: true,
	firstLineIndent: true,
	emptytlines: 'small',
	highlightEnabled: true,
	highlightButton: true,
}

function doubleApostropheQuote(beforeCursor: string): string | null {
	if (!beforeCursor.endsWith("'") && !beforeCursor.endsWith("’")) return null;
	return beforeCursor.lastIndexOf('“') > beforeCursor.lastIndexOf('”') ? '”' : '“';
}

function noteBodyStart(text: string): number {
	const opening = /^\uFEFF?---[ \t]*(?:\r?\n|$)/.exec(text);
	if (!opening) return 0;
	const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(text.slice(opening[0].length));
	if (!closing) return text.length + 1;
	return opening[0].length + closing.index + closing[0].length + (closing[0].endsWith('\n') ? 0 : 1);
}

function markIndentExclusions(element: HTMLElement) {
	const paragraphs = element.matches('.cm-line, p') ? [element] : Array.from(element.querySelectorAll<HTMLElement>('.cm-line, p'));
	for (const paragraph of paragraphs) {
		paragraph.classList.toggle('french-typos-no-indent', !!paragraph.querySelector('hr, img:not(.cm-widgetBuffer), .image-embed, .cm-image'));
	}
}

function observeIndentExclusions(element: HTMLElement): MutationObserver {
	const observer = new MutationObserver(() => markIndentExclusions(element));
	observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
	markIndentExclusions(element);
	return observer;
}

export default class FrenchTypos extends Plugin {
	settings: FrenchTyposSettings;
	private openQuote: boolean = true; // Variable pour suivre l'état des guillemets

	async onload() {
		await this.loadSettings();
		this.updateFirstLineIndent();
		this.register(() => document.body.classList.remove('french-typos-indent'));

		addIcon('french-typos', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 6-6 6 6 6m8-12-6 6 6 6"/></svg>');
		this.addSettingTab(new FrenchTyposSettingTab(this.app, this));

		this.addCommand({
			id: 'Apostrophes',
			name: 'Apostrophes',
			editorCallback: (editor: Editor) => {
				this.updateApostrophes(editor);
			}
		});

		this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (!activeView || activeView.getMode() !== 'source' || !activeView.editor.hasFocus() || !event.composedPath().includes(activeView.contentEl)) {
				return;
			}

			const activeState = activeView.getState();

			if (activeView && activeView.getMode() === 'source' && activeState?.["source"] === false) {
				const editor = activeView.editor;
				const bodyStart = noteBodyStart(editor.getValue());
				if (editor.listSelections().some(({ anchor, head }) =>
					editor.posToOffset(anchor) < bodyStart || editor.posToOffset(head) < bodyStart)) return;
				const cursor = editor.getCursor();
				const quote = (event.key === "'" || event.key === '’') && this.settings.doubleApostropheQuotes && !editor.getSelection()
					? doubleApostropheQuote(editor.getRange(editor.offsetToPos(bodyStart), cursor))
					: null;

				if (quote) {
					event.preventDefault();
					editor.replaceRange(quote, { line: cursor.line, ch: cursor.ch - 1 }, cursor);
					editor.setCursor(cursor);
				} else if (event.key === "'" && this.settings.apostrophe) {
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

				} else if (event.key === ' ' && editor.getRange({ line: cursor.line, ch: cursor.ch - 3 }, cursor) === '---' && this.settings.emdashes) {
					event.preventDefault();
					editor.replaceRange("— ", { line: cursor.line, ch: cursor.ch - 3 }, { line: cursor.line, ch: cursor.ch });
				
				} else if (event.key === ' ' && editor.getRange({ line: cursor.line, ch: cursor.ch - 2 }, cursor) === '--' && this.settings.emdashes) {
					event.preventDefault();
					editor.replaceRange("– ", { line: cursor.line, ch: cursor.ch - 2 }, { line: cursor.line, ch: cursor.ch });
				
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
			if (activeView && activeView.getMode() === 'source' && activeState?.["source"] === false && parent.classList.contains('cm-link') && this.settings.desactivatelinks) {
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
		this.registerEditorExtension(this.createIndentExclusions());
		this.registerMarkdownPostProcessor((element, context) => {
			const observer = observeIndentExclusions(element);
			const child = new MarkdownRenderChild(element);
			child.register(() => observer.disconnect());
			context.addChild(child);
		});

        // Add a status bar item
		this.updateStatusBarButton();

	}

	updateApostrophes(editor: Editor) {
		const cursor = editor.getCursor();
		const text = editor.getValue();
		const bodyStart = noteBodyStart(text);
		const updatedText = text.slice(0, bodyStart) + text.slice(bodyStart).replace(/'/g, "’");
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
		const data: unknown = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS };
		if (typeof data !== 'object' || data === null) return;

		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof FrenchTyposSettings)[]) {
			const value = (data as Record<string, unknown>)[key];
			if (key === 'emptytlines') {
				if (value === 'normal' || value === 'small' || value === 'invisible') {
					this.settings.emptytlines = value;
				}
			} else if (typeof value === 'boolean') {
				this.settings[key] = value;
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateFirstLineIndent();
		this.updateStatusBarButton();
	}

	updateFirstLineIndent() {
		document.body.classList.toggle('french-typos-indent', this.settings.firstLineIndent);
	}

	createIndentExclusions() {
		return ViewPlugin.fromClass(class {
			observer: MutationObserver | undefined;

			constructor(view: EditorView) {
				if (view.state.field(editorInfoField, false) instanceof MarkdownView) {
					this.observer = observeIndentExclusions(view.contentDOM);
				}
			}

			destroy() {
				this.observer?.disconnect();
			}
		});
	}

	// Highlighting zone

	createDecorations() {
		const invisibleCharDecoration = Decoration.mark({ class: 'invisible-char' });
		const tabDecoration = Decoration.mark({ class: 'french-typos-tab-char' });
		const emDashDecoration = Decoration.mark({ class: 'em-dash-char' });
		const enDashDecoration = Decoration.mark({ class: 'en-dash-char' });
		const emptyLineDecoration = Decoration.line({ class: 'french-typos-empty-line' });
		const frontmatterDecoration = Decoration.line({ class: 'french-typos-frontmatter' });
		const highlightEnabled = () => this.settings.highlightEnabled;

		return ViewPlugin.fromClass(class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged || update.transactions.some(transaction =>
					transaction.effects.some(effect => effect.is(refreshHighlight)))) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			buildDecorations(view: EditorView) {
				if (!(view.state.field(editorInfoField, false) instanceof MarkdownView)) return Decoration.none;
				const builder = new RangeSetBuilder<Decoration>();
				const enabled = highlightEnabled();
				const bodyStart = noteBodyStart(view.state.doc.toString());
				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					for (let i = 0; i <= text.length; i++) {
						if (from + i < bodyStart) {
							if (view.state.doc.lineAt(from + i).from === from + i) {
								builder.add(from + i, from + i, frontmatterDecoration);
							}
							continue;
						}
						if ((i === 0 || text[i - 1] === '\n') && view.state.doc.lineAt(from + i).length === 0) {
							builder.add(from + i, from + i, emptyLineDecoration);
						}
						if (!enabled) continue;
						if (text[i] === '\u00A0') {
							builder.add(from + i, from + i + 1, invisibleCharDecoration);
						}
						if (text[i] === '\t') {
							builder.add(from + i, from + i + 1, tabDecoration);
						}
						if (text[i] === '—') {
							builder.add(from + i, from + i + 1, emDashDecoration);
						}
						if (text[i] === '–') {
							builder.add(from + i, from + i + 1, enDashDecoration);
						}
					}
				}
				return builder.finish();
			}
		}, {
			decorations: value => value.decorations
		});
	}

	addStatusBarButton() {
		if (!this.settings.highlightButton) return;

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.id = "highlight-status-bar-button"; // Ajoutez un ID unique
		
		// Ajouter les classes standard d'Obsidian
		statusBarItemEl.addClass("mod-clickable");
		
		// Créer la structure HTML similaire aux autres boutons
		statusBarItemEl.createSpan({ cls: 'status-bar-item-icon', text: '¶' });

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
		void this.saveSettings();
		this.refreshDecorations();
    }

	refreshDecorations() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView && leaf.view.editor) {
				const editorView = (leaf.view.editor as Editor & { cm?: EditorView }).cm;
				
				if (editorView) {
					editorView.dispatch({
						effects: refreshHighlight.of(null)
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
	override icon = 'french-typos';
	plugin: FrenchTypos;

	constructor(app: App, plugin: FrenchTypos) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof FrenchTyposSettings>[] {
		return [
			{
				name: 'French Typos works mainly in Live Preview mode.'
			},
			{
				name: 'Apostrophe',
				desc: 'Activate typographic apostrophe',
				control: { type: 'toggle', key: 'apostrophe' }
			},
			{
				name: 'Double apostrophes to curly quotes',
				desc: 'Convert two consecutive apostrophes into “ or ”, closing an already open quote',
				control: { type: 'toggle', key: 'doubleApostropheQuotes' }
			},
			{
				name: 'French quotation marks and hard spaces',
				desc: 'Convert standard quotation marks',
				control: { type: 'toggle', key: 'quotationmarks' }
			},
			{
				name: 'Em dashes (quadratin)',
				desc: 'Convert "--- " into em dashes —',
				control: { type: 'toggle', key: 'emdashes' }
			},
			{
				name: 'En dashes (demi-quadratin)',
				desc: 'Convert "-- " into en dashes –',
				control: { type: 'toggle', key: 'endashes' }
			},
			{
				name: 'Two Enters for one',
				desc: 'One Enter create a Markdown paragraph',
				control: { type: 'toggle', key: 'twoenters' }
			},
			{
				name: 'Simulate Shift+Click on links',
				desc: 'Display the URL instead of opening',
				control: { type: 'toggle', key: 'desactivatelinks' }
			},
			{
				name: 'First line indent',
				desc: 'Indent the first line of paragraphs in Live Preview and Reading view',
				render: setting => {
					setting.addToggle(toggle => toggle
						.setValue(this.plugin.settings.firstLineIndent)
						.onChange(async value => {
							this.plugin.settings.firstLineIndent = value;
							await this.plugin.saveSettings();
						}));
				}
			},
			{
				name: 'Empty lines',
				desc: 'Reload your Vault to process…',
				control: {
					type: 'dropdown',
					key: 'emptytlines',
					options: { normal: 'Normal', small: 'Small', invisible: 'Invisible' }
				}
			},
			{
				name: 'Hyphenate French rules',
				desc: 'Only in Reading view (reload your Vault to process)',
				control: { type: 'toggle', key: 'hyphenate' }
			},
			{
				type: 'group',
				heading: 'Highlight hidden hardspaces, tabs and dashes',
				items: [
					{
						name: 'Highlight',
						desc: 'Enable highlight',
						render: setting => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.highlightEnabled)
								.onChange(async value => {
									this.plugin.settings.highlightEnabled = value;
									await this.plugin.saveSettings();
									this.plugin.refreshDecorations();
								}));
						}
					},
					{
						name: 'Highlight status bar button',
						desc: 'Show on/off button in status bar',
						render: setting => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.highlightButton)
								.onChange(async value => {
									this.plugin.settings.highlightButton = value;
									await this.plugin.saveSettings();
								}));
						}
					}
				]
			}
		];
	}
}
