import { createComponent, createContext, createSignal, onCleanup, useContext } from 'solid-js';
import type { Accessor, ParentComponent } from 'solid-js';
import { createTrackedTranslator } from './adapter.js';
import type { I18n, MessageTree, Translator } from './types.js';

export interface SolidTranslify<Messages extends MessageTree = MessageTree> {
  readonly i18n: I18n<Messages>;
  readonly locale: Accessor<string>;
  readonly t: Translator<MessageTree>;
  getTranslations(namespace?: string): Translator<MessageTree>;
  destroy(): void;
}

const TranslifyContext = createContext<SolidTranslify<MessageTree>>();

export function createSolidI18n<Messages extends MessageTree>(
  i18n: I18n<Messages>,
): SolidTranslify<Messages> {
  const [revision, setRevision] = createSignal(i18n.revision);
  const stop = i18n.subscribe(() => setRevision(i18n.revision));
  const track = () => void revision();
  const state: SolidTranslify<Messages> = {
    i18n,
    locale: () => {
      track();
      return i18n.locale;
    },
    t: createTrackedTranslator(i18n, track),
    getTranslations: (namespace?: string) => createTrackedTranslator(i18n, track, namespace),
    destroy: stop,
  };
  onCleanup(stop);
  return state;
}

export const TranslifyProvider: ParentComponent<{ i18n: I18n<MessageTree> }> = (props) => {
  const state = createSolidI18n(props.i18n);
  return createComponent(TranslifyContext.Provider, {
    value: state,
    get children() {
      return props.children;
    },
  });
};

export function useI18n<Messages extends MessageTree = MessageTree>(): SolidTranslify<Messages> {
  const state = useContext(TranslifyContext);
  if (!state) throw new Error('Translify primitives require <TranslifyProvider>.');
  return state as SolidTranslify<Messages>;
}

export function useTranslations(namespace?: string): Translator<MessageTree> {
  return useI18n().getTranslations(namespace);
}

export type { I18n, MessageTree, Translator } from './types.js';
