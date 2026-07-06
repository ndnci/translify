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

const SourceSchema = z
  .object({
    /** Glob patterns for source files to scan */
    include: z.array(z.string()).default(DEFAULT_SOURCE_INCLUDE),
    /** Glob patterns to exclude from scanning */
    exclude: z.array(z.string()).default(DEFAULT_SOURCE_EXCLUDE),
  })
  .strict();

// ─── Translations ──────────────────────────────────────────────────────────────

const SplitGroupSchema = z
  .object({
    /** Output file name without `.json`, e.g. "tools" */
    name: z.string().min(1),
    /** Case-insensitive substrings or regex patterns matched against top-level keys */
    match: z.array(z.string()).default([]),
  })
  .strict();

const TranslationSplitSchema = z
  .object({
    /**
     * Dot-key depth used for default grouping.
     * depth=1 turns `auth.login.title` into `auth.json`.
     */
    depth: z.number().int().min(1).default(1),
    /**
     * Optional custom groups. A string is shorthand for
     * `{ name: "tools", match: ["tools"] }`.
     */
    groups: z.array(z.union([z.string(), SplitGroupSchema])).default([]),
    /** What custom group matchers inspect: dot-keys, translated values, or both */
    group_match: z.enum(['keys', 'values', 'both']).default('keys'),
    /**
     * Output path pattern. Supported placeholders:
     * `{language}` and `{group}`.
     */
    output_pattern: z.string().optional(),
  })
  .strict();

const TranslationsSchema = z
  .object({
    /** BCP 47 language tag of the reference language (source of truth) */
    default_language: z.string().default('en'),
    /** Glob patterns pointing to JSON translation files */
    files: z.array(z.string()).default(DEFAULT_TRANSLATION_FILES),
    /** Options used by `split-translations` and missing-key routing */
    split: TranslationSplitSchema.default({}),
  })
  .strict();

// ─── Extraction ────────────────────────────────────────────────────────────────

const ExtractionSchema = z
  .object({
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
  })
  .strict();

// ─── Detection ────────────────────────────────────────────────────────────────

const DetectionSchema = z
  .object({
    /**
     * Ignore files whose content contains any of these strings.
     * Useful for auto-generated files.
     */
    ignore_files_containing: z.array(z.string()).default([]),

    /** Ignore files whose path contains any of these substrings */
    ignore_paths_containing: z.array(z.string()).default([]),

    /** Ignore files whose basename matches any of these regex patterns */
    ignore_filenames_matching: z.array(z.string()).default([]),
  })
  .strict();

// ─── AI Translation ───────────────────────────────────────────────────────────

const AITranslationSchema = z
  .object({
    /** Enable or disable AI translation globally */
    enabled: z.boolean().default(false),

    /** AI provider to use for translation */
    provider: z.enum(['openai', 'openrouter']).default('openai'),

    /** OpenAI API key — required when provider = "openai" */
    openai_api_key: z.string().optional(),

    /** OpenRouter API key — required when provider = "openrouter" */
    openrouter_api_key: z.string().optional(),

    /**
     * AI model to use.
     *
     * Recommended: "gpt-4.1-mini" (fast + affordable)
     * OpenRouter accepts any model slug from https://openrouter.ai/models
     */
    model: z.string().default('gpt-4.1-mini'),

    /** Temperature (0 = deterministic, best for translations) */
    temperature: z.number().min(0).max(2).default(0),

    /** Maximum number of keys to translate per API call */
    batch_size: z.number().int().min(1).max(500).default(50),

    /** Ask a second LLM pass to verify and correct each translated batch */
    verify: z.boolean().default(false),

    /** Optional model used for verification; defaults to `model` */
    verify_model: z.string().optional(),

    /** Send only source values to the provider, then remap by response order */
    values_only: z.boolean().default(false),
  })
  .strict()
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

    if (data.enabled && data.provider === 'openrouter' && !data.openrouter_api_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['openrouter_api_key'],
        message:
          'openrouter_api_key is required when provider is "openrouter" and ai_translation is enabled.\n' +
          'Set it via process.env.OPENROUTER_API_KEY or directly in your config.',
      });
    }
  });

// ─── Root Config ──────────────────────────────────────────────────────────────

export const TranslifyConfigSchema = z
  .object({
    source: SourceSchema.default({}),
    translations: TranslationsSchema.default({}),
    extraction: ExtractionSchema.default({}),
    detection: DetectionSchema.default({}),
    ai_translation: AITranslationSchema.default({}),
  })
  .strict();

export type TranslifyConfig = z.infer<typeof TranslifyConfigSchema>;
export type TranslifyConfigInput = z.input<typeof TranslifyConfigSchema>;

/** Partial user config input — filled with defaults during load */
export type UserConfig = TranslifyConfigInput;
