import React from "react";
import { Leaf } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">AcorGreenSync</span>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-sm text-white/70">
            <a href="#platform" className="hover:text-white">Platform</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#sustainability" className="hover:text-white">Sustainability</a>
            <a href="https://climatepos.tech/login" className="hover:text-white">Sign In</a>
          </nav>

          <p className="text-sm text-white/50">© {new Date().getFullYear()} AcorCloud. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}