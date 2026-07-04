import React from "react";
import { ArrowRight, TrendingDown, ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-b from-green-50 to-white">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1600&q=80')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/60 to-white" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
            The UK's First Carbon-Native POS
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
            The POS Built for the{" "}
            <span className="text-primary">Carbon-Constrained</span> Future.
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            AcorGreenSync unifies your point-of-sale, inventory, and emissions tracking into one audit-ready platform. Stay compliant. Stay profitable. Stay ahead of the regulation curve.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a href="https://climatepos.tech/register" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors text-sm">
              Start 14-Day Free Trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#lead-form" className="inline-flex items-center justify-center gap-2 border border-border bg-white text-foreground font-semibold px-6 py-3 rounded-lg hover:bg-accent transition-colors text-sm">
              Book a Demo
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              Cut reporting time by 80%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}