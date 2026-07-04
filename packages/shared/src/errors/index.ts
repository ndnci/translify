export class TranslifyError extends Error {
  /** Machine-readable error code for programmatic handling */
  readonly code: string;

  constructor(
    code: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TranslifyError';
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigError extends TranslifyError {
  constructor(message: string, cause?: unknown) {
    super('CONFIG_ERROR', message, cause);
    this.name = 'ConfigError';
  }
}

export class ConfigNotFoundError extends TranslifyError {
  constructor(searchedPaths: string[]) {
    super(
      'CONFIG_NOT_FOUND',
      `No Translify config file found. Searched:\n${searchedPaths.map((p) => `  - ${p}`).join('\n')}\n\nRun \`translify init\` to create one.`,
    );
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigValidationError extends TranslifyError {
  constructor(
    message: string,
    public readonly issues: { path: string; message: string }[],
  ) {
    const details = issues.map((i) => `  • ${i.path}: ${i.message}`).join('\n');
    super('CONFIG_VALIDATION_ERROR', `${message}\n\n${details}`);
    this.name = 'ConfigValidationError';
  }
}

export class ParseError extends TranslifyError {
  constructor(
    public readonly file: string,
    message: string,
    cause?: unknown,
  ) {
    super('PARSE_ERROR', `Failed to parse ${file}: ${message}`, cause);
    this.name = 'ParseError';
  }
}

export class TranslationFileError extends TranslifyError {
  constructor(
    public readonly file: string,
    message: string,
    cause?: unknown,
  ) {
    super('TRANSLATION_FILE_ERROR', `Translation file error (${file}): ${message}`, cause);
    this.name = 'TranslationFileError';
  }
}

export class AIProviderError extends TranslifyError {
  constructor(
    public readonly provider: string,
    message: string,
    cause?: unknown,
  ) {
    super('AI_PROVIDER_ERROR', `AI provider error [${provider}]: ${message}`, cause);
    this.name = 'AIProviderError';
  }
}

export class MissingApiKeyError extends TranslifyError {
  constructor(provider: string, envVar: string) {
    super(
      'MISSING_API_KEY',
      `AI provider "${provider}" requires an API key.\n\n` +
        `Set the environment variable: ${envVar}\n` +
        `Or configure it in your translify.config.ts:\n\n` +
        `  ai_translation: {\n` +
        `    enabled: true,\n` +
        `    provider: '${provider}',\n` +
        `    ${provider}_api_key: process.env.${envVar},\n` +
        `  }`,
    );
    this.name = 'MissingApiKeyError';
  }
}
