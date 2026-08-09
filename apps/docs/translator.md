---
title: Browser Translator
description:
  Translate with OpenRouter directly from your browser, without a Translify
  server.
sidebar: false
aside: false
editLink: false
lastUpdated: false
footer: false
pageClass: translator-page
---

<ClientOnly>
  <BrowserTranslator />
</ClientOnly>

The playground starts with `deepseek/deepseek-v4-flash`, Translify's recommended
low-cost OpenRouter model. You can replace the slug with any model available to
your OpenRouter account.

The language selectors reuse Translify's complete bundled language registry.
They show each language's native name, international name, and code while
sending an unambiguous language name to the translation provider.

## How the serverless version works

GitHub Pages only hosts the static HTML, CSS and JavaScript. The browser sends
the request directly to OpenRouter's OpenAI-compatible chat completion endpoint,
which supports browser `fetch` requests and returns token and cost usage with
the response.

- Create a dedicated key from
  [OpenRouter Keys](https://openrouter.ai/settings/keys).
- Add a
  [budget or model guardrail](https://openrouter.ai/docs/guides/features/guardrails/overview)
  before using it in a browser.
- Leave **Remember this key** disabled to keep the key only in the current tab's
  memory.
- If persistence is enabled, **Forget key** deletes the IndexedDB entry
  immediately.

An IndexedDB key is not encrypted or protected from JavaScript running on the
same origin. A malicious browser extension, an XSS issue, or a compromised site
dependency could read it. Use a separate restricted key with a small spending
limit, never a primary unrestricted key.

The hosted page cannot read or update files on your computer. Project catalogue
editing therefore remains available only through the local
[`translify studio`](./commands/studio) server.
