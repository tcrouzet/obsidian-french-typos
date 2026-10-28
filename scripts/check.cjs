const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { transformSync } = require('esbuild');
const { EditorState, StateField } = require('@codemirror/state');
const { Linter } = require('eslint');

const source = readFileSync('plugin/main.ts', 'utf8');
const linter = new Linter();
linter.defineParser('@typescript-eslint/parser', require('@typescript-eslint/parser'));
const rules = require('@typescript-eslint/eslint-plugin').rules;
for (const name of ['no-this-alias', 'no-explicit-any', 'no-unused-vars', 'no-unsafe-assignment', 'no-floating-promises']) {
	linter.defineRule('@typescript-eslint/' + name, rules[name]);
}
assert.deepEqual(linter.verify(source, {
	parser: '@typescript-eslint/parser',
	parserOptions: { ecmaVersion: 2020, sourceType: 'module', project: './tsconfig.json', tsconfigRootDir: process.cwd() },
	rules: {
		'@typescript-eslint/no-this-alias': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-unused-vars': 'error',
		'@typescript-eslint/no-unsafe-assignment': 'error',
		'@typescript-eslint/no-floating-promises': 'error'
	}
}, 'plugin/main.ts'), []);
console.log('Source lint: no this alias, explicit any, unused variables, unsafe assignments or floating promises.');

class MarkdownView {}
const editorInfoField = StateField.define({ create: () => new MarkdownView(), update: value => value });
function noteState(config) {
	return EditorState.create({ ...config, extensions: [editorInfoField] });
}
const moduleForCheck = { exports: {} };
runInNewContext(transformSync(source + '\nexport { FrenchTyposSettingTab, doubleApostropheQuote, noteBodyStart };', {
	loader: 'ts', format: 'cjs'
}).code, {
	module: moduleForCheck,
	exports: moduleForCheck.exports,
	require: name => name === 'obsidian' ? {
		Plugin: class {},
		PluginSettingTab: class { constructor(app, plugin) { this.plugin = plugin; } },
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

let state = noteState({ doc: 'a\u00a0—–\n\nb\n', selection: { anchor: 2 } });
const view = { state, visibleRanges: [{ from: 0, to: state.doc.length }] };
const instance = plugin.createDecorations().create(view);
assert.deepEqual(decorations(instance, state.doc.length), [
	[1, 2, 'invisible-char'], [2, 3, 'em-dash-char'], [3, 4, 'en-dash-char'],
	[5, 5, 'french-typos-empty-line'], [8, 8, 'french-typos-empty-line']
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
	[5, 5, 'french-typos-empty-line'], [8, 8, 'french-typos-empty-line']
]);
plugin.settings.highlightEnabled = true;
plugin.refreshDecorations();
assert.equal(decorations(instance, state.doc.length).length, 5);
console.log('Highlight refresh: marks toggle, empty lines remain, text and cursor stay unchanged.');

const partialState = noteState({ doc: 'ab\n\ncd' });
const partial = plugin.createDecorations().create({ state: partialState, visibleRanges: [{ from: 1, to: 4 }] });
assert.deepEqual(decorations(partial, partialState.doc.length), [[3, 3, 'french-typos-empty-line']]);
console.log('Partial viewport: only genuinely empty lines are marked.');

const yamlDoc = "---\ntitle: 'a\u00a0—'\n\n---\n\nTexte\u00a0—";
const yamlState = noteState({ doc: yamlDoc });
const yamlDecorations = plugin.createDecorations().create({ state: yamlState, visibleRanges: [{ from: 0, to: yamlDoc.length }] });
assert.ok(decorations(yamlDecorations, yamlDoc.length)
	.filter(([, , name]) => ['invisible-char', 'em-dash-char', 'en-dash-char'].includes(name))
	.every(([from]) => from >= yamlDoc.indexOf('Texte')), 'YAML must have no typographic highlighting');
assert.equal(decorations(yamlDecorations, yamlDoc.length).filter(([, , name]) => name === 'french-typos-frontmatter').length, 4);
for (const doc of [yamlDoc, "Texte\u00a0—\n\n"]) {
	for (const extensions of [[], [editorInfoField.init(() => ({}))]]) {
		const state = EditorState.create({ doc, extensions });
		const foreign = plugin.createDecorations().create({ state, visibleRanges: [{ from: 0, to: doc.length }] });
		assert.deepEqual(decorations(foreign, doc.length), [], 'Editors outside Markdown notes must have no plugin decorations');
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
const definitions = tab.getSettingDefinitions();
const settings = Array.from(definitions).flatMap(definition => Array.from(definition.items || [definition]));
assert.equal(settings.filter(definition => definition.control).map(definition => definition.control.key).sort().join(','),
	'apostrophe,desactivatelinks,doubleApostropheQuotes,emdashes,emptytlines,endashes,hyphenate,quotationmarks,twoenters');
assert.equal(typeof settings.find(definition => definition.name === 'Highlight').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'Highlight status bar button').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'First line indent').render, 'function');
console.log('Settings search: existing settings are declared and highlight callbacks remain available.');

async function checkLoadedSettings() {
	const defaults = {
		apostrophe: true, doubleApostropheQuotes: false, quotationmarks: true, emdashes: true, endashes: true,
		twoenters: false, desactivatelinks: true, hyphenate: true, firstLineIndent: true, emptytlines: 'small',
		highlightEnabled: true, highlightButton: true
	};
	for (const data of [null, undefined, [], 'invalid', 42, { apostrophe: 'false', doubleApostropheQuotes: 'true', firstLineIndent: 'false', emptytlines: 'invalid' }]) {
		plugin.loadData = async () => data;
		await plugin.loadSettings();
		assert.deepEqual({ ...plugin.settings }, defaults);
	}
	for (const emptytlines of ['normal', 'small', 'invisible']) {
		const saved = {
			apostrophe: false, doubleApostropheQuotes: true, quotationmarks: false, emdashes: false, endashes: false,
			twoenters: true, desactivatelinks: false, hyphenate: false, firstLineIndent: false, emptytlines,
			highlightEnabled: false, highlightButton: false
		};
		plugin.loadData = async () => saved;
		await plugin.loadSettings();
		assert.deepEqual({ ...plugin.settings }, saved);
	}
	plugin.loadData = async () => ({ apostrophe: false });
	await plugin.loadSettings();
	assert.deepEqual({ ...plugin.settings }, { ...defaults, apostrophe: false });
	plugin.loadData = async () => { throw new Error('Cannot read settings'); };
	await assert.rejects(() => plugin.loadSettings(), /Cannot read settings/);
	console.log('Settings loading: saved values preserved; missing or invalid values use defaults; read errors propagate.');
}

checkLoadedSettings().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
