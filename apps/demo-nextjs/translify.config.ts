export default {
  source: {
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['**/*.test.*', '**/node_modules/**'],
  },

  translations: {
    default_language: 'en',
    files: ['messages/**/*.json'],
  },

  routing: {
    locales: ['en', 'fr'],
    locale_prefix: 'as-needed',
    locale_detection: true,
    pathnames: {
      '/': '/',
    },
  },

  extraction: {
    translation_functions: ['t', 'useTranslations'],
    ignored_words: ['OK', 'API'],
    ignored_patterns: ['^v[0-9]+$'],
  },

  ai_translation: {
    enabled: false,
    provider: 'openai',
    openai_api_key: process.env.OPENAI_API_KEY,
    model: 'gpt-5.6-luna',
    temperature: 0,
  },
} as const;
