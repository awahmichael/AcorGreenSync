import React from "react";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import USPPillars from "@/components/landing/USPPillars";
import SustainabilitySection from "@/components/landing/SustainabilitySection";
import PricingSection from "@/components/landing/PricingSection";
import LeadCapture from "@/components/landing/LeadCapture";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <USPPillars />
        <SustainabilitySection />
        <PricingSection />
        <LeadCapture />
      </main>
      <Footer />
    </div>
  );
}