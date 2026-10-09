"use client"

import { useTranslation } from "react-i18next"

import { ContactForm } from "@/components/landing/contact-form"
import { Icon, type IconProps } from "@/components/ui/icon"
import { Reveal } from "@/components/ui/reveal"
import { SITE } from "@/constants/site"

interface ContactInfoItem {
  icon: IconProps["name"]
  label: string
  value: string
  href?: string
  external?: boolean
}

/** Landing section with contact details and the validated message form. */
export function ContactSection() {
  const { t } = useTranslation()

  const contactInfo: ContactInfoItem[] = [
    {
      icon: "mail",
      label: t("landing.contact.emailLabel"),
      value: SITE.email,
      href: `mailto:${SITE.email}`,
    },
    {
      icon: "phone",
      label: t("landing.contact.phoneLabel"),
      value: SITE.phone,
      href: `tel:${SITE.phone.replace(/[^+\d]/g, "")}`,
    },
    {
      icon: "clock",
      label: t("landing.contact.hoursLabel"),
      value: t("landing.contact.hours"),
    },
    {
      icon: "map-pin",
      label: t("landing.contact.addressLabel"),
      value: t("landing.contact.address"),
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        t("landing.contact.address"),
      )}`,
      external: true,
    },
  ]

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-title"
      className="relative scroll-mt-24 px-5 py-24 md:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(55,10,91,0.32),transparent_56%)]"
      />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-gold font-display text-xs tracking-[0.28em] uppercase">
            {t("landing.contact.eyebrow")}
          </p>
          <h2
            id="contacto-title"
            className="font-display mt-4 text-4xl leading-tight font-semibold md:text-5xl"
          >
            {t("landing.contact.title")}
          </h2>
          <p className="text-cream/60 mt-5 max-w-xl leading-relaxed">
            {t("landing.contact.subtitle")}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Reveal delay={100} className="flex flex-col gap-4">
            {contactInfo.map((item) => (
              <div
                key={item.label}
                className="border-cream/10 bg-cream/3 flex flex-1 flex-col justify-center rounded-3xl border p-6"
              >
                <Icon name={item.icon} className="text-gold h-5 w-5" />
                <p className="text-cream/40 mt-3 text-xs tracking-[0.16em] uppercase">
                  {item.label}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    className="text-cream hover:text-gold mt-1 inline-block text-sm font-medium break-words transition"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-cream mt-1 text-sm font-medium">{item.value}</p>
                )}
              </div>
            ))}
          </Reveal>

          <Reveal delay={180}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
