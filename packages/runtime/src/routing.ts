import { detectLocale, matchSupportedLocale } from './locale.js';
import type {
  AlternateLink,
  I18nRouter,
  LocaleCookieConfig,
  LocalePrefix,
  ResolvedRoute,
  RoutingResolveOptions,
  TrailingSlash,
  TranslifyConfigLike,
} from './types.js';

const RELATIVE_ORIGIN = 'http://translify.local';

interface RouteMatch {
  internalPathname: string;
  locale: string;
  params: Record<string, string>;
  isLocalized: boolean;
}

interface ParsedInput {
  url: URL;
  relative: boolean;
  headers: Headers | Readonly<Record<string, string | undefined>> | undefined;
}

export function createI18nRouter<const Locale extends string>(
  config: TranslifyConfigLike & { routing: { locales: readonly Locale[] } },
): I18nRouter<Locale> {
  const routing = config.routing;
  const locales = [...routing.locales];
  if (locales.length === 0) throw new Error('routing.locales must contain at least one locale.');

  const matchedDefault = matchSupportedLocale(locales, config.translations.default_language);
  if (!matchedDefault) {
    throw new Error(
      `The default language "${config.translations.default_language}" must be included in routing.locales.`,
    );
  }

  const defaultLocale = matchedDefault as Locale;
  const localePrefix = routing.locale_prefix ?? 'as-needed';
  const localeDetection = routing.locale_detection ?? true;
  const cookie = routing.locale_cookie === false ? false : normalizeCookie(routing.locale_cookie);
  const pathnames = routing.pathnames ?? {};
  const basePath = normalizeBasePath(routing.base_path);
  const trailingSlash = routing.trailing_slash ?? 'preserve';

  const publicPattern = (internal: string, locale: string): string => {
    const configured = pathnames[internal];
    if (typeof configured === 'string') return configured;
    return configured?.[locale] ?? internal;
  };

  const localizeInternalPath = (pathname: string, locale: Locale): string => {
    const match = matchInternal(pathname, Object.keys(pathnames));
    if (!match) return pathname;
    return interpolatePath(publicPattern(match.pattern, locale), match.params);
  };

  const href = (pathname: string, locale: Locale = defaultLocale): string => {
    const matchedLocale = matchSupportedLocale(locales, locale);
    if (!matchedLocale) throw new Error(`Unsupported locale: "${locale}".`);

    const parsed = new URL(pathname, RELATIVE_ORIGIN);
    const internalPathname = stripBasePath(parsed.pathname, basePath);
    const localized = localizeInternalPath(internalPathname, matchedLocale as Locale);
    const prefix = shouldPrefix(matchedLocale, defaultLocale, localePrefix)
      ? `/${matchedLocale}`
      : '';
    const nextPathname = applyTrailingSlash(
      `${basePath}${prefix}${ensureLeadingSlash(localized)}`,
      trailingSlash,
      parsed.pathname,
    );
    return `${nextPathname}${parsed.search}${parsed.hash}`;
  };

  const resolve = (
    input: string | URL | Request,
    options: RoutingResolveOptions = {},
  ): ResolvedRoute<Locale> => {
    const parsed = parseInput(input, options);
    const originalPathname = parsed.url.pathname;
    const applicationPath = stripBasePath(originalPathname, basePath);
    const { locale: prefixedLocale, pathname: unprefixedPath } = readLocalePrefix(
      applicationPath,
      locales,
    );
    const match = matchPublicPath(
      unprefixedPath,
      pathnames,
      locales,
      defaultLocale,
      prefixedLocale,
    );
    const detected = localeDetection
      ? detectRequestedLocale(locales, defaultLocale, parsed.headers, cookie)
      : defaultLocale;
    const hintedLocale = match?.isLocalized ? match.locale : undefined;
    const locale = (prefixedLocale ?? hintedLocale ?? detected) as Locale;
    const internalPathname = match?.internalPathname ?? unprefixedPath;
    const localizedPathname = href(
      `${internalPathname}${parsed.url.search}${parsed.url.hash}`,
      locale,
    );
    const canonical = new URL(localizedPathname, parsed.url.origin);
    const redirect = canonicalPath(canonical) === canonicalPath(parsed.url) ? undefined : canonical;

    return {
      locale,
      pathname: internalPathname,
      localizedPathname: canonical.pathname,
      params: Object.freeze(match?.params ?? {}),
      ...(redirect && { redirect: parsed.relative ? relativeUrl(redirect) : redirect.href }),
      ...(cookie &&
        locale !== defaultLocale && { localeCookie: serializeLocaleCookie(cookie, locale) }),
    };
  };

  const switchLocale = (input: string | URL, locale: Locale): string => {
    const parsed = parseInput(input, {});
    const current = resolve(input);
    const next = href(`${current.pathname}${parsed.url.search}${parsed.url.hash}`, locale);
    if (parsed.relative) return next;
    return new URL(next, parsed.url.origin).href;
  };

  const alternates = (pathname: string, origin?: string): AlternateLink[] => {
    const parsed = parseInput(pathname, {});
    const current = resolve(pathname);
    const baseOrigin = origin ?? (parsed.relative ? undefined : parsed.url.origin);
    const buildHref = (locale: Locale) => {
      const localized = href(`${current.pathname}${parsed.url.search}${parsed.url.hash}`, locale);
      return baseOrigin ? new URL(localized, baseOrigin).href : localized;
    };

    return [
      ...locales.map((locale) => ({ locale, href: buildHref(locale) })),
      { locale: 'x-default', href: buildHref(defaultLocale) },
    ];
  };

  return { locales, defaultLocale, href, resolve, switchLocale, alternates };
}

function parseInput(input: string | URL | Request, options: RoutingResolveOptions): ParsedInput {
  if (typeof input !== 'string' && !(input instanceof URL)) {
    return { url: new URL(input.url), relative: false, headers: options.headers ?? input.headers };
  }
  if (input instanceof URL)
    return { url: new URL(input), relative: false, headers: options.headers };
  const relative = !/^[a-z][a-z\d+.-]*:\/\//i.test(input);
  return { url: new URL(input, RELATIVE_ORIGIN), relative, headers: options.headers };
}

function detectRequestedLocale<Locale extends string>(
  locales: readonly Locale[],
  defaultLocale: Locale,
  headers: ParsedInput['headers'],
  cookie: Required<LocaleCookieConfig> | false,
): Locale {
  const cookieLocale = cookie ? readCookie(readHeader(headers, 'cookie'), cookie.name) : undefined;
  const requested = [
    ...(cookieLocale ? [cookieLocale] : []),
    ...parseAcceptLanguage(readHeader(headers, 'accept-language')),
  ];
  return detectLocale(locales, defaultLocale, requested) as Locale;
}

function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((entry, index) => {
      const [locale = '', ...parameters] = entry.trim().split(';');
      const quality = parameters.reduce((current, parameter) => {
        const match = /^q=([01](?:\.\d+)?)$/i.exec(parameter.trim());
        return match ? Number(match[1]) : current;
      }, 1);
      return { locale, quality, index };
    })
    .filter(({ locale, quality }) => locale !== '*' && locale.length > 0 && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(({ locale }) => locale);
}

function readHeader(headers: ParsedInput['headers'], name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof Headers !== 'undefined' && headers instanceof Headers)
    return headers.get(name) ?? undefined;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function normalizeCookie(cookie: LocaleCookieConfig | undefined): Required<LocaleCookieConfig> {
  return {
    name: cookie?.name ?? 'translify_locale',
    max_age: cookie?.max_age ?? 31_536_000,
    same_site: cookie?.same_site ?? 'lax',
    secure: cookie?.secure ?? false,
  };
}

function serializeLocaleCookie(cookie: Required<LocaleCookieConfig>, locale: string): string {
  return [
    `${cookie.name}=${encodeURIComponent(locale)}`,
    'Path=/',
    `Max-Age=${cookie.max_age}`,
    `SameSite=${capitalize(cookie.same_site)}`,
    ...(cookie.secure ? ['Secure'] : []),
  ].join('; ');
}

function matchPublicPath(
  pathname: string,
  pathnames: Readonly<Record<string, string | Readonly<Record<string, string>>>>,
  locales: readonly string[],
  defaultLocale: string,
  preferredLocale?: string,
): RouteMatch | undefined {
  const localeOrder = preferredLocale
    ? [preferredLocale]
    : [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];

  for (const locale of localeOrder) {
    for (const [internal, localized] of Object.entries(pathnames)) {
      const pattern = typeof localized === 'string' ? localized : (localized[locale] ?? internal);
      const params = matchPattern(pathname, pattern);
      if (!params) continue;
      const defaultPattern =
        typeof localized === 'string' ? localized : (localized[defaultLocale] ?? internal);
      return {
        internalPathname: interpolatePath(internal, params),
        locale,
        params,
        isLocalized: locale !== defaultLocale && pattern !== defaultPattern,
      };
    }
  }
  return undefined;
}

function matchInternal(
  pathname: string,
  patterns: readonly string[],
): { pattern: string; params: Record<string, string> } | undefined {
  for (const pattern of patterns) {
    const params = matchPattern(pathname, pattern);
    if (params) return { pattern, params };
  }
  return undefined;
}

function matchPattern(pathname: string, pattern: string): Record<string, string> | undefined {
  const names: string[] = [];
  const segments = ensureLeadingSlash(pattern).split('/').filter(Boolean);
  const source = segments
    .map((segment) => {
      const catchAll = /^\[\.\.\.([^\]]+)\]$/.exec(segment);
      if (catchAll?.[1]) {
        names.push(catchAll[1]);
        return '(.+)';
      }
      const dynamic = /^\[([^\]]+)\]$/.exec(segment);
      if (dynamic?.[1]) {
        names.push(dynamic[1]);
        return '([^/]+)';
      }
      return escapeRegExp(segment);
    })
    .join('/');
  const match = new RegExp(`^/${source}/?$`).exec(ensureLeadingSlash(pathname));
  if (!match) return undefined;
  return Object.fromEntries(
    names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? '')]),
  );
}

function interpolatePath(pattern: string, params: Readonly<Record<string, string>>): string {
  return ensureLeadingSlash(pattern).replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_match, name: string) =>
    encodeURIComponent(params[name] ?? '').replace(/%2F/gi, '/'),
  );
}

function readLocalePrefix(
  pathname: string,
  locales: readonly string[],
): { locale?: string; pathname: string } {
  const [first = '', ...rest] = pathname.split('/').filter(Boolean);
  const locale = matchSupportedLocale(locales, first);
  if (!locale || first.toLowerCase() !== locale.toLowerCase()) return { pathname };
  return { locale, pathname: rest.length > 0 ? `/${rest.join('/')}` : '/' };
}

function shouldPrefix(locale: string, defaultLocale: string, strategy: LocalePrefix): boolean {
  return strategy === 'always' || (strategy === 'as-needed' && locale !== defaultLocale);
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') return '';
  return ensureLeadingSlash(value).replace(/\/$/, '');
}

function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
}

function applyTrailingSlash(
  pathname: string,
  strategy: TrailingSlash,
  originalPathname: string,
): string {
  if (pathname === '/') return pathname;
  if (strategy === 'always' || (strategy === 'preserve' && originalPathname.endsWith('/'))) {
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  }
  return pathname.replace(/\/$/, '');
}

function canonicalPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function relativeUrl(url: URL): string {
  return canonicalPath(url);
}

function ensureLeadingSlash(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
