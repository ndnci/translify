'use client';

import { useLocale, useTranslations } from '@ndnci/translify/react';

export function ClientLocale() {
  const locale = useLocale();
  const t = useTranslations('nav');

  return (
    <p>
      {t('home')} · {locale}
    </p>
  );
}
