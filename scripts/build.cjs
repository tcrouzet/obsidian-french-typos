const esbuild = require('esbuild');
const { builtinModules } = require('node:module');

const prod = process.argv[2] === 'production';

async function build() {
	const context = await esbuild.context({
		entryPoints: ['plugin/main.ts'],
		bundle: true,
		external: [
			'obsidian',
			'electron',
			'@codemirror/autocomplete',
			'@codemirror/collab',
			'@codemirror/commands',
			'@codemirror/language',
			'@codemirror/lint',
			'@codemirror/search',
			'@codemirror/state',
			'@codemirror/view',
			'@lezer/common',
			'@lezer/highlight',
			'@lezer/lr',
			...builtinModules
		],
		format: 'cjs',
		target: 'es2018',
		logLevel: 'info',
		sourcemap: prod ? false : 'inline',
		treeShaking: true,
		outfile: 'main.js'
	});

	if (prod) {
		await context.rebuild();
		await context.dispose();
	} else {
		await context.watch();
	}
}

build().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
