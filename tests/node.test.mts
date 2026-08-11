import { inspect } from 'node:util';

import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INode,
	type INodeExecutionData,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { ElvesoraEnrichment } from '../nodes/ElvesoraEnrichment/ElvesoraEnrichment.node';

const WORKFLOW_NODE: INode = {
	id: 'elvesora-node-1',
	name: 'Elvesora Enrichment',
	type: 'n8n-nodes-elvesora-enrichment.elvesoraEnrichment',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

interface FullResponse {
	body: unknown;
	headers?: Record<string, unknown>;
	statusCode: number;
}

interface ParameterFailure {
	name: string;
	index: number;
	error: unknown;
}

interface ContextOptions {
	domains?: unknown[];
	simplify?: Array<boolean | undefined>;
	options?: Array<IDataObject | undefined>;
	continueOnFail?: boolean;
	parameterFailure?: ParameterFailure;
}

type HttpRequest = (credentialType: string, options: IHttpRequestOptions) => Promise<unknown>;

function response(
	body: unknown,
	statusCode = 200,
	headers?: Record<string, unknown>,
): FullResponse {
	return {
		body,
		statusCode,
		...(headers === undefined ? {} : { headers }),
	};
}

function createContext({
	domains = ['example.com'],
	simplify = [],
	options = [],
	continueOnFail = false,
	parameterFailure,
}: ContextOptions = {}) {
	const httpRequest = vi.fn<HttpRequest>();
	const inputData: INodeExecutionData[] = domains.map((_, index) => ({
		json: { inputIndex: index },
	}));
	const getNodeParameter = vi.fn(
		(name: string, itemIndex: number, defaultValue?: unknown): unknown => {
			if (
				parameterFailure !== undefined &&
				parameterFailure.name === name &&
				parameterFailure.index === itemIndex
			) {
				throw parameterFailure.error;
			}

			switch (name) {
				case 'domain':
					return domains[itemIndex];
				case 'simplify':
					return simplify[itemIndex] ?? defaultValue;
				case 'options':
					return options[itemIndex] ?? defaultValue;
				default:
					throw new Error(`Unexpected node parameter: ${name}`);
			}
		},
	);
	const context = {
		continueOnFail: () => continueOnFail,
		getInputData: () => inputData,
		getNode: () => WORKFLOW_NODE,
		getNodeParameter,
		helpers: {
			httpRequestWithAuthentication: httpRequest,
		},
	} as unknown as IExecuteFunctions;

	return { context, getNodeParameter, httpRequest };
}

async function execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	return await new ElvesoraEnrichment().execute.call(context);
}

async function captureExecutionError(context: IExecuteFunctions): Promise<unknown> {
	try {
		await execute(context);
	} catch (error) {
		return error;
	}

	throw new Error('Expected node execution to reject');
}

function expectNodeError(
	error: unknown,
	errorClass: typeof NodeApiError | typeof NodeOperationError,
	message: string,
): asserts error is NodeApiError | NodeOperationError {
	expect(error).toBeInstanceOf(errorClass);
	expect(error).toMatchObject({ message: expect.stringContaining(message) });
}

describe('ElvesoraEnrichment node description', () => {
	it('exposes the verified-node identity, credential, inputs, outputs, and UX properties', () => {
		const { description } = new ElvesoraEnrichment();

		expect(description).toMatchObject({
			displayName: 'Elvesora Enrichment',
			name: 'elvesoraEnrichment',
			group: ['transform'],
			version: 1,
			subtitle: 'Enrich company by domain',
			description: 'Enrich a company profile from its website domain using Elvesora',
			defaults: { name: 'Elvesora Enrichment' },
			usableAsTool: true,
			inputs: [NodeConnectionTypes.Main],
			outputs: [NodeConnectionTypes.Main],
			credentials: [{ name: 'elvesoraEnrichmentApi', required: true }],
		});
		expect(description.icon).toEqual({
			light: 'file:../../icons/elvesora-enrichment.svg',
			dark: 'file:../../icons/elvesora-enrichment.dark.svg',
		});
		expect(description.properties).toEqual([
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. example.com',
				description: 'The company website domain to enrich, without a protocol or path',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Idempotency Key',
						name: 'idempotencyKey',
						type: 'string',
						default: '',
						placeholder: 'e.g. crmContact1234',
						description:
							'A stable unique key for this logical request. Reuse it when retrying to prevent duplicate credit use.',
					},
				],
			},
		]);
	});
});

describe('ElvesoraEnrichment request construction and successful output', () => {
	it('returns an empty output for an empty input without making a request', async () => {
		const { context, httpRequest } = createContext({ domains: [] });

		await expect(execute(context)).resolves.toEqual([[]]);
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it('normalizes each domain, sends items sequentially, and preserves raw paired output', async () => {
		const { context, httpRequest } = createContext({
			domains: [' Example.COM ', 'Second.Example'],
			simplify: [false, false],
			options: [{ idempotencyKey: ' stable-key ' }, {}],
		});
		httpRequest
			.mockResolvedValueOnce(
				response(
					{
						success: true,
						result_type: 'ENRICHED',
						data: { domain: 'example.com' },
						credits: { remaining: 9 },
					},
					200,
					{ 'Idempotency-Status': ' REPLAYED ' },
				),
			)
			.mockResolvedValueOnce(
				response(
					JSON.stringify({
						success: true,
						result_type: 'ENRICHED',
						data: { domain: 'second.example' },
					}),
				),
			);

		await expect(execute(context)).resolves.toEqual([
			[
				{
					json: {
						success: true,
						result_type: 'ENRICHED',
						data: { domain: 'example.com' },
						credits: { remaining: 9 },
						idempotency_status: 'replayed',
					},
					pairedItem: { item: 0 },
				},
				{
					json: {
						success: true,
						result_type: 'ENRICHED',
						data: { domain: 'second.example' },
					},
					pairedItem: { item: 1 },
				},
			],
		]);
		expect(httpRequest).toHaveBeenCalledTimes(2);
		expect(httpRequest).toHaveBeenNthCalledWith(1, 'elvesoraEnrichmentApi', {
			method: 'POST',
			url: 'https://enrichment.elvesora.com/api/v1/enrichment/company',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'Idempotency-Key': 'stable-key',
			},
			body: { domain: 'example.com' },
			json: true,
			timeout: 130_000,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			disableFollowRedirect: true,
		});
		expect(httpRequest).toHaveBeenNthCalledWith(2, 'elvesoraEnrichmentApi', {
			method: 'POST',
			url: 'https://enrichment.elvesora.com/api/v1/enrichment/company',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: { domain: 'second.example' },
			json: true,
			timeout: 130_000,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			disableFollowRedirect: true,
		});
	});

	it('returns all supported simplified fields and prefers canonical data values', async () => {
		const { context, httpRequest } = createContext();
		httpRequest.mockResolvedValueOnce(
			response(
				{
					success: true,
					result_type: 'ENRICHED',
					message: 'Company enriched',
					domain: 'fallback.example',
					data: {
						company_name: 'Acme',
						legal_name: 'Ignored Legal Name',
						domain: 'acme.example',
						website_url: 'https://acme.example',
						industry: 'Software',
						employee_count: 0,
						hq_country: null,
					},
					credits: { remaining: 0 },
				},
				200,
				{ 'Idempotency-Status': 'replayed' },
			),
		);

		await expect(execute(context)).resolves.toEqual([
			[
				{
					json: {
						result_type: 'ENRICHED',
						message: 'Company enriched',
						idempotency_status: 'replayed',
						company_name: 'Acme',
						domain: 'acme.example',
						website_url: 'https://acme.example',
						industry: 'Software',
						employee_count: 0,
						hq_country: null,
						credits_remaining: 0,
					},
					pairedItem: { item: 0 },
				},
			],
		]);
	});

	it('uses legal-name and top-level domain fallbacks while omitting undefined simplified fields', async () => {
		const { context, httpRequest } = createContext({ domains: ['legal.example'] });
		httpRequest.mockResolvedValueOnce(
			response({
				success: true,
				result_type: 'ENRICHED',
				domain: 'legal.example',
				data: { legal_name: 'Legal Company Name' },
			}),
		);

		await expect(execute(context)).resolves.toEqual([
			[
				{
					json: {
						result_type: 'ENRICHED',
						company_name: 'Legal Company Name',
						domain: 'legal.example',
					},
					pairedItem: { item: 0 },
				},
			],
		]);
	});

	it('handles non-object data and credits in simplified responses', async () => {
		const { context, httpRequest } = createContext();
		httpRequest.mockResolvedValueOnce(response({ success: true, data: [], credits: null }));

		await expect(execute(context)).resolves.toEqual([[{ json: {}, pairedItem: { item: 0 } }]]);
	});

	it.each([
		['undefined headers', undefined, undefined],
		['an unrelated header', { Other: 'value' }, undefined],
		['a blank status', { 'Idempotency-Status': '   ' }, undefined],
		['a numeric status', { 'Idempotency-Status': 7 }, '7'],
		['an array status', { 'IDEMPOTENCY-STATUS': [' REPLAYED ', 'cached'] }, 'replayed , cached'],
		['an empty array status', { 'Idempotency-Status': [] }, undefined],
		['an unsupported status value', { 'Idempotency-Status': {} }, undefined],
	] as const)(
		'normalizes idempotency metadata from %s',
		async (_label, headers, expectedStatus) => {
			const { context, httpRequest } = createContext({ simplify: [false] });
			httpRequest.mockResolvedValueOnce(response({ success: true }, 200, headers));

			const result = await execute(context);
			const output = result[0]?.[0]?.json;

			if (expectedStatus === undefined) {
				expect(output).toEqual({ success: true });
			} else {
				expect(output).toEqual({ success: true, idempotency_status: expectedStatus });
			}
		},
	);
});

describe('ElvesoraEnrichment business and API responses', () => {
	it.each(['NOT_FOUND', 'FREE_EMAIL_PROVIDER', 'DISPOSABLE', 'INVALID_DOMAIN'])(
		'returns HTTP 400 %s as a normal, non-billable workflow output',
		async (resultType) => {
			const { context, httpRequest } = createContext({ simplify: [false] });
			const body = {
				success: false,
				result_type: resultType,
				message: 'No chargeable enrichment was produced.',
				credits: { consumed_by_request: 0, remaining: 10 },
			};
			httpRequest.mockResolvedValueOnce(response(body, 400));

			await expect(execute(context)).resolves.toEqual([[{ json: body, pairedItem: { item: 0 } }]]);
			expect(httpRequest).toHaveBeenCalledTimes(1);
		},
	);

	it.each([
		{
			statusCode: 401,
			body: { success: false, result_type: 'UNAUTHORIZED', message: 'Unauthorized' },
			message: 'Authentication failed',
			description: 'Check that the Elvesora Enrichment API token is active and try again.',
		},
		{
			statusCode: 401,
			body: {
				success: false,
				result_type: 'UPSTREAM_ERROR',
				message: 'The upstream provider rejected the request.',
			},
			message: 'Elvesora Enrichment request failed',
			description: 'The upstream provider rejected the request.',
		},
		{
			statusCode: 409,
			body: {
				success: false,
				result_type: 'IDEMPOTENCY_KEY_CONFLICT',
				message: 'Conflict',
			},
			message: 'Idempotency key conflict',
			description:
				'This idempotency key was already used with a different domain. Use one stable key per logical request.',
		},
		{
			statusCode: 422,
			body: { success: false, result_type: 'VALIDATION_ERROR', message: 'Domain is invalid.' },
			message: 'Invalid enrichment request',
			description: 'Domain is invalid.',
		},
		{
			statusCode: 429,
			body: {
				success: false,
				result_type: 'LIMIT_EXCEEDED',
				message: 'Limit exceeded.',
			},
			message: 'Elvesora Enrichment credit limit exceeded',
			description: 'The account has no enrichment credits remaining for the current period.',
		},
		{
			statusCode: 429,
			body: { success: false, result_type: 'RATE_LIMITED', message: 'Slow down.' },
			message: 'Elvesora Enrichment request was rate limited',
			description:
				'Slow down. Do not retry automatically unless the same idempotency key is reused.',
		},
		...([500, 502, 503, 504] as const).map((statusCode) => ({
			statusCode,
			body: {
				success: false,
				result_type: 'SERVICE_UNAVAILABLE',
				message: 'Temporarily unavailable.',
			},
			message: 'Elvesora Enrichment is temporarily unavailable',
			description: 'Temporarily unavailable. Retry later with the same idempotency key.',
		})),
		{
			statusCode: 418,
			body: { success: false },
			message: 'Elvesora Enrichment request failed',
			description: 'The Elvesora Enrichment API returned an error.',
		},
	])(
		'throws an actionable NodeApiError for HTTP $statusCode without retrying',
		async ({ statusCode, body, message, description }) => {
			const { context, httpRequest } = createContext({ simplify: [false] });
			httpRequest.mockResolvedValueOnce(response(body, statusCode));

			const error = await captureExecutionError(context);

			expectNodeError(error, NodeApiError, message);
			expect(error).toMatchObject({ description });
			expect(httpRequest).toHaveBeenCalledTimes(1);
		},
	);

	it('returns structured API errors per item when Continue On Fail is enabled', async () => {
		const { context, httpRequest } = createContext({
			domains: ['conflict.example', 'ok.example'],
			simplify: [false, false],
			continueOnFail: true,
		});
		httpRequest
			.mockResolvedValueOnce(
				response(
					{
						success: false,
						result_type: 'IDEMPOTENCY_KEY_CONFLICT',
						message: 'Conflict',
					},
					409,
					{ 'Idempotency-Status': 'conflict' },
				),
			)
			.mockResolvedValueOnce(response({ success: true, data: { domain: 'ok.example' } }));

		const result = await execute(context);

		expect(result[0]).toHaveLength(2);
		expect(result[0]?.[0]).toMatchObject({
			json: {
				success: false,
				result_type: 'IDEMPOTENCY_KEY_CONFLICT',
				message: 'Conflict',
				idempotency_status: 'conflict',
				error: expect.stringContaining('Idempotency key conflict'),
			},
			pairedItem: { item: 0 },
		});
		expect(result[0]?.[1]).toMatchObject({ pairedItem: { item: 1 } });
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('rejects malformed JSON returned with a successful HTTP status', async () => {
		const { context, httpRequest } = createContext();
		httpRequest.mockResolvedValueOnce(response('<html>not json</html>'));

		const error = await captureExecutionError(context);

		expectNodeError(error, NodeApiError, 'Invalid response from Elvesora Enrichment');
		expect(error).toMatchObject({
			description:
				'The API response was not valid JSON. Retry later with the same idempotency key.',
		});
	});

	it.each([null, [], 'null', '[]'])('rejects a non-object response body %#', async (body) => {
		const { context, httpRequest } = createContext();
		httpRequest.mockResolvedValueOnce(response(body));

		const error = await captureExecutionError(context);

		expectNodeError(error, NodeApiError, 'Invalid response from Elvesora Enrichment');
		expect(error).toMatchObject({ description: 'The API response must be a JSON object.' });
	});

	it('turns malformed responses into item errors under Continue On Fail', async () => {
		const { context, httpRequest } = createContext({
			domains: ['bad.example'],
			continueOnFail: true,
		});
		httpRequest.mockResolvedValueOnce(response('not-json'));

		await expect(execute(context)).resolves.toEqual([
			[
				{
					json: {
						error: expect.stringContaining('Invalid response from Elvesora Enrichment'),
						domain: 'bad.example',
					},
					pairedItem: { item: 0 },
				},
			],
		]);
	});
});

describe('ElvesoraEnrichment input and idempotency validation', () => {
	it.each([null, undefined, '', '   '])(
		'rejects an empty domain value %# before HTTP',
		async (domain) => {
			const { context, httpRequest } = createContext({ domains: [domain] });

			const error = await captureExecutionError(context);

			expectNodeError(error, NodeOperationError, 'Domain is required');
			expect(httpRequest).not.toHaveBeenCalled();
		},
	);

	it('accepts the 255-character domain boundary and rejects 256 characters', async () => {
		const acceptedDomain = 'a'.repeat(255);
		const accepted = createContext({ domains: [acceptedDomain], simplify: [false] });
		accepted.httpRequest.mockResolvedValueOnce(response({ success: true }));

		await execute(accepted.context);
		expect(accepted.httpRequest).toHaveBeenCalledWith(
			'elvesoraEnrichmentApi',
			expect.objectContaining({ body: { domain: acceptedDomain } }),
		);

		const rejected = createContext({ domains: ['a'.repeat(256)] });
		const error = await captureExecutionError(rejected.context);
		expectNodeError(error, NodeOperationError, 'Domain is too long');
		expect(rejected.httpRequest).not.toHaveBeenCalled();
	});

	it.each([undefined, null, '', '   '])('omits an empty idempotency key %#', async (key) => {
		const { context, httpRequest } = createContext({
			simplify: [false],
			options: [{ idempotencyKey: key } as IDataObject],
		});
		httpRequest.mockResolvedValueOnce(response({ success: true }));

		await execute(context);

		const requestOptions = httpRequest.mock.calls[0]?.[1];
		expect(requestOptions?.headers).not.toHaveProperty('Idempotency-Key');
	});

	it('accepts a 255-character key and rejects 256 characters', async () => {
		const acceptedKey = 'k'.repeat(255);
		const accepted = createContext({
			simplify: [false],
			options: [{ idempotencyKey: acceptedKey }],
		});
		accepted.httpRequest.mockResolvedValueOnce(response({ success: true }));
		await execute(accepted.context);
		expect(accepted.httpRequest.mock.calls[0]?.[1].headers).toHaveProperty(
			'Idempotency-Key',
			acceptedKey,
		);

		const rejected = createContext({
			options: [{ idempotencyKey: 'k'.repeat(256) }],
		});
		const error = await captureExecutionError(rejected.context);
		expectNodeError(error, NodeOperationError, 'Idempotency key is too long');
		expect(rejected.httpRequest).not.toHaveBeenCalled();
	});

	it.each([
		'line\rbreak',
		'line\nbreak',
		`nul${String.fromCharCode(0)}byte`,
		`del${String.fromCharCode(127)}byte`,
	])('rejects control characters in an idempotency key %#', async (idempotencyKey) => {
		const { context, httpRequest } = createContext({ options: [{ idempotencyKey }] });

		const error = await captureExecutionError(context);

		expectNodeError(error, NodeOperationError, 'Idempotency key contains invalid characters');
		expect(httpRequest).not.toHaveBeenCalled();
	});

	it('allows a key to repeat for the same normalized domain', async () => {
		const { context, httpRequest } = createContext({
			domains: ['EXAMPLE.com', ' example.COM '],
			simplify: [false, false],
			options: [{ idempotencyKey: 'same-key' }, { idempotencyKey: 'same-key' }],
		});
		httpRequest
			.mockResolvedValueOnce(response({ success: true }))
			.mockResolvedValueOnce(response({ success: true }));

		await execute(context);

		expect(httpRequest).toHaveBeenCalledTimes(2);
	});

	it('rejects one key used for different domains before sending the conflicting item', async () => {
		const { context, httpRequest } = createContext({
			domains: ['first.example', 'second.example'],
			simplify: [false, false],
			options: [{ idempotencyKey: 'shared-key' }, { idempotencyKey: 'shared-key' }],
		});
		httpRequest.mockResolvedValueOnce(response({ success: true }));

		const error = await captureExecutionError(context);

		expectNodeError(error, NodeOperationError, 'Idempotency key is reused for a different domain');
		expect(httpRequest).toHaveBeenCalledTimes(1);
	});

	it('reports a conflicting key per item and continues when Continue On Fail is enabled', async () => {
		const { context, httpRequest } = createContext({
			domains: ['first.example', 'second.example', 'third.example'],
			simplify: [false, false, false],
			options: [
				{ idempotencyKey: 'shared-key' },
				{ idempotencyKey: 'shared-key' },
				{ idempotencyKey: 'third-key' },
			],
			continueOnFail: true,
		});
		httpRequest
			.mockResolvedValueOnce(response({ success: true }))
			.mockResolvedValueOnce(response({ success: true }));

		const result = await execute(context);

		expect(result[0]).toHaveLength(3);
		expect(result[0]?.[1]).toEqual({
			json: {
				error: expect.stringContaining('Idempotency key is reused for a different domain'),
				domain: 'second.example',
			},
			pairedItem: { item: 1 },
		});
		expect(result[0]?.[2]).toMatchObject({ pairedItem: { item: 2 } });
		expect(httpRequest).toHaveBeenCalledTimes(2);
	});
});

describe('ElvesoraEnrichment transport failures and token redaction', () => {
	it('redacts bearer tokens from transport messages and does not retain nested authorization data', async () => {
		const secret = 'super-secret-test-token';
		const { context, httpRequest } = createContext();
		httpRequest.mockRejectedValueOnce({
			message: `Socket closed for Bearer ${secret}`,
			config: {
				headers: { Authorization: `Bearer ${secret}` },
			},
		});

		const error = await captureExecutionError(context);
		const completeErrorSurface = inspect(error, { depth: 10, showHidden: true });

		expectNodeError(error, NodeApiError, 'Could not connect to Elvesora Enrichment');
		expect(completeErrorSurface).not.toContain(secret);
		expect(completeErrorSurface).toContain('[REDACTED]');
		expect(httpRequest).toHaveBeenCalledTimes(1);
	});

	it('redacts tokens in Error instances without retrying', async () => {
		const secret = 'another-sensitive-token';
		const { context, httpRequest } = createContext();
		httpRequest.mockRejectedValueOnce(
			new Error(`Bearer ${secret} failed; bearer ${secret} failed again`),
		);

		const error = await captureExecutionError(context);

		expect(inspect(error, { depth: 10, showHidden: true })).not.toContain(secret);
		expect(httpRequest).toHaveBeenCalledTimes(1);
	});

	it.each([42, null, { message: '' }])(
		'uses a safe generic message for thrown value %#',
		async (thrown) => {
			const { context, httpRequest } = createContext();
			httpRequest.mockRejectedValueOnce(thrown);

			const error = await captureExecutionError(context);

			expectNodeError(error, NodeApiError, 'Could not connect to Elvesora Enrichment');
			expect(inspect(error, { depth: 10, showHidden: true })).toContain(
				'The Elvesora Enrichment request failed.',
			);
		},
	);

	it('sanitizes and wraps an already normalized NodeApiError', async () => {
		const secret = 'nested-node-api-error-token';
		const original = new NodeApiError(WORKFLOW_NODE, {
			message: `Already normalized for Bearer ${secret}`,
		});
		const { context, httpRequest } = createContext();
		httpRequest.mockRejectedValueOnce(original);

		const error = await captureExecutionError(context);

		expect(error).not.toBe(original);
		expectNodeError(error, NodeApiError, 'Could not connect to Elvesora Enrichment');
		expect(inspect(error, { depth: 10, showHidden: true })).not.toContain(secret);
	});

	it('sanitizes arbitrary per-item errors under Continue On Fail', async () => {
		const secret = 'parameter-secret';
		const { context } = createContext({
			continueOnFail: true,
			parameterFailure: {
				name: 'domain',
				index: 0,
				error: { message: `Parameter contained Bearer ${secret}` },
			},
		});

		const result = await execute(context);
		const serialized = JSON.stringify(result);

		expect(serialized).not.toContain(secret);
		expect(serialized).toContain('Bearer [REDACTED]');
		expect(result).toEqual([
			[
				{
					json: { error: 'Parameter contained Bearer [REDACTED]', domain: '' },
					pairedItem: { item: 0 },
				},
			],
		]);
	});

	it.each([new Error('   '), { message: 123 }, false])(
		'uses a generic Continue On Fail message for an unhelpful error %#',
		async (error) => {
			const { context } = createContext({
				continueOnFail: true,
				parameterFailure: { name: 'domain', index: 0, error },
			});

			await expect(execute(context)).resolves.toEqual([
				[
					{
						json: { error: 'The Elvesora Enrichment request failed.', domain: '' },
						pairedItem: { item: 0 },
					},
				],
			]);
		},
	);

	it('wraps an unexpected execution exception in NodeOperationError with its item index', async () => {
		const { context } = createContext({
			parameterFailure: {
				name: 'simplify',
				index: 0,
				error: new Error('Unexpected parameter resolver exception'),
			},
		});

		const error = await captureExecutionError(context);

		expectNodeError(error, NodeOperationError, 'Unexpected parameter resolver exception');
	});
});
