import { describe, expect, it } from 'vitest';
import { createI18n } from './runtime.js';
import { createVueI18n } from './vue.js';

describe('Vue integration', () => {
  it('installs one reactive adapter and global translation function', () => {
    const i18n = createI18n({
      locale: 'en',
      defaultLocale: 'en',
      messages: { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } },
    });
    const provided = new Map<unknown, unknown>();
    const app = {
      config: { globalProperties: {} as Record<string, unknown> },
      provide: (key: unknown, value: unknown) => provided.set(key, value),
      onUnmount: () => undefined,
    };

    const plugin = createVueI18n(i18n);
    plugin.install!(app as never);
    const state = plugin.state;

    expect(state.t('hello')).toBe('Hello');
    expect(state.locale.value).toBe('en');
    expect(app.config.globalProperties.$t).toBe(state.t);

    i18n.setLocale('fr');
    expect(state.locale.value).toBe('fr');
    expect(state.t('hello')).toBe('Bonjour');
  });
});
