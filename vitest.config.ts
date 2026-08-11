const config = {
	test: {
		clearMocks: true,
		environment: 'node',
		include: ['tests/**/*.test.mts'],
		mockReset: true,
		restoreMocks: true,
		coverage: {
			enabled: true,
			provider: 'v8',
			include: ['credentials/**/*.credentials.ts', 'nodes/**/*.node.ts'],
			exclude: ['**/*.test.mts'],
			reporter: ['text', 'json-summary'],
			reportsDirectory: 'coverage',
			thresholds: {
				branches: 100,
				functions: 100,
				lines: 100,
				statements: 100,
			},
		},
	},
} satisfies import('vitest/config').UserConfig;

export = config;
