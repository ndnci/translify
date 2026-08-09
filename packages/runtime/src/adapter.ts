import type { I18n, MessageTree, TranslationValues, Translator } from './types.js';

/** Builds a translator whose calls register a read in a framework reactivity system. */
export function createTrackedTranslator<Messages extends MessageTree>(
  i18n: I18n<Messages>,
  track: () => void,
  namespace?: string,
): Translator<MessageTree> {
  const translator = (
    namespace ? i18n.getTranslator(namespace as never) : i18n.t
  ) as Translator<MessageTree>;
  const tracked = ((key: string, values?: TranslationValues) => {
    track();
    return translator(key, values);
  }) as Translator<MessageTree>;
  tracked.has = (key: string) => {
    track();
    return translator.has(key);
  };
  tracked.raw = (key: string) => {
    track();
    return translator.raw(key);
  };
  return tracked;
}
