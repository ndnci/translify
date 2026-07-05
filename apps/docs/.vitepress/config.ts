import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Translify',
  description: 'Intelligent i18n CLI — extract, sync, detect, and translate your app',
  lang: 'en-US',
  base: '/translify/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'Translify' }],
    ['meta', { name: 'og:description', content: 'Intelligent i18n CLI for modern web apps' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Translify',

    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'Commands', link: '/commands/audit' },
      { text: 'Config', link: '/guide/configuration' },
      {
        text: 'v0.1.0',
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
        ],
      },
      {
        text: 'CLI Commands',
        items: [
          { text: 'init', link: '/commands/init' },
          { text: 'add-missing', link: '/commands/add-missing' },
          { text: 'translate', link: '/commands/translate' },
          { text: 'check-missing', link: '/commands/check-missing' },
          { text: 'check-unused', link: '/commands/check-unused' },
          { text: 'check-duplicates', link: '/commands/check-duplicates' },
          { text: 'check-consistency', link: '/commands/check-consistency' },
          { text: 'optimize', link: '/commands/optimize' },
          { text: 'audit', link: '/commands/audit' },
          { text: 'doctor', link: '/commands/doctor' },
          { text: 'upgrade', link: '/commands/upgrade' },
        ],
      },
      {
        text: 'AI Providers',
        items: [{ text: 'OpenAI', link: '/providers/openai' }],
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
