const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { buildSync } = require('esbuild');
const { EditorState, StateField } = require('@codemirror/state');
const { Linter } = require('eslint');

const source = readFileSync('plugin/main.ts', 'utf8');
assert.doesNotMatch(readFileSync('styles.css', 'utf8'), /:has\s*\(/, 'Indentation must not use :has selectors');
const linter = new Linter();
linter.defineParser('@typescript-eslint/parser', require('@typescript-eslint/parser'));
const rules = require('@typescript-eslint/eslint-plugin').rules;
for (const name of ['no-this-alias', 'no-explicit-any', 'no-unused-vars', 'no-unsafe-assignment', 'no-floating-promises', 'no-unsafe-call', 'no-unsafe-argument', 'no-unsafe-return', 'no-misused-promises']) {
	linter.defineRule('@typescript-eslint/' + name, rules[name]);
}
for (const file of ['plugin/main.ts', 'plugin/i18n.ts']) assert.deepEqual(linter.verify(readFileSync(file, 'utf8'), {
	parser: '@typescript-eslint/parser',
	parserOptions: { ecmaVersion: 2020, sourceType: 'module', project: './tsconfig.json', tsconfigRootDir: process.cwd() },
	rules: {
		'@typescript-eslint/no-this-alias': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-unused-vars': 'error',
		'@typescript-eslint/no-unsafe-assignment': 'error',
		'@typescript-eslint/no-floating-promises': 'error',
		'@typescript-eslint/no-unsafe-call': 'error',
		'@typescript-eslint/no-unsafe-argument': 'error',
		'@typescript-eslint/no-unsafe-return': 'error',
		'@typescript-eslint/no-misused-promises': 'error'
	}
}, file), []);
console.log('Source lint: no this alias, explicit any, unused variables, unsafe assignments or floating promises.');

class MarkdownView {}
const editorInfoField = StateField.define({ create: () => new MarkdownView(), update: value => value });
function noteState(config) {
	return EditorState.create({ ...config, extensions: [editorInfoField] });
}
const moduleForCheck = { exports: {} };
runInNewContext(buildSync({
	stdin: { contents: source + "\nexport { FrenchTyposSettingTab, BookFontModal, doubleApostropheQuote, noteBodyStart }; export { setLocale, t } from './i18n';", loader: 'ts', resolveDir: process.cwd() + '/plugin' },
	bundle: true, write: false, format: 'cjs', external: ['obsidian', '@codemirror/state', '@codemirror/view']
}).outputFiles[0].text, {
	module: moduleForCheck,
	exports: moduleForCheck.exports,
	require: name => name === 'obsidian' ? {
		Plugin: class {},
		FuzzySuggestModal: class { setPlaceholder(value) { this.placeholder = value; } },
		PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
		MarkdownView,
		editorInfoField
	} : require(name)
});

const plugin = new moduleForCheck.exports.default();
plugin.settings = { highlightEnabled: true };

for (const [beforeCursor, expected] of [
	["'", '“'], ["Texte ’", '“'],
	["“Citation'", '”'], ["“Citation\nsuite’", '”'],
	["“Citation” puis 'autre'", '“'],
	['', null], ['Texte', null], ["Texte'\n", null]
]) {
	assert.equal(moduleForCheck.exports.doubleApostropheQuote(beforeCursor), expected);
}
console.log('Double apostrophes: straight and curly apostrophes open or close quotes using preceding text, including across paragraphs.');

function decorations(instance, length) {
	const result = [];
	instance.decorations.between(0, length, (from, to, decoration) => {
		result.push([from, to, decoration.spec.class]);
	});
	return result;
}

for (const [doc, expected] of [
	['', [0]],
	['\n', [0, 1]],
	['a\n\n', [2, 3]],
	['a\n\nb', [2]],
	['a\n \nb', []]
]) {
	const state = noteState({ doc });
	const instance = plugin.createDecorations().create({ state, visibleRanges: [{ from: 0, to: doc.length }] });
	assert.deepEqual(decorations(instance, doc.length).map(([from]) => from), expected);
}
console.log('Empty lines: empty document, consecutive, trailing and whitespace-only lines pass.');

let state = noteState({ doc: 'a\u00a0—–\t\n\nb\n', selection: { anchor: 2 } });
const view = { state, visibleRanges: [{ from: 0, to: state.doc.length }] };
const instance = plugin.createDecorations().create(view);
assert.deepEqual(decorations(instance, state.doc.length), [
	[1, 2, 'invisible-char'], [2, 3, 'em-dash-char'], [3, 4, 'en-dash-char'],
	[4, 5, 'french-typos-tab-char'],
	[6, 6, 'french-typos-empty-line'], [9, 9, 'french-typos-empty-line']
]);

const markdownView = new MarkdownView();
markdownView.editor = { cm: { dispatch(spec) {
	const transaction = state.update(spec);
	assert.equal(transaction.docChanged, false);
	assert.equal(transaction.state.doc.toString(), state.doc.toString());
	assert.equal(transaction.state.selection.main.anchor, 2);
	state = transaction.state;
	view.state = state;
	instance.update({ docChanged: false, viewportChanged: false, transactions: [transaction], view });
} } };
plugin.app = { workspace: { iterateAllLeaves(callback) { callback({ view: markdownView }); } } };
plugin.settings.highlightEnabled = false;
plugin.refreshDecorations();
assert.deepEqual(decorations(instance, state.doc.length), [
	[6, 6, 'french-typos-empty-line'], [9, 9, 'french-typos-empty-line']
]);
plugin.settings.highlightEnabled = true;
plugin.refreshDecorations();
assert.equal(decorations(instance, state.doc.length).length, 6);
console.log('Highlight refresh: marks toggle, empty lines remain, text and cursor stay unchanged.');

const partialState = noteState({ doc: 'ab\n\ncd' });
const partial = plugin.createDecorations().create({ state: partialState, visibleRanges: [{ from: 1, to: 4 }] });
assert.deepEqual(decorations(partial, partialState.doc.length), [[3, 3, 'french-typos-empty-line']]);
console.log('Partial viewport: only genuinely empty lines are marked.');

const yamlDoc = "---\ntitle: 'a\u00a0—\t'\n\n---\n\nTexte\u00a0—\t";
const yamlState = noteState({ doc: yamlDoc });
const yamlDecorations = plugin.createDecorations().create({ state: yamlState, visibleRanges: [{ from: 0, to: yamlDoc.length }] });
assert.ok(decorations(yamlDecorations, yamlDoc.length)
	.filter(([, , name]) => ['invisible-char', 'em-dash-char', 'en-dash-char', 'french-typos-tab-char'].includes(name))
	.every(([from]) => from >= yamlDoc.indexOf('Texte')), 'YAML must have no typographic highlighting');
assert.equal(decorations(yamlDecorations, yamlDoc.length).filter(([, , name]) => name === 'french-typos-frontmatter').length, 4);
for (const doc of [yamlDoc, "Texte\u00a0—\t\n\n"]) {
	for (const extensions of [[], [editorInfoField.init(() => ({}))]]) {
		const state = EditorState.create({ doc, extensions });
		const foreign = plugin.createDecorations().create({ state, visibleRanges: [{ from: 0, to: doc.length }] });
		assert.deepEqual(decorations(foreign, doc.length), [], 'Editors outside Markdown notes must have no plugin decorations');
		const foreignIndent = plugin.createIndentExclusions().create({ state });
		assert.equal(foreignIndent.observer, undefined, 'Editors outside Markdown notes must not be observed');
		foreignIndent.destroy();
	}
}
for (const [text, expected] of [
	["Texte 'normal'", 0], ["Texte\n---\n'a'", 0],
	["---\ntitle: 'a'\n---\nTexte", "---\ntitle: 'a'\n---\n".length],
	['---\n---\n', '---\n---\n'.length],
	["\uFEFF--- \r\ntitle: 'a'\r\n... \r\nTexte", "\uFEFF--- \r\ntitle: 'a'\r\n... \r\n".length],
	['---\ntitle: a', '---\ntitle: a'.length + 1],
	['---\n---', '---\n---'.length + 1]
]) {
	assert.equal(moduleForCheck.exports.noteBodyStart(text), expected);
}
console.log('Note scope: frontmatter is protected, including unfinished YAML; foreign editors have no decorations.');

const tab = new moduleForCheck.exports.FrenchTyposSettingTab({}, plugin);
assert.equal(tab.icon, 'french-typos');
const definitions = tab.getSettingDefinitions();
const settings = Array.from(definitions).flatMap(definition => Array.from(definition.items || [definition]));
assert.equal(settings.filter(definition => definition.control).map(definition => definition.control.key).sort().join(','),
	'apostrophe,bookHyphenate,bookIndent,bookJustify,bookNoParagraphSpacing,bookTextSize,desactivatelinks,doubleApostropheQuotes,emdashes,emptytlines,endashes,quotationmarks,twoenters');
assert.equal(typeof settings.find(definition => definition.name === 'Highlight').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'Button').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'First line indent').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'Cursor size').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'Color').render, 'function');
assert.doesNotMatch(settings.find(definition => definition.name === 'Empty lines').desc, /reload/i);
assert.deepEqual(Array.from(Array.from(definitions).find(definition => definition.heading === 'Highlight').items, item => item.name),
	['Highlight', 'Color', 'Cursor size', 'Button']);
const bookSettings = Array.from(Array.from(definitions).find(definition => definition.heading === 'Book preview').items);
assert.equal(typeof bookSettings.find(definition => definition.name === 'Font').render, 'function');
assert.equal(bookSettings[0].name, 'Book preview');
assert.equal(typeof bookSettings[0].render, 'function');
assert.equal(bookSettings.find(definition => definition.name === 'Text size').control.min, 12);
assert.equal(bookSettings.find(definition => definition.name === 'Text size').control.max, 40);
assert.equal(definitions[0].heading, 'Live preview');
assert.ok(!settings.some(item => item.control?.key === 'hyphenate'));
assert.doesNotMatch(readFileSync('styles.css', 'utf8'), /french-typos-hyphens/);
const catalogs = Object.fromEntries(['en', 'fr'].map(language => [language, JSON.parse(readFileSync(`locales/${language}.json`, 'utf8'))]));
assert.deepEqual(Object.keys(catalogs.fr).sort(), Object.keys(catalogs.en).sort());
for (const [key, english] of Object.entries(catalogs.en)) {
	assert.ok(catalogs.fr[key].trim(), `Missing French translation: ${key}`);
	assert.deepEqual(catalogs.fr[key].match(/\{\w+\}/g), english.match(/\{\w+\}/g), `Mismatched placeholders: ${key}`);
}
const { setLocale, t } = moduleForCheck.exports;
for (const language of ['fr', 'fr-CA', 'FR_fr']) {
	setLocale(language);
	const translated = tab.getSettingDefinitions();
	assert.deepEqual(Array.from(translated, group => group.heading), ['Aperçu en direct', 'Aperçu livre', 'Mise en évidence']);
	assert.deepEqual(Array.from(translated[2].items, item => item.name), ['Mise en évidence', 'Couleur', 'Épaisseur du curseur', 'Bouton']);
	assert.deepEqual({ ...translated[0].items.find(item => item.control?.key === 'emptytlines').control.options },
		{ normal: 'Normales', small: 'Réduites', invisible: 'Invisibles' });
	assert.equal(t('pixels', { value: 24 }), '24 px');
	let chosen;
	const modal = new moduleForCheck.exports.BookFontModal({}, ['serif'], async font => { chosen = font; });
	assert.equal(modal.placeholder, 'Choisir une police');
	assert.equal(modal.getItemText('serif'), 'Serif du système');
	assert.equal(modal.getItemText('Palatino'), 'Palatino');
	assert.equal(modal.onChooseItem('Palatino'), undefined);
	assert.equal(chosen, 'Palatino');
}
for (const language of ['en-US', 'de', '']) {
	setLocale(language);
	assert.equal(tab.getSettingDefinitions()[0].heading, 'Live preview');
}
for (const file of ['plugin/main.ts', 'plugin/i18n.ts']) {
	for (const [, key] of readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'/g)) assert.ok(key in catalogs.en, `Unknown translation key: ${key}`);
}
assert.doesNotMatch(source, /(?:name|desc|heading):\s*['"]/);
console.log('Localized settings: French variants, English fallback, translated font chooser, complete catalogs; Reading hyphenation removed.');

const bookDefaults = {
	bookFont: 'serif', bookTextSize: 20, bookJustify: true, bookNoParagraphSpacing: true, bookIndent: true, bookHyphenate: true
};
plugin.settings = { ...bookDefaults };
assert.equal(plugin.bookStyleProperties()['--french-typos-book-font'], 'serif');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-size'], '20px');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-gap'], 'none');
plugin.settings = { ...bookDefaults, bookFont: 'iA Writer Duo V', bookJustify: false, bookNoParagraphSpacing: false, bookIndent: false, bookHyphenate: false };
assert.equal(plugin.bookStyleProperties()['--french-typos-book-font'], '"iA Writer Duo V"');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-align'], 'start');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-gap'], 'block');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-indent'], '0px');
assert.equal(plugin.bookStyleProperties()['--french-typos-book-hyphens'], 'manual');
console.log('Book preview: system serif default, quoted custom families and independent paragraph controls.');

plugin.settings = { cursorWidth: 3, highlightColor: '' };
const cursorState = noteState({ doc: 'Normal paragraph' });
const automaticCursor = plugin.cursorAttributes({ state: cursorState });
assert.equal(automaticCursor.class, 'french-typos-bold-cursor');
assert.ok(automaticCursor.style.includes('3px'));
assert.ok(automaticCursor.style.includes('var(--h1-color, var(--text-normal))'));
plugin.settings.highlightColor = '#12abEF';
assert.ok(plugin.cursorAttributes({ state: cursorState }).style.includes('#12abEF'));
const cursorYaml = '---\ntitle: note\n---\nBody';
for (const anchor of [0, 5]) {
	assert.equal(plugin.cursorAttributes({ state: noteState({ doc: cursorYaml, selection: { anchor } }) }).class, undefined);
}
assert.equal(plugin.cursorAttributes({ state: noteState({ doc: cursorYaml, selection: { anchor: cursorYaml.length } }) }).class,
	'french-typos-bold-cursor');
assert.deepEqual({ ...plugin.cursorAttributes({ state: EditorState.create({ doc: 'Settings editor' }) }) }, {});
plugin.settings.cursorWidth = 0;
assert.equal(plugin.cursorAttributes({ state: cursorState }).class, undefined);
assert.ok(plugin.cursorAttributes({ state: cursorState }).style.includes('#12abEF'), 'Color must remain available to highlighted characters with a standard cursor');
console.log('Bold cursor: automatic or custom color, YAML and foreign editors excluded, standard width restores native styling.');

async function checkLoadedSettings() {
	const defaults = {
		...bookDefaults,
		apostrophe: true, doubleApostropheQuotes: false, quotationmarks: true, emdashes: true, endashes: true,
		twoenters: false, desactivatelinks: true, firstLineIndent: true, emptytlines: 'small',
		highlightEnabled: true, highlightButton: true, cursorWidth: 0, highlightColor: ''
	};
	for (const data of [null, undefined, [], 'invalid', 42, { hyphenate: true }, { hyphenate: false }, { apostrophe: 'false', doubleApostropheQuotes: 'true', firstLineIndent: 'false', emptytlines: 'invalid' }]) {
		plugin.loadData = async () => data;
		await plugin.loadSettings();
		assert.deepEqual({ ...plugin.settings }, defaults);
	}
	for (const emptytlines of ['normal', 'small', 'invisible']) {
		const saved = {
			...bookDefaults, bookFont: 'Palatino', bookTextSize: 24, bookJustify: false, bookNoParagraphSpacing: false, bookIndent: false, bookHyphenate: false,
			apostrophe: false, doubleApostropheQuotes: true, quotationmarks: false, emdashes: false, endashes: false,
			twoenters: true, desactivatelinks: false, firstLineIndent: false, emptytlines,
			highlightEnabled: false, highlightButton: false, cursorWidth: 3, highlightColor: '#12abEF'
		};
		plugin.loadData = async () => saved;
		await plugin.loadSettings();
		assert.deepEqual({ ...plugin.settings }, saved);
	}
	plugin.loadData = async () => ({ apostrophe: false });
	await plugin.loadSettings();
	assert.deepEqual({ ...plugin.settings }, { ...defaults, apostrophe: false });
	for (const bookTextSize of [0, 11, 41, 20.5, NaN, Infinity, '20', true]) {
		plugin.loadData = async () => ({ bookTextSize });
		await plugin.loadSettings();
		assert.equal(plugin.settings.bookTextSize, 20);
	}
	for (const bookFont of [null, 42, 'bad\nfont', 'x'.repeat(101)]) {
		plugin.loadData = async () => ({ bookFont });
		await plugin.loadSettings();
		assert.equal(plugin.settings.bookFont, 'serif');
	}
	for (const cursorWidth of [-1, 7, 2.5, NaN, Infinity, '3', true]) {
		plugin.loadData = async () => ({ cursorWidth });
		await plugin.loadSettings();
		assert.equal(plugin.settings.cursorWidth, 0);
	}
	for (const highlightColor of ['red', '#123', '#123456; color: red', 42, true]) {
		plugin.loadData = async () => ({ highlightColor });
		await plugin.loadSettings();
		assert.equal(plugin.settings.highlightColor, '');
	}
	plugin.loadData = async () => ({ cursorColor: '#123456' });
	await plugin.loadSettings();
	assert.equal(plugin.settings.highlightColor, '#123456', 'Preserve the previously saved cursor color');
	plugin.loadData = async () => ({ cursorColor: '#123456', highlightColor: '#abcdef' });
	await plugin.loadSettings();
	assert.equal(plugin.settings.highlightColor, '#abcdef');
	plugin.loadData = async () => { throw new Error('Cannot read settings'); };
	await assert.rejects(() => plugin.loadSettings(), /Cannot read settings/);
	console.log('Settings loading: saved values preserved; missing or invalid values use defaults; read errors propagate.');
}

async function checkBookToggle() {
	const view = new MarkdownView();
	let active = false;
	view.containerEl = { classList: { contains: name => active && name === 'french-typos-book-preview' } };
	let current = view;
	const calls = [];
	const testPlugin = { setBookMode: async (target, mode) => { calls.push([target, mode]); } };
	const app = { workspace: { getMostRecentLeaf: () => current ? { view: current } : null } };
	const tab = new moduleForCheck.exports.FrenchTyposSettingTab(app, testPlugin);
	const render = () => {
		const toggle = {
			setValue(value) { this.value = value; return this; },
			setDisabled(disabled) { this.disabled = disabled; return this; },
			onChange(callback) { this.change = callback; return this; }
		};
		tab.getSettingDefinitions()[1].items[0].render({ addToggle: callback => callback(toggle) });
		return toggle;
	};
	let toggle = render();
	assert.equal(toggle.value, false);
	assert.equal(toggle.disabled, false);
	await toggle.change(true);
	assert.deepEqual(calls.pop(), [view, 'book']);
	active = true;
	toggle = render();
	assert.equal(toggle.value, true);
	await toggle.change(false);
	assert.deepEqual(calls.pop(), [view, 'live']);
	for (current of [null, {}]) {
		toggle = render();
		assert.equal(toggle.value, false);
		assert.equal(toggle.disabled, true);
		await toggle.change(true);
		assert.equal(calls.length, 0);
	}
	console.log('Book preview switch: reflects note mode, routes On/Off to Book/Live, disabled without a Markdown note.');
}

Promise.all([checkLoadedSettings(), checkBookToggle()]).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
