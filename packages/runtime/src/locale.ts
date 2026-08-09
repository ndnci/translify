export function canonicalizeLocale(locale: string): string | undefined {
  const value = locale.trim();
  if (!value) return undefined;

  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

export function localeCandidates(locale: string): string[] {
  const canonical = canonicalizeLocale(locale);
  if (!canonical) return [];

  const candidates = [canonical];
  try {
    const language = new Intl.Locale(canonical).language;
    if (language !== canonical) candidates.push(language);
  } catch {
    // `canonicalizeLocale` already validated the tag. Older runtimes may not expose Intl.Locale.
  }
  return candidates;
}

export function matchSupportedLocale(
  supportedLocales: readonly string[],
  requestedLocale: string,
): string | undefined {
  const supported = new Map<string, string>();
  for (const locale of supportedLocales) {
    const canonical = canonicalizeLocale(locale);
    if (canonical) supported.set(canonical, locale);
  }

  for (const candidate of localeCandidates(requestedLocale)) {
    const match = supported.get(candidate);
    if (match) return match;
  }
  return undefined;
}

export function detectLocale(
  supportedLocales: readonly string[],
  defaultLocale: string,
  requestedLocales: readonly string[] = browserLanguages(),
): string {
  for (const requested of requestedLocales) {
    const match = matchSupportedLocale(supportedLocales, requested);
    if (match) return match;
  }

  return matchSupportedLocale(supportedLocales, defaultLocale) ?? defaultLocale;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
