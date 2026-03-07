import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavigationHandler from '@/components/NavigationHandler'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'POS System',
  description: 'Point of Sale Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('dark_mode') === 'true') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <NavigationHandler />
        {children}
      </body>
    </html>
  )
}
