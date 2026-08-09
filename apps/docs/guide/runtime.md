# Application Runtime

Translify can be the translation runtime used by your application as well as the
CLI that maintains its catalogues. The same package supports Vanilla JavaScript,
React, Next.js, Vue, Svelte, Angular, and Solid without loading CLI code into
the browser.

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

Put browser catalogues and runtime defaults in the existing config:

```ts
// translify.config.ts
import en from './messages/en.json';
import fr from './messages/fr.json';

export default {
  translations: { default_language: 'en', files: ['messages/**/*.json'] },
  routing: { locales: ['en', 'fr'] },
  runtime: {
    locale: 'auto',
    messages: { en, fr },
    time_zone: 'Europe/Paris',
  },
} as const;
```

Application setup is then two imports and one call:

```ts
import { createI18n } from '@ndnci/translify/vanilla';
import config from '../translify.config';

export const i18n = createI18n(config);

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

Central config is the default. Local values override only the matching keys:

```ts
createI18n({ config, locale: 'fr' }); // Everything else still comes from config.
```

Set `useConfig: false` to create an intentionally standalone instance; in that
case pass `messages`, `defaultLocale`, and optionally `locale` locally.
`createI18nFromConfig` remains as a compatibility alias. A browser bundle must
import its config explicitly because it cannot safely discover project files at
runtime. Never import server API keys into a client bundle; keep a separate
browser-safe config or pass only `messages` when the main config contains
secrets.

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

## Vue and Nuxt

Install one plugin at application startup. It exposes the same state through
composables and, for concise templates, through `$t`.

```ts
import { createVueI18n } from '@ndnci/translify/vue';
import { i18n } from './i18n';

app.use(createVueI18n(i18n));
```

```vue
<script setup lang="ts">
import { useI18n } from '@ndnci/translify/vue';

const { locale, t } = useI18n();
</script>

<template>
  <h1 :lang="locale">{{ t('home.title') }}</h1>
</template>
```

Use the same installation line in a client plugin for Nuxt. For Nuxt SSR, create
the core instance inside the plugin so each request owns its locale state.

## Svelte and SvelteKit

Initialize context once in the root layout. The returned object follows the
Svelte store contract, so both `$translify.locale` and direct method calls are
reactive.

```svelte
<script lang="ts">
  import { setTranslifyContext } from '@ndnci/translify/svelte';
  import { i18n } from '$lib/i18n';

  const translify = setTranslifyContext(i18n);
</script>

<h1 lang={$translify.locale}>{$translify.t('home.title')}</h1>
<slot />
```

SvelteKit can create `i18n` from server-loaded messages in `+layout.server.ts`
and pass only the serializable locale and catalogues to the layout.

## Angular

Register the environment provider once, then inject the signal-backed adapter.

```ts
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideTranslify(i18n)],
};

// home.component.ts
export class HomeComponent {
  readonly translify = injectTranslify();
}
```

```html
<h1 [attr.lang]="translify.locale()">{{ translify.t('home.title') }}</h1>
```

The locale signal updates immediately after `i18n.setLocale()`. Angular SSR can
create one core instance in the request bootstrap providers, avoiding shared
mutable state.

## Solid and SolidStart

Wrap the application once and use the adapter's reactive primitives anywhere
below it.

```tsx
import { TranslifyProvider, useTranslations } from '@ndnci/translify/solid';

render(() => (
  <TranslifyProvider i18n={i18n}>
    <App />
  </TranslifyProvider>
));

function Title() {
  const t = useTranslations('home');
  return <h1>{t('title')}</h1>;
}
```

SolidStart should create the underlying instance per server request and pass it
to the provider during rendering.

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

## Node, serverless and API routes

The server entry discovers `translify.config.*` and every configured catalogue
from the project directory. It creates fresh state per call, so concurrent
requests cannot leak their locale into one another.

```ts
import { getServerTranslations } from '@ndnci/translify/server';

export async function GET(request: Request) {
  const t = await getServerTranslations({ request, namespace: 'api' });
  return Response.json({ message: t('welcome') });
}
```

Pass `locale` when it already comes from a trusted route parameter. Otherwise,
the standard Web `Request` is resolved using the localized URL, preference
cookie and `Accept-Language` behavior from `translify.config.ts`.

```ts
import { createServerI18n } from '@ndnci/translify/server';

const i18n = await createServerI18n({ locale: 'fr' });
const subject = i18n.t('email.subject', { name: customer.name });
```

The server entry is Node-only because it reads local JSON catalogues. Edge
runtimes should bundle messages and use the browser-safe `/vanilla` runtime;
both expose the same translation, namespace and formatting APIs.

## Missing messages and fallback

Fallback happens for each message in this order: exact locale (`fr-CA`), base
locale (`fr`), then `defaultLocale`. A fallback string is still formatted with
the active locale's plural/date rules.

The default missing-message result is the key, which keeps the UI diagnosable.
Set `missingMessage` to `empty` or `throw`, and use `onError` in Vanilla/React
instances to report structured `TranslifyRuntimeError` values.

## Integration status

| Environment                        | Status                              |
| ---------------------------------- | ----------------------------------- |
| Vanilla JavaScript / TypeScript    | Supported                           |
| React 18/19 and Next.js App Router | Supported, including RSC, SSR & SSG |
| Vue 3 and Nuxt                     | Supported                           |
| Svelte 4/5 and SvelteKit           | Supported                           |
| Angular 18+                        | Supported, including signals & SSR  |
| Solid and SolidStart               | Supported                           |
| Vite                               | Supported through client adapters   |
| Astro                              | Supported through `/server`         |
| Node.js, API routes and serverless | Supported                           |
| Symfony and Laravel / PHP runtimes | Planned                             |

Every adapter delegates to the same observable Vanilla core. Applications can
change framework without changing catalogue syntax or translation behavior.
