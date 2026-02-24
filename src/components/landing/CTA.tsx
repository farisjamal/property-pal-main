import { ArrowRight, Check, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const benefits = ["Free to browse", "Instant booking", "Email confirmations", "Verified listings"];

const CTA = () => {
  return (
    <section className="py-24">
      <div className="container px-4">
        <div className="relative overflow-hidden rounded-3xl bg-mesh-dark p-12 md:p-16 lg:p-20">
          {/* Ambient glow accents */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/15 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-property-warm/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            {/* Label */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Home className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-semibold tracking-[0.22em] uppercase text-primary/80">
                Start Today
              </span>
            </div>

            {/* Heading */}
            <h2 className="font-display font-light text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] tracking-[-0.03em] text-white mb-6">
              Ready to find your
              <br />
              <em className="text-primary not-italic">perfect home?</em>
            </h2>

            <p className="text-lg text-white/60 mb-10 max-w-lg leading-relaxed">
              Join hundreds of tenants who've found their ideal rental through PropertyPal.
              It's free, fast, and fully secure.
            </p>

            {/* Benefits row */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 mb-10">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-white/80">
                  <div className="w-4 h-4 rounded-full bg-primary/25 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 font-medium text-base"
                >
                  Start Browsing
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="lg"
                  variant="ghost"
                  className="px-8 h-12 font-medium text-base text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
                >
                  List Your Property
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
