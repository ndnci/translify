// Supported source file extensions
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

// Supported translation file formats
export const TRANSLATION_FILE_EXTENSIONS = ['.json'];

// Default config file names (in order of priority)
export const CONFIG_FILE_NAMES = [
  'translify.config.ts',
  'translify.config.js',
  'translify.config.mjs',
  'translify.config.cjs',
  'translify.config.json',
];

// Alternative config locations
export const CONFIG_SEARCH_DIRS = ['.', 'config', '.config'];

// Default translation function names
export const DEFAULT_TRANSLATION_FUNCTIONS = ['t', 'i18n.t', 'translate', '$t'];

// Default namespace-hook functions, e.g. `const t = useTranslations("Namespace")`
export const DEFAULT_NAMESPACE_FUNCTIONS = ['useTranslations', 'getTranslations'];

// Default patterns to ignore during extraction
export const DEFAULT_IGNORED_PATTERNS = [
  '^v\\d+', // version strings like v1.2.3
  '^\\d+(\\.\\d+)*$', // pure numbers and decimals
  '^[A-Z_]+$', // all-caps constants like "ERROR_CODE"
  '^https?://', // URLs
];

// Default words to ignore during extraction
export const DEFAULT_IGNORED_WORDS = ['OK', 'API', 'ID', 'URL', 'HTTP', 'HTTPS'];

// Default source file patterns. Includes both a `src/` layout and Next.js
// App Router's top-level `app/` directory (layout.tsx/page.tsx live there,
// outside `src/`, and are otherwise silently never scanned).
export const DEFAULT_SOURCE_INCLUDE = ['src/**/*.{ts,tsx,js,jsx}', 'app/**/*.{ts,tsx,js,jsx}'];

// Default excluded patterns
export const DEFAULT_SOURCE_EXCLUDE = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
];

// Default translations directory pattern
export const DEFAULT_TRANSLATION_FILES = ['messages/*.json', 'locales/*.json', 'i18n/*.json'];

export const VERSION = '0.3.0';
export const CLI_NAME = 'translify';
export const PACKAGE_NAME = '@ndnci/translify';
