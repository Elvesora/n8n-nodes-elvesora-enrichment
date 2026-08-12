import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface PackageManifest {
	name: string;
	version: string;
	description: string;
	license: string;
	homepage: string;
	keywords: string[];
	author: {
		name: string;
		email?: string;
		url: string;
	};
	repository: {
		type: string;
		url: string;
	};
	bugs: {
		url: string;
	};
	engines: {
		node: string;
	};
	scripts: Record<string, string>;
	files: string[];
	publishConfig: {
		access: string;
	};
	n8n: {
		n8nNodesApiVersion: number;
		strict: boolean;
		credentials: string[];
		nodes: string[];
	};
	dependencies?: Record<string, string>;
	devDependencies: Record<string, string>;
	peerDependencies: Record<string, string>;
}

interface PackageLock {
	name: string;
	version: string;
	packages: Record<string, { name?: string; version?: string }>;
}

const packageRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
	readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
) as PackageManifest;
const packageLock = JSON.parse(
	readFileSync(resolve(packageRoot, 'package-lock.json'), 'utf8'),
) as PackageLock;

describe('package metadata', () => {
	it('contains the identity and public npm metadata required by n8n', () => {
		expect(manifest).toMatchObject({
			name: 'n8n-nodes-elvesora-enrichment',
			license: 'MIT',
			homepage: 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment#readme',
			author: {
				name: 'Elvesora',
				email: 'support@elvesora.com',
				url: 'https://elvesora.com',
			},
			repository: {
				type: 'git',
				url: 'git+https://github.com/Elvesora/n8n-nodes-elvesora-enrichment.git',
			},
			bugs: {
				url: 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment/issues',
			},
			engines: {
				node: '^22.22.0 || ^24.0.0',
			},
			publishConfig: {
				access: 'public',
			},
		});
		expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/u);
		expect(packageLock.name).toBe(manifest.name);
		expect(packageLock.version).toBe(manifest.version);
		expect(packageLock.packages['']).toMatchObject({
			name: manifest.name,
			version: manifest.version,
		});
		expect(manifest.description.trim()).not.toBe('');
		expect(manifest.description).toBe(
			'n8n community node for enriching company profiles and firmographic data from website domains with the Elvesora Enrichment API.',
		);
		expect(manifest.keywords).toContain('n8n-community-node-package');
		expect(manifest.keywords).toContain('n8n');
	});

	it('ships only the compiled distribution and has no runtime dependencies', () => {
		expect(manifest.files).toEqual(['dist']);
		expect(manifest.dependencies).toBeUndefined();
		expect(manifest.peerDependencies).toEqual({ 'n8n-workflow': '*' });
		expect(manifest.devDependencies['@n8n/node-cli']).toBe('0.43.3');
		expect(manifest.devDependencies['@vitest/coverage-v8']).toBe('4.1.10');
		expect(manifest.devDependencies.prettier).toBe('3.9.6');
		expect(manifest.devDependencies['release-it']).toBe('21.0.2');
	});

	it('forces LF line endings for reproducible cross-platform checkouts', () => {
		expect(readFileSync(resolve(packageRoot, '.gitattributes'), 'utf8')).toBe(
			'* text=auto eol=lf\n',
		);
	});

	it('registers the compiled credential and node entry points', () => {
		expect(manifest.n8n).toEqual({
			n8nNodesApiVersion: 1,
			strict: true,
			credentials: ['dist/credentials/ElvesoraEnrichmentApi.credentials.js'],
			nodes: ['dist/nodes/ElvesoraEnrichment/ElvesoraEnrichment.node.js'],
		});

		for (const compiledPath of [...manifest.n8n.credentials, ...manifest.n8n.nodes]) {
			const sourcePath = compiledPath.replace(/^dist\//u, '').replace(/\.js$/u, '.ts');
			expect(existsSync(resolve(packageRoot, sourcePath)), sourcePath).toBe(true);
		}
	});

	it('defines reproducible quality and release lifecycle commands', () => {
		expect(manifest.scripts).toMatchObject({
			build: 'n8n-node build',
			dev: 'n8n-node dev',
			'format:check': 'prettier --check .',
			lint: 'n8n-node lint',
			test: 'vitest run',
			'test:coverage': 'vitest run --coverage',
			typecheck: 'tsc --noEmit',
			'package:check': 'node scripts/validate-package.mjs',
			verify:
				'npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run package:check',
			release: 'n8n-node release',
			prepublishOnly: 'npm run verify && n8n-node prerelease',
		});
	});

	it('publishes on a supported Node.js line with current GitHub Actions', () => {
		const publishWorkflow = readFileSync(
			resolve(packageRoot, '.github/workflows/publish.yml'),
			'utf8',
		);
		const ciWorkflow = readFileSync(resolve(packageRoot, '.github/workflows/ci.yml'), 'utf8');

		expect(publishWorkflow).toContain(
			'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
		);
		expect(publishWorkflow).toContain(
			'uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
		);
		expect(publishWorkflow).toContain('persist-credentials: false');
		expect(publishWorkflow).toContain('registry-url: https://registry.npmjs.org');
		expect(publishWorkflow).toContain('package-manager-cache: false');
		expect(publishWorkflow).not.toContain('cache: npm');
		expect(publishWorkflow).toContain('node-version: 24.x');
		expect(publishWorkflow).not.toContain('node-version: lts/*');
		expect(publishWorkflow).toContain('id-token: write');
		expect(publishWorkflow).toContain('Require npm Trusted Publishing support');
		expect(publishWorkflow).toContain('npm 11.5.1 or newer is required');
		expect(publishWorkflow).toContain('Publish release with npm Trusted Publishing');
		expect(publishWorkflow).not.toContain('NPM_TOKEN');
		expect(publishWorkflow).not.toContain('NODE_AUTH_TOKEN');
		expect(publishWorkflow).not.toContain('_authToken');
		expect(publishWorkflow).toContain('for attempt in {1..5}');
		expect(publishWorkflow).toContain('has passed all security checks');
		expect(ciWorkflow).toContain(
			'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
		);
		expect(ciWorkflow).toContain(
			'uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
		);
		expect(ciWorkflow).toContain('persist-credentials: false');
		expect(ciWorkflow).toContain('npm pack --dry-run --ignore-scripts');
		expect(ciWorkflow).not.toContain('npm publish --dry-run');
	});

	it('keeps node metadata and icons present in source', () => {
		const nodeMetadata = JSON.parse(
			readFileSync(
				resolve(packageRoot, 'nodes/ElvesoraEnrichment/ElvesoraEnrichment.node.json'),
				'utf8',
			),
		) as {
			node: string;
			categories: string[];
			resources: Record<string, Array<{ url: string }>>;
		};

		expect(nodeMetadata.node).toBe(manifest.name);
		expect(nodeMetadata.categories).toEqual(['Sales', 'Analytics']);
		expect(nodeMetadata.resources.primaryDocumentation?.[0]?.url).toBe(manifest.homepage);
		expect(existsSync(resolve(packageRoot, 'icons/elvesora-enrichment.svg'))).toBe(true);
		expect(existsSync(resolve(packageRoot, 'icons/elvesora-enrichment.dark.svg'))).toBe(true);

		for (const icon of ['elvesora-enrichment.svg', 'elvesora-enrichment.dark.svg']) {
			const iconSource = readFileSync(resolve(packageRoot, 'icons', icon), 'utf8');
			expect(iconSource).toContain('viewBox="0 0 637 637"');
			expect(iconSource).toContain('x="21.5"');
		}
	});

	it('keeps the importable example on the current node version without credentials', () => {
		const workflow = JSON.parse(
			readFileSync(
				resolve(packageRoot, 'examples/Elvesora-company-enrichment.workflow.json'),
				'utf8',
			),
		) as {
			nodes: Array<{
				type: string;
				typeVersion: number;
				parameters: Record<string, unknown>;
				credentials?: Record<string, unknown>;
			}>;
		};
		const exampleNode = workflow.nodes.find(
			(node) => node.type === `${manifest.name}.elvesoraEnrichment`,
		);

		expect(exampleNode).toMatchObject({
			typeVersion: 2,
			parameters: {
				domain: 'example.com',
				simplify: true,
				options: {
					idempotencyKey: 'n8n-example-example-com-v1',
				},
			},
		});
		expect(exampleNode?.credentials).toBeUndefined();
	});

	it('documents the n8n AI parameter expression without serializing a secret', () => {
		const readme = readFileSync(resolve(packageRoot, 'README.md'), 'utf8');

		expect(readme).toContain(
			"{{ $fromAI('domain', 'Company website domain without protocol or path', 'string') }}",
		);
		expect(readme).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{20,}/u);
	});
});
