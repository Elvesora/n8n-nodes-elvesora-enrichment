import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INode,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';

const API_BASE_URL = 'https://enrichment.elvesora.com/api/v1';
const ENRICHMENT_PATH = '/enrichment/company';
const CREDENTIAL_TYPE = 'elvesoraEnrichmentApi';
const REQUEST_TIMEOUT_MS = 130_000;
const MAX_INPUT_LENGTH = 255;
const BEARER_TOKEN_PATTERN = /Bearer\s+[^\s"',}]+/giu;

interface FullHttpResponse {
	body: unknown;
	headers?: Record<string, unknown>;
	statusCode: number;
	statusMessage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsControlCharacter(value: string): boolean {
	for (let index = 0; index < value.length; index++) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit <= 31 || codeUnit === 127) {
			return true;
		}
	}

	return false;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim() !== '') {
		return error.message.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]');
	}

	if (isRecord(error) && typeof error.message === 'string' && error.message.trim() !== '') {
		return error.message.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]');
	}

	return 'The Elvesora Enrichment request failed.';
}

function normalizeResponseBody(body: unknown, node: INode, itemIndex: number): IDataObject {
	let normalizedBody = body;

	if (typeof normalizedBody === 'string') {
		try {
			normalizedBody = JSON.parse(normalizedBody) as unknown;
		} catch {
			throw new NodeApiError(
				node,
				{
					message: 'The Elvesora Enrichment API returned malformed JSON.',
					httpCode: '502',
				},
				{
					message: 'Invalid response from Elvesora Enrichment',
					description:
						'The API response was not valid JSON. Retry later with the same idempotency key.',
					itemIndex,
				},
			);
		}
	}

	if (!isRecord(normalizedBody)) {
		throw new NodeApiError(
			node,
			{
				message: 'The Elvesora Enrichment API returned an unexpected response body.',
				httpCode: '502',
			},
			{
				message: 'Invalid response from Elvesora Enrichment',
				description: 'The API response must be a JSON object.',
				itemIndex,
			},
		);
	}

	return normalizedBody as IDataObject;
}

function responseHeader(
	headers: Record<string, unknown> | undefined,
	name: string,
): string | undefined {
	if (headers === undefined) {
		return undefined;
	}

	const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
	if (entry === undefined) {
		return undefined;
	}

	const value = entry[1];
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	if (Array.isArray(value) && value.length > 0) {
		return value.map(String).join(', ');
	}

	return undefined;
}

function withIdempotencyStatus(
	body: IDataObject,
	headers: Record<string, unknown> | undefined,
): IDataObject {
	const status = responseHeader(headers, 'Idempotency-Status');

	if (status === undefined || status.trim() === '') {
		return body;
	}

	return {
		...body,
		idempotency_status: status.trim().toLowerCase(),
	};
}

function apiErrorForResponse(
	node: INode,
	response: FullHttpResponse,
	body: IDataObject,
	itemIndex: number,
): NodeApiError {
	const resultType = typeof body.result_type === 'string' ? body.result_type : undefined;
	const apiMessage =
		typeof body.message === 'string' && body.message.trim() !== ''
			? body.message
			: 'The Elvesora Enrichment API returned an error.';

	let message = 'Elvesora Enrichment request failed';
	let description = apiMessage;

	if (response.statusCode === 401 && resultType !== 'UPSTREAM_ERROR') {
		message = 'Authentication failed';
		description = 'Check that the Elvesora Enrichment API token is active and try again.';
	} else if (response.statusCode === 409) {
		message = 'Idempotency key conflict';
		description =
			'This idempotency key was already used with a different domain. Use one stable key per logical request.';
	} else if (response.statusCode === 422) {
		message = 'Invalid enrichment request';
	} else if (response.statusCode === 429 && resultType === 'LIMIT_EXCEEDED') {
		message = 'Elvesora Enrichment credit limit exceeded';
		description = 'The account has no enrichment credits remaining for the current period.';
	} else if (response.statusCode === 429) {
		message = 'Elvesora Enrichment request was rate limited';
		description = `${apiMessage} Do not retry automatically unless the same idempotency key is reused.`;
	} else if (response.statusCode >= 500) {
		message = 'Elvesora Enrichment is temporarily unavailable';
		description = `${apiMessage} Retry later with the same idempotency key.`;
	}

	return new NodeApiError(
		node,
		{
			...(body as JsonObject),
			httpCode: String(response.statusCode),
		},
		{
			message,
			description,
			itemIndex,
		},
	);
}

function apiErrorForThrownValue(node: INode, error: unknown, itemIndex: number): NodeApiError {
	return new NodeApiError(
		node,
		{ message: errorMessage(error) },
		{
			message: 'Could not connect to Elvesora Enrichment',
			description:
				'The request did not complete. Retry only with the same idempotency key to avoid duplicate credit use.',
			itemIndex,
		},
	);
}

function valueFromRecord(record: Record<string, unknown>, key: string): unknown {
	const value = record[key];

	return value === undefined ? undefined : value;
}

function simplifiedOutput(body: IDataObject): IDataObject {
	const data = isRecord(body.data) ? body.data : {};
	const credits = isRecord(body.credits) ? body.credits : {};
	const simplified: IDataObject = {};
	const fields: Array<[string, unknown]> = [
		['result_type', valueFromRecord(body, 'result_type')],
		['message', valueFromRecord(body, 'message')],
		['idempotency_status', valueFromRecord(body, 'idempotency_status')],
		['company_name', valueFromRecord(data, 'company_name') ?? valueFromRecord(data, 'legal_name')],
		['domain', valueFromRecord(data, 'domain') ?? valueFromRecord(body, 'domain')],
		['website_url', valueFromRecord(data, 'website_url')],
		['industry', valueFromRecord(data, 'industry')],
		['employee_count', valueFromRecord(data, 'employee_count')],
		['hq_country', valueFromRecord(data, 'hq_country')],
		['credits_remaining', valueFromRecord(credits, 'remaining')],
	];

	for (const [key, value] of fields) {
		if (value !== undefined) {
			simplified[key] = value as IDataObject[string];
		}
	}

	return simplified;
}

function formattedOutput(body: IDataObject, simplify: boolean): IDataObject {
	return simplify ? simplifiedOutput(body) : body;
}

function validatedDomain(value: unknown, node: INode, itemIndex: number): string {
	const domain = String(value ?? '')
		.trim()
		.toLowerCase();

	if (domain === '') {
		throw new NodeOperationError(node, 'Domain is required', {
			description: 'Enter a company website domain such as example.com.',
			itemIndex,
		});
	}

	if (domain.length > MAX_INPUT_LENGTH) {
		throw new NodeOperationError(node, 'Domain is too long', {
			description: `The domain cannot exceed ${MAX_INPUT_LENGTH} characters.`,
			itemIndex,
		});
	}

	return domain;
}

function validatedIdempotencyKey(
	value: unknown,
	node: INode,
	itemIndex: number,
): string | undefined {
	const key = String(value ?? '').trim();

	if (key === '') {
		return undefined;
	}

	if (key.length > MAX_INPUT_LENGTH) {
		throw new NodeOperationError(node, 'Idempotency key is too long', {
			description: `The idempotency key cannot exceed ${MAX_INPUT_LENGTH} characters.`,
			itemIndex,
		});
	}

	if (containsControlCharacter(key)) {
		throw new NodeOperationError(node, 'Idempotency key contains invalid characters', {
			description: 'The idempotency key cannot contain control characters.',
			itemIndex,
		});
	}

	return key;
}

function continueOnFailOutput(error: unknown, domain: string): IDataObject {
	return {
		error: errorMessage(error),
		domain,
	};
}

export class ElvesoraEnrichment implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Elvesora Enrichment',
		name: 'elvesoraEnrichment',
		icon: {
			light: 'file:../../icons/elvesora-enrichment.svg',
			dark: 'file:../../icons/elvesora-enrichment.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: 'Enrich Company by Domain',
		description: 'Enrich a company profile from its website domain using Elvesora',
		defaults: {
			name: 'Elvesora Enrichment',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: CREDENTIAL_TYPE,
				required: true,
			},
		],
		properties: [
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
				displayName: 'Simplify Response',
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const domainsByIdempotencyKey = new Map<string, string>();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let domain = '';

			try {
				domain = validatedDomain(
					this.getNodeParameter('domain', itemIndex),
					this.getNode(),
					itemIndex,
				);
				const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
				const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
				const idempotencyKey = validatedIdempotencyKey(
					options.idempotencyKey,
					this.getNode(),
					itemIndex,
				);

				if (idempotencyKey !== undefined) {
					const previousDomain = domainsByIdempotencyKey.get(idempotencyKey);
					if (previousDomain !== undefined && previousDomain !== domain) {
						throw new NodeOperationError(
							this.getNode(),
							'Idempotency key is reused for a different domain',
							{
								description:
									'Use a distinct idempotency key for each logical domain request in this execution.',
								itemIndex,
							},
						);
					}

					domainsByIdempotencyKey.set(idempotencyKey, domain);
				}

				const headers: Record<string, string> = {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				};

				if (idempotencyKey !== undefined) {
					headers['Idempotency-Key'] = idempotencyKey;
				}

				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: `${API_BASE_URL}${ENRICHMENT_PATH}`,
					headers,
					body: { domain },
					json: true,
					timeout: REQUEST_TIMEOUT_MS,
					returnFullResponse: true,
					ignoreHttpStatusErrors: true,
					disableFollowRedirect: true,
				};

				let response: FullHttpResponse;
				try {
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						CREDENTIAL_TYPE,
						requestOptions,
					)) as FullHttpResponse;
				} catch (error) {
					throw apiErrorForThrownValue(this.getNode(), error, itemIndex);
				}

				const responseBody = normalizeResponseBody(response.body, this.getNode(), itemIndex);

				if (response.statusCode === 200 || response.statusCode === 400) {
					returnData.push({
						json: formattedOutput(withIdempotencyStatus(responseBody, response.headers), simplify),
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const apiError = apiErrorForResponse(this.getNode(), response, responseBody, itemIndex);
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							...withIdempotencyStatus(responseBody, response.headers),
							error: apiError.message,
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw apiError;
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: continueOnFailOutput(error, domain),
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				if (error instanceof NodeApiError) {
					const nodeApiError = error;
					throw nodeApiError;
				}

				if (error instanceof NodeOperationError) {
					const nodeOperationError = error;
					throw nodeOperationError;
				}

				throw new NodeOperationError(this.getNode(), errorMessage(error), {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
