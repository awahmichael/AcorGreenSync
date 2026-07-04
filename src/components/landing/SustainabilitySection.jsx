import React from "react";
import { Leaf, BarChart3, Target } from "lucide-react";

export default function SustainabilitySection() {
  return (
    <section id="sustainability" className="py-20 bg-gradient-to-b from-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold mb-4">
              <Leaf className="w-3 h-3" />
              Net Zero Built In
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Carbon Tracking That Doesn't Slow You Down.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              Every product in your catalog is automatically mapped to DEFRA emission factors using our AI-powered UPC-first lookup pipeline. Your cashiers scan, your customers pay, and your compliance team gets perfect data — automatically.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Scope 3 Ready:</span> Category 1 (Purchased Goods) and Category 11 (Use of Sold Products) tracked per transaction.</p>
              </div>
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Net Zero Targets:</span> Set reduction goals and track progress in real-time against your live transaction data.</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-xl">
            <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80" alt="Sustainable retail dashboard" className="w-full h-[400px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-green-900/40 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}