import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dream OS',
  description: 'Personal project management OS',
}

export const viewport: Viewport = {
  themeColor: '#2E1A0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Outfit', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
