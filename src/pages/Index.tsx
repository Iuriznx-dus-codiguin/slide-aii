import { MotionConfig } from "framer-motion";
import "@/components/landing/landing.css";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { UseCases } from "@/components/landing/UseCases";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { LANDING_FAQS } from "@/components/landing/faqContent";
import {
  HOME_DESCRIPTION, HOME_TITLE, SITE_URL, WEBSITE_ID, jsonLdGraph, organizationJsonLd, softwareApplicationJsonLd, websiteJsonLd,
} from "@/lib/seo";

// Dados estruturados da home: a marca (Organization), o site (WebSite), o
// produto com os preços reais (SoftwareApplication) e o FAQ visível na página.
const HOME_JSON_LD = [
  jsonLdGraph(organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()),
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    inLanguage: "pt-BR",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: LANDING_FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

const Index = () => {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
    <div className="landing-page min-h-screen bg-background">
      <Seo title={HOME_TITLE} description={HOME_DESCRIPTION} path="/" jsonLd={HOME_JSON_LD} />
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <UseCases />
        <Pricing />
        <CTA />
        <FAQ />
      </main>
      <Footer />
    </div>
    </MotionConfig>
  );
};

export default Index;
