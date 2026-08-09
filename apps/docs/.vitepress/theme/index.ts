import DefaultTheme from 'vitepress/theme';
import BrowserTranslator from './components/BrowserTranslator.vue';
import type { Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BrowserTranslator', BrowserTranslator);
  },
} satisfies Theme;
