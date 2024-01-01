import { Editor, MarkdownView, Plugin } from 'obsidian';

interface FrenchTyposSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: FrenchTyposSettings = {
	mySetting: 'default'
}

export default class FrenchTypos extends Plugin {
	settings: FrenchTyposSettings;
	private openQuote: boolean = true; // Variable pour suivre l'état des guillemets

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.addCommand({
			id: 'Apostrophes',
			name: 'Apostrophes',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.updateApostrophes(editor);
			}
		});

		this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const editor = activeView.editor;
				const cursor = editor.getCursor();
				if (event.key === "") {
					event.preventDefault();
					editor.replaceRange("’", cursor);
					editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
				} else if (event.key === '"') {
					event.preventDefault();
					if (this.openQuote) {
						editor.replaceRange("« ", cursor);
					} else {
						editor.replaceRange(" »", cursor);
					}
					editor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
					this.openQuote = !this.openQuote;
				} else if (event.key === '-' && editor.getRange({ line: cursor.line, ch: cursor.ch - 1 }, cursor) === '-') {
					event.preventDefault();
					editor.replaceRange("— ", { line: cursor.line, ch: cursor.ch - 2 }, { line: cursor.line, ch: cursor.ch });
					editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
				} else if (event.key === 'Enter') {
					event.preventDefault();
					editor.replaceRange("\n\n", cursor);
					editor.setCursor({ line: cursor.line + 2, ch: cursor.ch });
				}
			}
		});
	}

	updateApostrophes(editor: Editor) {
		const cursor = editor.getCursor();
		const text = editor.getValue();
		const updatedText = text.replace(/'/g, "’");
		editor.setValue(updatedText);
		editor.setCursor(cursor);
	}
}
