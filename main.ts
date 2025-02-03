// tcrouzet

import { App, Editor, MarkdownView, PluginSettingTab, Plugin, Setting, TFile } from 'obsidian';

interface FrenchTyposSettings {
	apostrophe: boolean;
	quotationmarks: boolean;
	emdashes: boolean;
	twoenters: boolean;
	desactivatelinks: boolean;
	hyphenate: boolean;
	emptytlines: string;
}

const DEFAULT_SETTINGS: FrenchTyposSettings = {
	apostrophe: true,
	quotationmarks: true,
	emdashes: true,
	twoenters: false,
	desactivatelinks: true,
	hyphenate: true,
	emptytlines: 'small'
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
			await this.injectCSS(this.nobrcss());
		}else if (this.settings.emptytlines == "small"){
			await this.injectCSS(this.small_interline());
		}


		if (this.settings.hyphenate) {
			await this.setLanguage();
			await this.injectCSS(this.hyphenscss());
		}

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
	}

	// /Users/thierrycrouzet/Documents/ObsidianDev/.obsidian/plugins/obsidian-french-typos/nobr.css
	async injectCSS(css: string) {
		const styleEl = document.createElement('style');
		styleEl.innerHTML = css;
		document.head.appendChild(styleEl);
    }

	nobrcss() {
		return `
		.markdown-source-view.mod-cm6.is-live-preview .HyperMD-header{
			text-indent: 0rem !important;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .cm-line {
			text-indent: 2rem;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .HyperMD-header-1{
			margin-bottom: 2rem !important;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .HyperMD-header-2{
			margin-top: 1rem !important;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .HyperMD-header-3{
			margin-top: 1rem !important;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .cm-line:has(> br) {
			display: none;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .cm-active:has(> br) {
			display: inline !important;
		}
		
		.markdown-source-view.mod-cm6.is-live-preview .cm-line.HyperMD-list-line {
			margin: 0.25rem 0;
		}
		`
	}

	hyphenscss() {
		return `
		.markdown-preview-view p {
			text-indent: 3rem;
			text-align: justify;
			margin-top: 0;
			margin-bottom: 0;
			hyphens: auto;
			word-wrap: break-word;
			hyphenate-character: auto;
		    hyphenate-limit-chars: 6 3 3;
		}
		`
	}

	small_interline() {
		return `
		.markdown-source-view.mod-cm6.is-live-preview .HyperMD-header{
			text-indent: 0rem !important;
		}

		.markdown-source-view.mod-cm6.is-live-preview .cm-line {
			text-indent: 2rem;
		}

		.markdown-source-view.mod-cm6.is-live-preview .cm-line:has(> br) {
			height: 0.7rem;text-indent: 2rem;
		}
	`
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

		const titleEl = containerEl.createEl('h2', { text: 'French Typos settings' });
		const desEl = containerEl.createEl('p', { text: 'Works mainly in Live Preview mode.' });

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
		.setName('Simulate Shift+Clic on links')
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

	}
}