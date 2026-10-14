import type { Metadata, Viewport } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'

import './globals.css'

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'Horários do Metrofor',
    template: '%s · Horários do Metrofor',
  },
  description:
    'Próximos trens, tabela de horários e mapa das linhas do Metrofor em Fortaleza, Sobral e Cariri.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e7e8e2' },
    { media: '(prefers-color-scheme: dark)', color: '#111315' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
