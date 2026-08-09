import { describe, expect, it } from 'vitest';
import { createI18n } from './runtime.js';
import { createAngularI18n } from './angular.js';

describe('Angular integration', () => {
  it('bridges runtime updates to Angular signals', () => {
    const i18n = createI18n({
      locale: 'en',
      defaultLocale: 'en',
      messages: { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } },
    });
    const state = createAngularI18n(i18n);

    expect(state.locale()).toBe('en');
    expect(state.t('hello')).toBe('Hello');
    i18n.setLocale('fr');
    expect(state.locale()).toBe('fr');
    expect(state.t('hello')).toBe('Bonjour');
    state.destroy();
  });
});
