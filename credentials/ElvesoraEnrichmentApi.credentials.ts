import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ElvesoraEnrichmentApi implements ICredentialType {
	name = 'elvesoraEnrichmentApi';

	displayName = 'Elvesora Enrichment API';

	icon: Icon = {
		light: 'file:../icons/elvesora-enrichment.svg',
		dark: 'file:../icons/elvesora-enrichment.dark.svg',
	};

	documentationUrl = 'https://github.com/Elvesora/n8n-nodes-elvesora-enrichment#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The team API token generated in Elvesora Enrichment',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://enrichment.elvesora.com/api/v1',
			url: '/enrichment/ping',
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
			disableFollowRedirect: true,
		},
	};
}
