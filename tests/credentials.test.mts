import { describe, expect, it } from 'vitest';

import { ElvesoraEnrichmentApi } from '../credentials/ElvesoraEnrichmentApi.credentials';

describe('ElvesoraEnrichmentApi credentials', () => {
	it('defines a fixed, masked bearer-token credential', () => {
		const credential = new ElvesoraEnrichmentApi();

		expect(credential.name).toBe('elvesoraEnrichmentApi');
		expect(credential.displayName).toBe('Elvesora Enrichment API');
		expect(credential.documentationUrl).toBe(
			'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment#credentials',
		);
		expect(credential.icon).toEqual({
			light: 'file:../icons/elvesora-enrichment.svg',
			dark: 'file:../icons/elvesora-enrichment.dark.svg',
		});
		expect(credential.properties).toEqual([
			{
				displayName: 'API Token',
				name: 'apiToken',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description: 'The team API token generated in Elvesora Enrichment',
			},
		]);
	});

	it('injects authentication only through n8n credential expressions', () => {
		const credential = new ElvesoraEnrichmentApi();

		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: {
				headers: {
					Authorization: '=Bearer {{$credentials.apiToken}}',
				},
			},
		});
	});

	it('tests credentials against the current non-billable production ping without redirects', () => {
		const credential = new ElvesoraEnrichmentApi();

		expect(credential.test).toEqual({
			request: {
				baseURL: 'https://enrichment.elvesora.com/api/v1',
				url: '/enrichment/ping',
				method: 'GET',
				headers: {
					Accept: 'application/json',
				},
				disableFollowRedirect: true,
			},
		});
	});
});
