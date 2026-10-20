const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { transformSync } = require('esbuild');
const { EditorState } = require('@codemirror/state');
const { Linter } = require('eslint');

const source = readFileSync('plugin/main.ts', 'utf8');
const linter = new Linter();
linter.defineParser('@typescript-eslint/parser', require('@typescript-eslint/parser'));
const rules = require('@typescript-eslint/eslint-plugin').rules;
for (const name of ['no-this-alias', 'no-explicit-any', 'no-unused-vars']) {
	linter.defineRule('@typescript-eslint/' + name, rules[name]);
}
assert.deepEqual(linter.verify(source, {
	parser: '@typescript-eslint/parser',
	parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
	rules: {
		'@typescript-eslint/no-this-alias': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-unused-vars': 'error'
	}
}, 'plugin/main.ts'), []);
console.log('Source lint: no this alias, explicit any or unused variables.');

class MarkdownView {}
const moduleForCheck = { exports: {} };
runInNewContext(transformSync(source + '\nexport { FrenchTyposSettingTab };', {
	loader: 'ts', format: 'cjs'
}).code, {
	module: moduleForCheck,
	exports: moduleForCheck.exports,
	require: name => name === 'obsidian' ? {
		Plugin: class {},
		PluginSettingTab: class { constructor(app, plugin) { this.plugin = plugin; } },
		MarkdownView
	} : require(name)
});

const plugin = new moduleForCheck.exports.default();
plugin.settings = { highlightEnabled: true };

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
	const state = EditorState.create({ doc });
	const instance = plugin.createDecorations().create({ state, visibleRanges: [{ from: 0, to: doc.length }] });
	assert.deepEqual(decorations(instance, doc.length).map(([from]) => from), expected);
}
console.log('Empty lines: empty document, consecutive, trailing and whitespace-only lines pass.');

let state = EditorState.create({ doc: 'a\u00a0—–\n\nb\n', selection: { anchor: 2 } });
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

const partialState = EditorState.create({ doc: 'ab\n\ncd' });
const partial = plugin.createDecorations().create({ state: partialState, visibleRanges: [{ from: 1, to: 4 }] });
assert.deepEqual(decorations(partial, partialState.doc.length), [[3, 3, 'french-typos-empty-line']]);
console.log('Partial viewport: only genuinely empty lines are marked.');

const tab = new moduleForCheck.exports.FrenchTyposSettingTab({}, plugin);
const definitions = tab.getSettingDefinitions();
const settings = Array.from(definitions).flatMap(definition => Array.from(definition.items || [definition]));
assert.equal(settings.filter(definition => definition.control).map(definition => definition.control.key).sort().join(','),
	'apostrophe,desactivatelinks,emdashes,emptytlines,endashes,hyphenate,quotationmarks,twoenters');
assert.equal(typeof settings.find(definition => definition.name === 'Highlight').render, 'function');
assert.equal(typeof settings.find(definition => definition.name === 'Highlight status bar button').render, 'function');
console.log('Settings search: existing settings are declared and highlight callbacks remain available.');
