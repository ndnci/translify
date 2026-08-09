import { relative, sep } from 'node:path';
import type { TranslifyConfig, TranslationFile } from '@ndnci/translify-shared';
import { flattenTranslations } from '@ndnci/translify-shared';
import {
  addTranslationKeys,
  loadTranslationFile,
  scanTranslationFiles,
} from '@ndnci/translify-core';
import {
  createProvider,
  type BaseTranslationProvider,
  type TranslationUsage,
} from '@ndnci/translify-ai';

export interface StudioFileGroup {
  id: string;
  label: string;
  files: Record<string, string>;
}

export interface StudioMetadata {
  defaultLanguage: string;
  languages: string[];
  groups: StudioFileGroup[];
  ai: {
    enabled: boolean;
    provider: string;
    model: string;
  };
}

export interface StudioEntry {
  key: string;
  source: string;
  target: string;
  missing: boolean;
}

export interface StudioTranslateInput {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  suggestions?: number;
  candidate?: string;
}

export interface StudioTranslateResult {
  translations: string[];
  usage?: TranslationUsage;
  provider: string;
}

type StudioConfig = Pick<TranslifyConfig, 'translations' | 'ai_translation'>;

export interface CreateStudioServiceOptions {
  cwd: string;
  config: StudioConfig;
  provider?: BaseTranslationProvider;
}

export interface StudioService {
  metadata: StudioMetadata;
  entries(groupId: string, targetLanguage: string): StudioEntry[];
  update(groupId: string, targetLanguage: string, key: string, value: string): void;
  translate(input: StudioTranslateInput): Promise<StudioTranslateResult>;
}

/** Collapses one physical file per locale into one logical sidebar item. */
export function groupTranslationFiles(files: TranslationFile[], cwd: string): StudioFileGroup[] {
  const groups = new Map<string, StudioFileGroup>();

  for (const file of files) {
    const id = logicalFileId(file.path, file.language, cwd);
    const group = groups.get(id) ?? {
      id,
      label: id.replace(/\.json$/i, '').replace(/\/index$/i, ''),
      files: {},
    };
    group.files[file.language] = file.path;
    groups.set(id, group);
  }

  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function createStudioService(
  options: CreateStudioServiceOptions,
): Promise<StudioService> {
  const paths = await scanTranslationFiles(options.config, options.cwd);
  const files = paths.map(loadTranslationFile);
  const groups = groupTranslationFiles(files, options.cwd);
  const languages = [...new Set(files.map((file) => file.language))].sort((a, b) =>
    a.localeCompare(b),
  );
  const configuredProvider = options.provider;
  let lazyProvider: BaseTranslationProvider | undefined;

  const metadata: StudioMetadata = {
    defaultLanguage: options.config.translations.default_language,
    languages,
    groups,
    ai: {
      enabled: options.config.ai_translation.enabled,
      provider: options.config.ai_translation.provider,
      model: options.config.ai_translation.model,
    },
  };

  function findGroup(groupId: string): StudioFileGroup {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) throw new Error(`Unknown translation file group: ${groupId}`);
    return group;
  }

  function readFlat(path: string | undefined): Record<string, string> {
    return path ? flattenTranslations(loadTranslationFile(path).data) : {};
  }

  return {
    metadata,

    entries(groupId, targetLanguage) {
      const group = findGroup(groupId);
      const source = readFlat(group.files[metadata.defaultLanguage]);
      const target = readFlat(group.files[targetLanguage]);
      const keys = [...new Set([...Object.keys(source), ...Object.keys(target)])].sort((a, b) =>
        a.localeCompare(b),
      );

      return keys.map((key) => ({
        key,
        source: source[key] ?? '',
        target: target[key] ?? '',
        missing: !target[key],
      }));
    },

    update(groupId, targetLanguage, key, value) {
      const group = findGroup(groupId);
      const path = group.files[targetLanguage];
      if (!path) {
        throw new Error(`No ${targetLanguage} file exists for ${groupId}`);
      }
      if (!key.trim()) throw new Error('Translation key cannot be empty');
      const sourceFlat = readFlat(group.files[metadata.defaultLanguage]);
      const targetFlat = readFlat(path);
      if (!(key in sourceFlat) && !(key in targetFlat)) {
        throw new Error(`Unknown translation key: ${key}`);
      }
      addTranslationKeys(path, { [key]: value });
    },

    async translate(input) {
      const count = input.suggestions ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > 10) {
        throw new Error('Suggestion count must be between 1 and 10');
      }
      if (!input.text.trim()) throw new Error('Text cannot be empty');
      if (input.sourceLanguage === input.targetLanguage) {
        throw new Error('Source and target languages must differ');
      }

      const provider =
        configuredProvider ??
        (options.config.ai_translation.enabled
          ? (lazyProvider ??= createProvider(options.config.ai_translation))
          : undefined);
      if (!provider) {
        throw new Error('AI translation is disabled in translify.config');
      }

      const entries = Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`suggestion_${index + 1}`, input.text]),
      );
      const candidateGuidance = input.candidate?.trim()
        ? `Use "${input.candidate.trim()}" as a starting point and produce distinct, natural alternatives.`
        : count > 1
          ? 'Produce distinct, natural alternatives for every entry.'
          : undefined;
      const response = await provider.translate({
        entries,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        valuesOnly: false,
        verify: options.config.ai_translation.verify,
        ...(options.config.ai_translation.verify_model && {
          verifyModel: options.config.ai_translation.verify_model,
        }),
        ...(candidateGuidance && { instructions: candidateGuidance }),
      });

      return {
        translations: Object.keys(entries).map((key) => response.translations[key] ?? ''),
        provider: response.provider,
        ...(response.usage && { usage: response.usage }),
      };
    },
  };
}

function logicalFileId(filePath: string, language: string, cwd: string): string {
  const normalized = relative(cwd, filePath).split(sep).join('/');
  const parts = normalized.split('/');
  const languageIndex = parts.findIndex((part) => part.toLowerCase() === language.toLowerCase());

  if (languageIndex >= 0) {
    parts.splice(languageIndex, 1);
  } else {
    const basename = parts.at(-1) ?? '';
    if (basename.replace(/\.json$/i, '').toLowerCase() === language.toLowerCase()) {
      parts[parts.length - 1] = 'index.json';
    }
  }

  return parts.join('/');
}
