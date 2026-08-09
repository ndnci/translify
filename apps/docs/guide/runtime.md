# Application Runtime

Translify can be the translation runtime used by your application as well as the
CLI that maintains its catalogues. The same package supports Vanilla JavaScript,
React, and Next.js without loading CLI code into the browser.

```bash
npm install @ndnci/translify
```

The runtime handles nested or flat dot keys, ICU interpolation, cardinal
plurals, `select` messages, locale-aware dates/numbers/lists, per-message
fallback and live locale changes. Translation keys are inferred from JSON
imports in TypeScript.

## Vanilla JavaScript

Vanilla is the framework-independent foundation; it does not require React or a
server.

```ts
import { createI18n, detectLocale } from '@ndnci/translify/vanilla';
import en from './messages/en.json';
import fr from './messages/fr.json';

const messages = { en, fr };
const locale = detectLocale(Object.keys(messages), 'en');

export const i18n = createI18n({
  locale,
  defaultLocale: 'en',
  messages,
  timeZone: 'Europe/Paris',
});

document.querySelector('#title').textContent = i18n.t('home.title', {
  name: 'Ada',
});

const stop = i18n.subscribe(() => {
  document.documentElement.lang = i18n.locale;
});

i18n.setLocale('fr');
// Call stop() when the view is destroyed.
```

Use `textContent`, not `innerHTML`, for ordinary translated strings. Translify
preserves literal tags as text and does not treat catalogue content as trusted
HTML.

If your `translify.config` is browser-safe,
`createI18nFromConfig(config, options)` reads `translations.default_language`
directly so it is not repeated. Do not import a config containing server-only
environment variables into a client bundle.

## Localized URLs

URL behavior lives in `translify.config.ts`, next to the catalogue settings.
`locale_prefix` accepts `always`, `as-needed`, or `never`; automatic detection
can be disabled independently. Public pathnames can translate static segments
without changing dynamic parameter names.

```ts
import { createI18nRouter } from '@ndnci/translify/vanilla';
import config from '../../translify.config';

export const routing = createI18nRouter(config);

routing.href('/about', 'fr'); // /fr/a-propos
routing.href('/blog/hello?from=home', 'fr');
// /fr/actualites/hello?from=home

routing.switchLocale('/fr/actualites/hello', 'en'); // /blog/hello
```

On the server, `routing.resolve(request)` gives one stable internal pathname,
the locale, dynamic parameters, an optional canonical redirect, and an optional
`Set-Cookie` value. It understands locale prefixes, translated paths, the
configured preference cookie and weighted `Accept-Language` values. Use the same
method in middleware for any framework:

```ts
const route = routing.resolve(request);

if (route.redirect) {
  return Response.redirect(route.redirect, 307);
}

// route.locale, route.pathname and route.params are safe for request handling.
```

`routing.alternates('/about', origin)` returns localized canonical URLs plus an
`x-default` entry for `hreflang` tags and sitemaps. Query strings, hashes, base
paths and the configured trailing-slash policy are preserved.

## ICU messages

Messages use standard ICU syntax:

```json
{
  "profile": {
    "hello": "Hello {name}",
    "followers": "{count, plural, =0 {No followers} one {# follower} other {# followers}}",
    "role": "{role, select, admin {Administrator} other {Member}}"
  }
}
```

```ts
const t = i18n.getTranslator('profile');

t('hello', { name: 'Ada' });
t('followers', { count: 3 });
t('role', { role: 'admin' });
```

Available formatters are `formatNumber`, `formatDate`, `formatList`, and
`formatRelativeTime`. Set a fixed `timeZone` when server and browser output must
hydrate identically.

## React

Create one instance outside the component tree, then provide it. Hooks subscribe
with React's external-store API, so a locale change rerenders consumers without
a global singleton hidden inside the package.

```tsx
import { createI18n } from '@ndnci/translify/vanilla';
import {
  TranslifyProvider,
  useLocale,
  useTranslations,
} from '@ndnci/translify/react';
import en from './messages/en.json';
import fr from './messages/fr.json';

const i18n = createI18n({
  locale: 'en',
  defaultLocale: 'en',
  messages: { en, fr },
});

root.render(
  <TranslifyProvider i18n={i18n}>
    <App />
  </TranslifyProvider>,
);

function App() {
  const locale = useLocale();
  const t = useTranslations('home');
  return <h1 lang={locale}>{t('title')}</h1>;
}
```

## Next.js App Router

The server helper deliberately creates an isolated translator per request. It
never stores a request locale in module-global mutable state.

```ts
// src/i18n/request.ts
import { createNextI18n } from '@ndnci/translify/next';
import config from '../../translify.config';

const loaders = {
  en: () => import('../../messages/en.json').then((m) => m.default),
  fr: () => import('../../messages/fr.json').then((m) => m.default),
} as const;

export const i18n = createNextI18n({
  config,
  locales: ['en', 'fr'] as const,
  loadMessages: (locale) => loaders[locale](),
  timeZone: 'UTC',
});
```

Use the async translator in a Server Component:

```tsx
import { i18n } from '@/i18n/request';

export default async function Page() {
  const t = await i18n.getTranslations({ locale: 'fr', namespace: 'home' });
  return <h1>{t('title')}</h1>;
}
```

For Client Components, pass the serializable request configuration through the
provider in a layout:

```tsx
import { TranslifyProvider } from '@ndnci/translify/react';
import { i18n } from '@/i18n/request';

export default async function Layout({ children }) {
  const clientConfig = await i18n.getClientConfig('fr');
  return <TranslifyProvider {...clientConfig}>{children}</TranslifyProvider>;
}
```

`resolveLocale` validates untrusted route parameters, `isLocale` is a TypeScript
type guard, and `generateStaticParams()` returns every configured locale for
SSG. Use `createI18nRouter(config)` from the same `/next` entry point in the
framework middleware; no second routing configuration is required.

## Missing messages and fallback

Fallback happens for each message in this order: exact locale (`fr-CA`), base
locale (`fr`), then `defaultLocale`. A fallback string is still formatted with
the active locale's plural/date rules.

The default missing-message result is the key, which keeps the UI diagnosable.
Set `missingMessage` to `empty` or `throw`, and use `onError` in Vanilla/React
instances to report structured `TranslifyRuntimeError` values.

## Integration status

| Environment                     | Status                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| Vanilla JavaScript / TypeScript | Supported                                                          |
| React 18 and 19                 | Supported                                                          |
| Next.js App Router, RSC and SSG | Supported                                                          |
| Vite zero-config adapter        | Coming soon; the Vanilla and React runtimes already work with Vite |
| Angular                         | Coming soon                                                        |
| Symfony                         | Coming soon                                                        |
| Laravel / PHP                   | Coming soon                                                        |

Vue, Svelte and other framework adapters can build on the same observable
Vanilla instance without duplicating ICU or fallback logic.
