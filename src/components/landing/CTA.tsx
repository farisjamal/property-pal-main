import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const benefits = [
  "Free to browse",
  "Instant booking",
  "Email confirmations",
];

const CTA = () => {
  return (
    <section className="py-32 relative">
      <div className="container px-4">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[3rem] bg-[#0A0F1C] border border-slate-800 dark:border-white/10 p-8 md:p-20 shadow-2xl flex flex-col items-center text-center">
            
            {/* Ambient Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-4xl">
              
              <ScrollReveal delay={100} animation="fade-up" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 self-center shadow-inner backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold tracking-wider text-slate-300">START YOUR JOURNEY</span>
              </ScrollReveal>
              
              <ScrollReveal delay={200} animation="fade-up">
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-8 tracking-tighter leading-[1.1]">
                  Ready to find your <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-500">next home?</span>
                </h2>
              </ScrollReveal>
              
              <ScrollReveal delay={300} animation="fade-up">
                <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
                  Join hundreds of tenants who have found their perfect rental property through our streamlined platform.
                </p>
              </ScrollReveal>

              {/* Benefits */}
              <ScrollReveal delay={400} animation="fade-up" className="flex flex-wrap justify-center gap-3 md:gap-6 mb-14">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3 text-slate-300 bg-white/5 px-5 py-2.5 rounded-full border border-white/5 backdrop-blur-sm shadow-sm transition-transform hover:-translate-y-1 cursor-default">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-sm md:text-base">{benefit}</span>
                  </div>
                ))}
              </ScrollReveal>

              {/* CTA buttons */}
              <ScrollReveal delay={500} animation="fade-up" className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 px-10 text-lg rounded-2xl shadow-[0_0_30px_rgba(234,88,12,0.25)] hover:shadow-[0_0_45px_rgba(234,88,12,0.4)] transition-all hover:-translate-y-1">
                    Start Browsing
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full bg-white/5 hover:bg-white/10 border-white/10 text-white hover:text-white font-bold h-14 px-10 text-lg rounded-2xl backdrop-blur-md transition-all hover:-translate-y-1">
                    List Your Property
                  </Button>
                </Link>
              </ScrollReveal>
              
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default CTA;
