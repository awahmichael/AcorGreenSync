import React, { useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function LeadCapture() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", store_count: 1, message: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "store_count" ? parseInt(value) || 1 : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) { toast.error("Please enter your email address."); return; }
    setLoading(true);
    try {
      await base44.entities.Lead.create({ ...form, source: "acorgreensync.com" });
      toast.success("Thank you! Our team will reach out within 24 hours.");
      setForm({ name: "", email: "", company: "", phone: "", store_count: 1, message: "" });
    } catch (err) {
      toast.error("Something went wrong. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="lead-form" className="py-20 bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">See It In Action.</h2>
          <p className="mt-4 text-muted-foreground text-lg">Book a 15-minute demo. We'll show you how AcorGreenSync transforms your compliance workflow.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="jane@retail.co.uk" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                <input type="text" name="company" value={form.company} onChange={handleChange} className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Green Retail Ltd" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="+44 7700 900000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Number of Store Locations</label>
              <input type="number" name="store_count" value={form.store_count} onChange={handleChange} min="1" className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Message (optional)</label>
              <textarea name="message" value={form.message} onChange={handleChange} rows="3" className="w-full px-3 py-2 rounded-lg border border-input bg-transparent text-sm focus:ring-2 focus:ring-primary outline-none" placeholder="Tell us about your retail operation..." />
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Request Demo"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}