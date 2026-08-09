import { defineConfig } from 'vitepress';
import { getCliVersion } from './lib/cli-version';

const cliVersion = getCliVersion();

export default defineConfig({
  title: 'Translify',
  description: 'Intelligent i18n CLI — extract, sync, detect, and translate your app',
  lang: 'en-US',
  base: '/translify/',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'Translify' }],
    ['meta', { name: 'og:description', content: 'Intelligent i18n CLI for modern web apps' }],
    ['meta', { name: 'og:image', content: 'https://ndnci.github.io/translify/logo.png' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Translify',

    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'Commands', link: '/commands/audit' },
      { text: 'Config', link: '/guide/configuration' },
      {
        text: `v${cliVersion}`,
        items: [
          { text: 'Changelog', link: 'https://github.com/ndnci/translify/releases' },
          {
            text: 'Contributing',
            link: 'https://github.com/ndnci/translify/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Quick Start', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Countries & Languages', link: '/guide/countries-and-languages' },
        ],
      },
      {
        text: 'CLI Commands',
        items: [
          { text: 'init', link: '/commands/init' },
          { text: 'config-upgrade', link: '/commands/config-upgrade' },
          { text: 'add-missing', link: '/commands/add-missing' },
          { text: 'add-languages', link: '/commands/add-languages' },
          { text: 'split-translations', link: '/commands/split-translations' },
          { text: 'audit-fix', link: '/commands/audit-fix' },
          { text: 'hardcoded-fix', link: '/commands/hardcoded-fix' },
          { text: 'translate', link: '/commands/translate' },
          { text: 'studio', link: '/commands/studio' },
          { text: 'check-config', link: '/commands/check-config' },
          { text: 'check-missing', link: '/commands/check-missing' },
          { text: 'check-unused', link: '/commands/check-unused' },
          { text: 'check-duplicates', link: '/commands/check-duplicates' },
          { text: 'check-consistency', link: '/commands/check-consistency' },
          { text: 'check-hardcoded', link: '/commands/check-hardcoded' },
          { text: 'optimize', link: '/commands/optimize' },
          { text: 'audit', link: '/commands/audit' },
          { text: 'version', link: '/commands/version' },
          { text: 'upgrade', link: '/commands/upgrade' },
        ],
      },
      {
        text: 'AI Providers',
        items: [
          { text: 'OpenAI', link: '/providers/openai' },
          { text: 'OpenRouter', link: '/providers/openrouter' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Architecture', link: '/contributing/architecture' },
          { text: 'Contributing Guide', link: '/contributing/guide' },
        ],
      },
    ],

    editLink: {
      pattern: 'https://github.com/ndnci/translify/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/ndnci/translify' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024–present Ahliman HUSEYNOV',
    },

    search: { provider: 'local' },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
});
