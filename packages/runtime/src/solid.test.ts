import { createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createI18n } from './runtime.js';
import { createSolidI18n } from './solid.js';

describe('Solid integration', () => {
  it('bridges runtime updates to Solid signals', () => {
    createRoot((dispose) => {
      const i18n = createI18n({
        locale: 'en',
        defaultLocale: 'en',
        messages: { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } },
      });
      const state = createSolidI18n(i18n);

      expect(state.locale()).toBe('en');
      expect(state.t('hello')).toBe('Hello');
      i18n.setLocale('fr');
      expect(state.locale()).toBe('fr');
      expect(state.t('hello')).toBe('Bonjour');
      dispose();
    });
  });
});
