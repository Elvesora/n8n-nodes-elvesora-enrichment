import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

assert(manifest.name === 'n8n-nodes-elvesora-enrichment', 'Unexpected package name.');
assert(manifest.license === 'MIT', 'Package license must be MIT.');
assert(manifest.dependencies === undefined, 'Runtime dependencies are not allowed.');
assert(
	JSON.stringify(manifest.files) === JSON.stringify(['dist']),
	'Only dist may be listed in files.',
);

const registeredFiles = [...manifest.n8n.credentials, ...manifest.n8n.nodes];
const requiredFiles = [
	...registeredFiles,
	'dist/nodes/ElvesoraEnrichment/ElvesoraEnrichment.node.json',
	'dist/icons/elvesora-enrichment.svg',
	'dist/icons/elvesora-enrichment.dark.svg',
];

for (const file of requiredFiles) {
	assert(existsSync(resolve(packageRoot, file)), `Required build artifact is missing: ${file}`);
}

const require = createRequire(import.meta.url);
const nodeModule = require(resolve(packageRoot, manifest.n8n.nodes[0]));
const credentialModule = require(resolve(packageRoot, manifest.n8n.credentials[0]));
assert(
	typeof nodeModule.ElvesoraEnrichment === 'function',
	'Compiled node class cannot be loaded.',
);
assert(
	typeof credentialModule.ElvesoraEnrichmentApi === 'function',
	'Compiled credential class cannot be loaded.',
);

const npmCli = process.env.npm_execpath;
assert(npmCli !== undefined && existsSync(npmCli), 'npm CLI path is unavailable.');
const packResult = spawnSync(
	process.execPath,
	[npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
	{
		cwd: packageRoot,
		encoding: 'utf8',
		windowsHide: true,
	},
);

assert(
	packResult.status === 0,
	`npm pack --dry-run failed:\n${packResult.stderr ?? packResult.error?.message ?? 'Unknown error'}`,
);
const packData = JSON.parse(packResult.stdout);
assert(Array.isArray(packData) && packData.length === 1, 'npm pack returned unexpected metadata.');

const packedFiles = packData[0].files.map(({ path }) => path.replaceAll('\\', '/'));
const allowedRootFiles = new Set(['LICENSE.md', 'README.md', 'package.json']);

for (const file of packedFiles) {
	assert(
		file.startsWith('dist/') || allowedRootFiles.has(file),
		`Unexpected file would be published: ${file}`,
	);
	assert(!/(^|\/)\.env(?:\.|$)/u.test(file), `Environment file would be published: ${file}`);
	assert(
		!/(^|\/)(?:coverage|node_modules|tests?)(?:\/|$)/u.test(file),
		`Private build file would be published: ${file}`,
	);
	assert(!file.endsWith('.tsbuildinfo'), `Compiler cache would be published: ${file}`);
}

for (const file of [...requiredFiles, ...allowedRootFiles]) {
	assert(packedFiles.includes(file), `Required package file is missing: ${file}`);
}

console.log(`Validated ${packedFiles.length} files for ${manifest.name}@${manifest.version}.`);
