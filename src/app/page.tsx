import { AppShowcase } from "@/components/landing/app-showcase"
import { BackToTop } from "@/components/ui/back-to-top"
import { CategoryMarquee } from "@/components/landing/category-marquee"
import { ClientsSection } from "@/components/landing/clients-section"
import { ClosingCta } from "@/components/landing/closing-cta"
import { ContactSection } from "@/components/landing/contact-section"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { ProfessionalsSection } from "@/components/landing/professionals-section"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { StatsBand } from "@/components/landing/stats-band"
import { TerminalsSection } from "@/components/landing/terminals-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"

export default function Home() {
  return (
    <div className="grain bg-ink text-cream relative min-h-dvh overflow-x-hidden">
      <SiteHeader />
      <main id="main">
        <Hero />
        <CategoryMarquee />
        <ClientsSection />
        <ProfessionalsSection />
        <AppShowcase />
        <HowItWorks />
        <StatsBand />
        <TerminalsSection />
        <TestimonialsSection />
        <ClosingCta />
        <ContactSection />
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  )
}
