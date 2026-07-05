import { z } from 'zod';
import {
  DEFAULT_TRANSLATION_FUNCTIONS,
  DEFAULT_NAMESPACE_FUNCTIONS,
  DEFAULT_IGNORED_PATTERNS,
  DEFAULT_IGNORED_WORDS,
  DEFAULT_SOURCE_INCLUDE,
  DEFAULT_SOURCE_EXCLUDE,
  DEFAULT_TRANSLATION_FILES,
} from '../constants/index.js';

// ─── Source ────────────────────────────────────────────────────────────────────

const SourceSchema = z.object({
  /** Glob patterns for source files to scan */
  include: z.array(z.string()).default(DEFAULT_SOURCE_INCLUDE),
  /** Glob patterns to exclude from scanning */
  exclude: z.array(z.string()).default(DEFAULT_SOURCE_EXCLUDE),
});

// ─── Translations ──────────────────────────────────────────────────────────────

const TranslationsSchema = z.object({
  /** BCP 47 language tag of the reference language (source of truth) */
  default_language: z.string().default('en'),
  /** Glob patterns pointing to JSON translation files */
  files: z.array(z.string()).default(DEFAULT_TRANSLATION_FILES),
});

// ─── Extraction ────────────────────────────────────────────────────────────────

const ExtractionSchema = z.object({
  /**
   * Function names (or member expressions) to treat as translation calls.
   *
   * Example: ["t", "i18n.t", "translate", "$t"]
   */
  translation_functions: z.array(z.string()).default(DEFAULT_TRANSLATION_FUNCTIONS),

  /**
   * Namespace-hook function names whose static first argument (or `namespace`
   * property, for `getTranslations({ namespace: '...' })`-style calls)
   * establishes a key prefix for the translation function it returns.
   *
   * Example: `const t = useTranslations("CommonMessage")` then `t("save")`
   * extracts the key `CommonMessage.save`, not just `save`.
   */
  namespace_functions: z.array(z.string()).default(DEFAULT_NAMESPACE_FUNCTIONS),

  /** Exact words to never flag as hardcoded text */
  ignored_words: z.array(z.string()).default(DEFAULT_IGNORED_WORDS),

  /**
   * Regex patterns — strings matching any of these are ignored during
   * hardcoded-text detection (key extraction is unaffected).
   */
  ignored_patterns: z.array(z.string()).default(DEFAULT_IGNORED_PATTERNS),

  /** Additional custom regex patterns to ignore */
  custom_regex_patterns: z.array(z.string()).default([]),

  /** Include JSDoc / inline comments in output reports */
  include_comments: z.boolean().default(false),
});

// ─── Detection ────────────────────────────────────────────────────────────────

const DetectionSchema = z.object({
  /**
   * Ignore files whose content contains any of these strings.
   * Useful for auto-generated files.
   */
  ignore_files_containing: z.array(z.string()).default([]),

  /** Ignore files whose path contains any of these substrings */
  ignore_paths_containing: z.array(z.string()).default([]),

  /** Ignore files whose basename matches any of these regex patterns */
  ignore_filenames_matching: z.array(z.string()).default([]),
});

// ─── AI Translation ───────────────────────────────────────────────────────────

const AITranslationSchema = z
  .object({
    /** Enable or disable AI translation globally */
    enabled: z.boolean().default(false),

    /** AI provider to use for translation */
    provider: z.enum(['openai']).default('openai'),

    /** OpenAI API key — required when provider = "openai" */
    openai_api_key: z.string().optional(),

    /**
     * OpenAI model to use.
     *
     * Recommended: "gpt-4.1-mini" (fast + affordable)
     * Higher quality: "gpt-4.1"
     */
    model: z.string().default('gpt-4.1-mini'),

    /** Temperature (0 = deterministic, best for translations) */
    temperature: z.number().min(0).max(2).default(0),

    /** Maximum number of keys to translate per API call */
    batch_size: z.number().int().min(1).max(500).default(50),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.provider === 'openai' && !data.openai_api_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['openai_api_key'],
        message:
          'openai_api_key is required when provider is "openai" and ai_translation is enabled.\n' +
          'Set it via process.env.OPENAI_API_KEY or directly in your config.',
      });
    }
  });

// ─── Root Config ──────────────────────────────────────────────────────────────

export const TranslifyConfigSchema = z.object({
  source: SourceSchema.default({}),
  translations: TranslationsSchema.default({}),
  extraction: ExtractionSchema.default({}),
  detection: DetectionSchema.default({}),
  ai_translation: AITranslationSchema.default({}),
});

export type TranslifyConfig = z.infer<typeof TranslifyConfigSchema>;
export type TranslifyConfigInput = z.input<typeof TranslifyConfigSchema>;

/** Partial config as returned by defineConfig() — filled with defaults during load */
export type UserConfig = TranslifyConfigInput;
