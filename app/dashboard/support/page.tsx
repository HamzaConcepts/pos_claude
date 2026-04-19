'use client'

import { LifebuoyIcon, WhatsappLogoIcon, EnvelopeSimpleIcon, GlobeIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'

const whatsappContacts = [
  {
    label: '0341 2115016',
    href: 'https://wa.me/923412115016',
  },
  {
    label: '0332 9351384',
    href: 'https://wa.me/923329351384',
  },
  {
    label: '0333 9161419',
    href: 'https://wa.me/923339161419',
  },
  {
    label: '0325 1541216',
    href: 'https://wa.me/923251541216',
  }
]

const supportEmail = 'theofficialhectagon@gmail.com'
const websiteUrl = 'https://www.thehectagon.com'

export default function SupportPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] dark:dark-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/20">
            <LifebuoyIcon size={22} className="text-cyan-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          If you face any issue while using the system, contact our development team through WhatsApp, email, or website.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2 mb-3">
            <WhatsappLogoIcon size={20} className="text-cyan-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">WhatsApp</h2>
          </div>
          <div className="space-y-2">
            {whatsappContacts.map((contact) => (
              <a
                key={contact.href}
                href={contact.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-[#1a1a1a]"
              >
                <span>{contact.label}</span>
                <ArrowSquareOutIcon size={16} className="text-gray-500" />
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2 mb-3">
            <EnvelopeSimpleIcon size={20} className="text-cyan-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Email</h2>
          </div>
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-[#1a1a1a]"
          >
            <span className="break-all">{supportEmail}</span>
            <ArrowSquareOutIcon size={16} className="text-gray-500 flex-shrink-0 ml-2" />
          </a>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2 mb-3">
            <GlobeIcon size={20} className="text-cyan-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Website</h2>
          </div>
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-[#1a1a1a]"
          >
            <span>www.thehectagon.com</span>
            <ArrowSquareOutIcon size={16} className="text-gray-500" />
          </a>
        </section>
      </div>
    </div>
  )
}
