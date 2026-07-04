import React, { useState } from "react";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    monthly: 29,
    annual: 290,
    desc: "For single-location retailers getting started with carbon compliance.",
    features: ["1 store location", "Up to 5,000 SKUs", "DEFRA emissions mapping", "VAT & tax reports", "Basic P&L reporting", "Email support"],
    popular: false,
  },
  {
    name: "Growth",
    monthly: 79,
    annual: 790,
    desc: "For growing chains that need multi-store control and deeper reporting.",
    features: ["Up to 5 store locations", "Up to 25,000 SKUs", "Everything in Starter", "Multi-store P&L", "Stock count automation", "Promotion engine", "Priority support"],
    popular: true,
  },
  {
    name: "Enterprise",
    monthly: 199,
    annual: 1990,
    desc: "For large operators needing custom integrations and white-labeling.",
    features: ["Unlimited locations", "Unlimited SKUs", "Everything in Growth", "Custom BI integrations", "White-label options", "Dedicated account manager", "SLA & onboarding"],
    popular: false,
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Pricing That Scales With You.</h2>
          <p className="mt-4 text-muted-foreground text-lg">Per subscription, not per transaction. We never penalise you for growing.</p>

          <div className="inline-flex items-center gap-3 mt-6 p-1 rounded-lg bg-muted">
            <button onClick={() => setAnnual(false)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!annual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${annual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Annual <span className="text-primary">Save 17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`relative p-8 rounded-2xl border-2 ${plan.popular ? "border-primary bg-green-50/50" : "border-border bg-white"}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{plan.desc}</p>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-foreground">£{annual ? plan.annual : plan.monthly}</span>
                <span className="text-sm text-muted-foreground">/{annual ? "year" : "month"}</span>
              </div>

              <a href="https://climatepos.tech/register" className={`mt-6 block text-center font-semibold py-2.5 rounded-lg transition-colors text-sm ${plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border text-foreground hover:bg-accent"}`}>
                Start Free Trial
              </a>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}