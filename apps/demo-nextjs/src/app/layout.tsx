import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { TranslifyProvider } from '@ndnci/translify/react';
import { i18n } from '../i18n/request';

export const metadata: Metadata = {
  title: 'Translify Demo',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const clientConfig = await i18n.getClientConfig('en');

  return (
    <html lang={clientConfig.locale}>
      <body>
        <TranslifyProvider {...clientConfig}>{children}</TranslifyProvider>
      </body>
    </html>
  );
}
