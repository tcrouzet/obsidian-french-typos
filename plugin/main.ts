import { App, Editor, FuzzySuggestModal, MarkdownView, MarkdownRenderChild, Menu, Notice, PluginSettingTab, Plugin, SettingDefinitionItem, addIcon, editorInfoField, getLanguage } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, drawSelection } from '@codemirror/view';
import { Compartment, RangeSetBuilder, StateEffect } from '@codemirror/state';

import { setLocale, t } from './i18n';

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
	firstLineIndent: boolean;
	emptytlines: string;
	highlightEnabled: boolean;
	highlightButton: boolean;
	cursorWidth: number;
	highlightColor: string;
	bookFont: string;
	bookTextSize: number;
	bookJustify: boolean;
	bookNoParagraphSpacing: boolean;
	bookIndent: boolean;
	bookHyphenate: boolean;
}

const DEFAULT_SETTINGS: FrenchTyposSettings = {
	apostrophe: true,
	doubleApostropheQuotes: false,
	quotationmarks: true,
	emdashes: true,
	endashes: true,
	twoenters: false,
	desactivatelinks: true,
	firstLineIndent: true,
	emptytlines: 'small',
	highlightEnabled: true,
	highlightButton: true,
	cursorWidth: 0,
	highlightColor: '',
	bookFont: 'serif',
	bookTextSize: 20,
	bookJustify: true,
	bookNoParagraphSpacing: true,
	bookIndent: true,
	bookHyphenate: true,
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
	private bookViews = new WeakSet<MarkdownView>();
	private bookSidebars: { leftCollapsed: boolean; rightCollapsed: boolean } | null = null;

	async onload() {
		setLocale(getLanguage());
		await this.loadSettings();
		this.updateParagraphStyles();
		this.register(() => document.body.classList.remove('french-typos-indent', 'french-typos-nobr', 'french-typos-small_interline'));

		addIcon('french-typos', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 6-6 6 6 6m8-12-6 6 6 6"/></svg>');
		this.addSettingTab(new FrenchTyposSettingTab(this.app, this));
		this.registerDomEvent(document, 'click', (event: MouseEvent) => {
			const button = (event.target as Element | null)?.closest?.<HTMLElement>('.status-bar .plugin-editor-status');
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!button || !view || event.button !== 0) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const menu = new Menu().setUseNativeMenu(false);
			const current = this.bookViews.has(view) ? 'book' : view.getMode() !== 'source' ? null : view.getState().source === true ? 'source' : 'live';
			for (const [mode, title, icon] of [
				['source', t('sourceMode'), 'code-xml'],
				['live', t('livePreview'), 'edit-3'],
				['book', t('bookPreview'), 'book-open']
			] as const) {
				menu.addItem(item => item.setTitle(title).setIcon(icon).setChecked(current === mode)
					.onClick(() => this.setBookMode(view, mode)));
			}
			menu.showAtMouseEvent(event);
		}, true);
		this.registerEvent(this.app.workspace.on('layout-change', () => this.updateBookViews()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.updateBookViews()));
		this.register(() => {
			this.app.workspace.iterateAllLeaves(leaf => {
				if (leaf.view instanceof MarkdownView) this.bookViews.delete(leaf.view);
			});
			this.updateBookViews();
		});

		this.addCommand({
			id: 'Apostrophes',
			name: t('apostrophes'),
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

		// Highlighting zone
		document.body.classList.add('french-typos-highlight');


		this.registerEditorExtension(this.createDecorations());
		this.registerEditorExtension(this.createCursorStyle());
		this.registerEditorExtension(EditorView.contentAttributes.of((view): Record<string, string> => {
			const info = view.state.field(editorInfoField, false);
			return info instanceof MarkdownView && this.bookViews.has(info) && this.settings.bookHyphenate ? { lang: 'fr' } : {};
		}));
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

	async loadSettings() {
		const data: unknown = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS };
		if (typeof data !== 'object' || data === null) return;

		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof FrenchTyposSettings)[]) {
			const saved = data as Record<string, unknown>;
			const value = key === 'highlightColor' ? saved.highlightColor ?? saved.cursorColor : saved[key];
			if (key === 'emptytlines') {
				if (value === 'normal' || value === 'small' || value === 'invisible') {
					this.settings.emptytlines = value;
				}
			} else if (key === 'cursorWidth') {
				if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) this.settings.cursorWidth = value;
			} else if (key === 'highlightColor') {
				if (typeof value === 'string' && (value === '' || /^#[0-9a-f]{6}$/i.test(value))) this.settings.highlightColor = value;
			} else if (key === 'bookFont') {
				if (typeof value === 'string' && value.length <= 100 && !/[\r\n]/.test(value)) this.settings.bookFont = value.trim() || 'serif';
			} else if (key === 'bookTextSize') {
				if (typeof value === 'number' && Number.isInteger(value) && value >= 12 && value <= 40) this.settings.bookTextSize = value;
			} else if (typeof value === 'boolean') {
				this.settings[key] = value;
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateParagraphStyles();
		this.updateStatusBarButton();
		this.updateBookViews();
		this.refreshDecorations();
	}

	updateParagraphStyles() {
		document.body.classList.toggle('french-typos-indent', this.settings.firstLineIndent);
		document.body.classList.toggle('french-typos-nobr', this.settings.emptytlines === 'invisible');
		document.body.classList.toggle('french-typos-small_interline', this.settings.emptytlines === 'small');
	}

	bookStyleProperties(): Record<string, string> {
		const font = this.settings.bookFont || 'serif';
		return {
			'--french-typos-book-font': ['serif', 'sans-serif', 'monospace', 'system-ui'].includes(font) ? font : JSON.stringify(font),
			'--french-typos-book-size': `${this.settings.bookTextSize}px`,
			'--french-typos-book-align': this.settings.bookJustify ? 'justify' : 'start',
			'--french-typos-book-gap': this.settings.bookNoParagraphSpacing ? 'none' : 'block',
			'--french-typos-book-indent': this.settings.bookIndent ? '2rem' : '0px',
			'--french-typos-book-hyphens': this.settings.bookHyphenate ? 'auto' : 'manual'
		};
	}

	async bookFontChoices(): Promise<string[]> {
		const fonts = new Set(['serif']);
		const addFont = (font: unknown) => {
			if (typeof font === 'string' && font.trim() && font.length <= 100 && !/[\r\n]/.test(font)) fonts.add(font.trim());
		};
		addFont(this.settings.bookFont);
		document.fonts.forEach(font => addFont(font.family.replace(/^["']|["']$/g, '')));
		try {
			// Reuse the system-font module shipped with desktop Obsidian.
			const host = window as unknown as { require?: (name: string) => unknown };
			const api = host.require?.('get-fonts') as { getFonts?: () => Promise<unknown> } | undefined;
			if (typeof api?.getFonts !== 'function') throw new Error('System font access is unavailable');
			const installed: unknown = await api.getFonts();
			if (!Array.isArray(installed)) throw new Error('Invalid system font list');
			for (const font of installed as unknown[]) addFont(font);
		} catch (error) {
			console.error('French Typos: could not list system fonts', error);
			new Notice(t('fontsUnavailable'));
		}
		return ['serif', ...Array.from(fonts).filter(font => font && font !== 'serif').sort((a, b) => a.localeCompare(b))];
	}

	async setBookMode(view: MarkdownView, mode: 'source' | 'live' | 'book') {
		const selections = view.editor.listSelections();
		const scroll = view.editor.getScrollInfo();
		await view.leaf.setViewState({ type: 'markdown', state: { ...view.getState(), mode: 'source', source: mode === 'source' } });
		this.bookViews.delete(view);
		if (mode === 'book') this.bookViews.add(view);
		this.updateBookViews();
		this.refreshDecorations();
		view.editor.setSelections(selections);
		view.editor.scrollTo(scroll.left, scroll.top);
		view.editor.focus();
	}

	updateBookViews() {
		this.app.workspace.iterateAllLeaves(leaf => {
			if (!(leaf.view instanceof MarkdownView)) return;
			const view = leaf.view;
			if (view.getMode() !== 'source' || view.getState().source === true) this.bookViews.delete(view);
			const root = view.containerEl;
			const active = this.bookViews.has(view);
			const wasActive = root.classList.contains('french-typos-book-preview');
			if (active && !wasActive) {
				const scroller = root.querySelector<HTMLElement>('.cm-scroller');
				const style = scroller?.ownerDocument.defaultView?.getComputedStyle(scroller);
				if (style) {
					root.style.setProperty('--french-typos-book-original-font', style.fontFamily);
					root.style.setProperty('--french-typos-book-original-size', style.fontSize);
					root.style.setProperty('--french-typos-book-original-height', style.lineHeight);
				}
			}
			root.classList.toggle('french-typos-book-preview', active);
			for (const [property, value] of Object.entries(this.bookStyleProperties())) {
				if (active) root.style.setProperty(property, value);
				else root.style.removeProperty(property);
			}
			if (!active) {
				for (const property of ['font', 'size', 'height']) root.style.removeProperty(`--french-typos-book-original-${property}`);
			}
			if (active || wasActive) (view.editor as Editor & { cm?: EditorView }).cm?.requestMeasure();
		});
		const button = document.querySelector<HTMLElement>('.status-bar .plugin-editor-status');
		const current = this.app.workspace.getActiveViewOfType(MarkdownView);
		this.updateBookSidebars(!!current && this.bookViews.has(current));
		if (button && current && this.bookViews.has(current)) {
			if (!button.hasAttribute('data-french-typos-label')) button.setAttribute('data-french-typos-label', button.getAttribute('aria-label') ?? '');
			button.setAttribute('aria-label', t('bookPreview'));
		} else if (button?.hasAttribute('data-french-typos-label')) {
			if (button.getAttribute('aria-label') === t('bookPreview')) button.setAttribute('aria-label', button.getAttribute('data-french-typos-label') ?? '');
			button.removeAttribute('data-french-typos-label');
		}
	}

	updateBookSidebars(active: boolean) {
		const { leftSplit, rightSplit } = this.app.workspace;
		if (active && !this.bookSidebars) {
			this.bookSidebars = { leftCollapsed: leftSplit.collapsed, rightCollapsed: rightSplit.collapsed };
			leftSplit.collapse();
			rightSplit.collapse();
		} else if (!active && this.bookSidebars) {
			const saved = this.bookSidebars;
			this.bookSidebars = null;
			if (saved.leftCollapsed) leftSplit.collapse();
			else leftSplit.expand();
			if (saved.rightCollapsed) rightSplit.collapse();
			else rightSplit.expand();
		}
	}

	cursorAttributes(view: EditorView): Record<string, string> {
		if (!(view.state.field(editorInfoField, false) instanceof MarkdownView)) return {};
		const style = `--french-typos-highlight-color: ${this.settings.highlightColor || 'var(--h1-color, var(--text-normal))'};`;
		const bodyStart = noteBodyStart(view.state.doc.toString());
		if (!this.settings.cursorWidth || view.state.selection.ranges.some(range => range.from < bodyStart)) return { style };
		return {
			class: 'french-typos-bold-cursor',
			style: `${style} --french-typos-cursor-width: ${this.settings.cursorWidth}px;`
		};
	}

	createCursorStyle() {
		const attributes = (view: EditorView) => this.cursorAttributes(view);
		const compartment = new Compartment();
		const standard: [] = [];
		const drawing = drawSelection();
		return [compartment.of(standard), EditorView.editorAttributes.of(attributes), ViewPlugin.fromClass(class {
			destroyed = false;
			constructor(view: EditorView) { this.sync(view); }
			update(update: ViewUpdate) { this.sync(update.view); }
			sync(view: EditorView) {
				if (compartment.get(view.state) === (attributes(view).class ? drawing : standard)) return;
				// Reconfigure after the current editor update has finished.
				queueMicrotask(() => {
					if (this.destroyed) return;
					const desired = attributes(view).class ? drawing : standard;
					if (compartment.get(view.state) !== desired) view.dispatch({ effects: compartment.reconfigure(desired) });
				});
			}
			destroy() { this.destroyed = true; }
		})];
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
		statusBarItemEl.setAttribute("aria-label", t('toggleHighlight'));
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

class BookFontModal extends FuzzySuggestModal<string> {
	constructor(app: App, private fonts: string[], private choose: (font: string) => Promise<void>) {
		super(app);
		this.setPlaceholder(t('chooseFont'));
	}
	getItems() { return this.fonts; }
	getItemText(font: string) { return font === 'serif' ? t('systemSerif') : font; }
	onChooseItem(font: string): void { void this.choose(font); }
}

class FrenchTyposSettingTab extends PluginSettingTab {
	override icon = 'french-typos';
	plugin: FrenchTypos;

	constructor(app: App, plugin: FrenchTypos) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override async setControlValue(key: string, value: unknown) {
		await super.setControlValue(key, value);
		this.plugin.updateParagraphStyles();
		this.plugin.updateBookViews();
		this.plugin.refreshDecorations();
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof FrenchTyposSettings>[] {
		return [
			{
				type: 'group',
				heading: t('livePreview'),
				items: [
					{
						name: t('apostrophe'),
						desc: t('apostropheDescription'),
						control: { type: 'toggle', key: 'apostrophe' }
					},
					{
						name: t('doubleApostropheQuotes'),
						desc: t('doubleApostropheQuotesDescription'),
						control: { type: 'toggle', key: 'doubleApostropheQuotes' }
					},
					{
						name: t('quotationMarks'),
						desc: t('quotationMarksDescription'),
						control: { type: 'toggle', key: 'quotationmarks' }
					},
					{
						name: t('emDashes'),
						desc: t('emDashesDescription'),
						control: { type: 'toggle', key: 'emdashes' }
					},
					{
						name: t('enDashes'),
						desc: t('enDashesDescription'),
						control: { type: 'toggle', key: 'endashes' }
					},
					{
						name: t('twoEnters'),
						desc: t('twoEntersDescription'),
						control: { type: 'toggle', key: 'twoenters' }
					},
					{
						name: t('disableLinks'),
						desc: t('disableLinksDescription'),
						control: { type: 'toggle', key: 'desactivatelinks' }
					},
					{
						name: t('firstLineIndent'),
						desc: t('firstLineIndentDescription'),
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
						name: t('emptyLines'),
						desc: t('emptyLinesDescription'),
						control: {
							type: 'dropdown',
							key: 'emptytlines',
							options: { normal: t('normal'), small: t('small'), invisible: t('invisible') }
						}
					}
				]
			},
			{
				type: 'group',
				heading: t('bookPreview'),
				items: [
					{
						name: t('bookPreview'),
						desc: t('bookPreviewDescription'),
						render: setting => {
							const view = this.app.workspace.getMostRecentLeaf()?.view;
							setting.addToggle(toggle => toggle
								.setValue(view instanceof MarkdownView && view.containerEl.classList.contains('french-typos-book-preview'))
								.setDisabled(!(view instanceof MarkdownView))
								.onChange(async value => {
									if (view instanceof MarkdownView) await this.plugin.setBookMode(view, value ? 'book' : 'live');
								}));
						}
					},
					{
						name: t('font'),
						desc: t('fontDescription'),
						render: setting => {
							setting.addText(text => {
								text.inputEl.maxLength = 100;
								text.setPlaceholder('serif').setValue(this.plugin.settings.bookFont).onChange(async value => {
									this.plugin.settings.bookFont = value.trim() || 'serif';
									await this.plugin.saveSettings();
								});
								setting.addButton(button => button.setButtonText(t('choose')).onClick(async () => {
									const fonts = await this.plugin.bookFontChoices();
									new BookFontModal(this.app, fonts, async font => {
										this.plugin.settings.bookFont = font;
										text.setValue(font);
										await this.plugin.saveSettings();
									}).open();
								}));
							});
						}
					},
					{ name: t('justifyParagraphs'), control: { type: 'toggle', key: 'bookJustify' } },
					{ name: t('noParagraphSpacing'), control: { type: 'toggle', key: 'bookNoParagraphSpacing' } },
					{ name: t('firstLineIndent'), control: { type: 'toggle', key: 'bookIndent' } },
					{ name: t('frenchHyphenation'), control: { type: 'toggle', key: 'bookHyphenate' } },
					{
						name: t('textSize'),
						control: { type: 'slider', key: 'bookTextSize', min: 12, max: 40, step: 1, displayFormat: value => t('pixels', { value }) }
					}
				]
			},
			{
				type: 'group',
				heading: t('highlight'),
				items: [
					{
						name: t('highlight'),
						desc: t('highlightDescription'),
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
						name: t('color'),
						desc: t('colorDescription'),
						render: setting => {
							const sample = setting.settingEl.createEl('canvas', { cls: 'french-typos-theme-color', attr: { width: '1', height: '1' } });
							const context = sample.getContext('2d');
							let themeColor = '#000000';
							if (context) {
								context.fillStyle = sample.ownerDocument.defaultView?.getComputedStyle(sample).color ?? themeColor;
								context.fillRect(0, 0, 1, 1);
								themeColor = '#' + Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)
									.map(channel => channel.toString(16).padStart(2, '0')).join('');
							}
							sample.remove();
							setting.addColorPicker(color => color
								.setValue(this.plugin.settings.highlightColor || themeColor)
								.onChange(async value => {
									this.plugin.settings.highlightColor = value;
									await this.plugin.saveSettings();
								}));
							setting.addButton(button => button.setButtonText(t('theme')).onClick(async () => {
								this.plugin.settings.highlightColor = '';
								await this.plugin.saveSettings();
								this.update();
							}));
						}
					},
					{
						name: t('cursorSize'),
						desc: t('cursorSizeDescription'),
						render: setting => {
							setting.addSlider(slider => slider
								.setLimits(0, 6, 1)
								.setValue(this.plugin.settings.cursorWidth)
								.setDisplayFormat(value => value === 0 ? t('standard') : t('pixels', { value }))
								.setInstant(true)
								.onChange(async value => {
									this.plugin.settings.cursorWidth = value;
									await this.plugin.saveSettings();
								}));
						}
					},
					{
						name: t('button'),
						desc: t('buttonDescription'),
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
