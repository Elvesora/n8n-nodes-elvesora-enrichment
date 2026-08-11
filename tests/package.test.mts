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

const packageRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
	readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
) as PackageManifest;

describe('package metadata', () => {
	it('contains the identity and public npm metadata required by n8n', () => {
		expect(manifest).toMatchObject({
			name: 'n8n-nodes-elvesora-enrichment',
			version: '0.1.0',
			license: 'MIT',
			homepage: 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment#readme',
			author: {
				name: 'Elvesora',
				email: 'support@elvesora.com',
				url: 'https://elvesora.com',
			},
			repository: {
				type: 'git',
				url: 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment.git',
			},
			bugs: {
				url: 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment/issues',
			},
			engines: {
				node: '>=22.22.0',
			},
			publishConfig: {
				access: 'public',
			},
		});
		expect(manifest.description.trim()).not.toBe('');
		expect(manifest.keywords).toContain('n8n-community-node-package');
		expect(manifest.keywords).toContain('n8n');
	});

	it('ships only the compiled distribution and has no runtime dependencies', () => {
		expect(manifest.files).toEqual(['dist']);
		expect(manifest.dependencies).toBeUndefined();
		expect(manifest.peerDependencies).toEqual({ 'n8n-workflow': '*' });
		expect(manifest.devDependencies['@n8n/node-cli']).toBe('0.43.2');
		expect(manifest.devDependencies['@vitest/coverage-v8']).toBe('4.1.10');
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
	});
});
