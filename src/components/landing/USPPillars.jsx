import React from "react";
import { FileCheck2, Gauge, Building2 } from "lucide-react";

const PILLARS = [
  {
    icon: FileCheck2,
    title: "Audit-Ready Compliance",
    desc: "DEFRA-aligned emissions tracking with immutable audit trails. Built for HMRC MTD, SECR, and Streamlined Energy & Carbon Reporting. Every transaction is a compliant record.",
  },
  {
    icon: Gauge,
    title: "Real-Time Carbon Intelligence",
    desc: "Every sale automatically calculates its carbon footprint using our UPC-first emission factor mapping. No spreadsheets. No manual data entry. No guesswork.",
  },
  {
    icon: Building2,
    title: "Multi-Store Mastery",
    desc: "Manage unlimited locations, stock counts, and full P&L from a single dashboard. Scale your retail operation without scaling your admin overhead.",
  },
];

export default function USPPillars() {
  return (
    <section id="platform" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            One Platform. Zero Compromise.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Stop juggling disconnected tools. AcorGreenSync brings your retail operations and sustainability reporting under one roof.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="p-8 rounded-2xl border border-border bg-gradient-to-b from-green-50/40 to-white hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <pillar.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}