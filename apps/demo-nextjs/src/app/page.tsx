import { i18n } from '../i18n/request';
import { ClientLocale } from './client-locale';

export default async function HomePage() {
  const t = await i18n.getTranslations({ locale: 'en', namespace: 'home' });

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('cta')}</button>
      <ClientLocale />
    </main>
  );
}
