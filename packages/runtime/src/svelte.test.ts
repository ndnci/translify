import { describe, expect, it, vi } from 'vitest';
import { createI18n } from './runtime.js';
import { createTranslifyStore } from './svelte.js';

describe('Svelte integration', () => {
  it('exposes the runtime as a Svelte-compatible reactive store', () => {
    const i18n = createI18n({
      locale: 'en',
      defaultLocale: 'en',
      messages: { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } },
    });
    const listener = vi.fn();
    const store = createTranslifyStore(i18n);
    const unsubscribe = store.subscribe(listener);

    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'en' }));
    i18n.setLocale('fr');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'fr' }));
    expect(store.t('hello')).toBe('Bonjour');

    unsubscribe();
  });
});
