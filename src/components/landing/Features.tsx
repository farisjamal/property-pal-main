import { Search, Calendar, Key, Shield, Bell, CheckCircle } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const steps = [
  {
    icon: Search,
    title: "Browse Properties",
    description: "Explore a wide range of available rental properties with high-resolution photos and details.",
    number: "1",
    color: "text-blue-500",
  },
  {
    icon: Calendar,
    title: "Easy Scheduling",
    description: "Book property viewings at your own convenience with our intuitive smart calendar system.",
    number: "2",
    color: "text-amber-500",
  },
  {
    icon: Key,
    title: "Visit & Secure",
    description: "Meet the owner, inspect the property in person, and seamlessly finalize your move-in.",
    number: "3",
    color: "text-emerald-500",
  }
];

const miniFeatures = [
  { icon: Shield, title: "Secure Platform", description: "Enterprise-grade data security." },
  { icon: Bell, title: "Instant Alerts", description: "Get real-time booking updates." },
  { icon: CheckCircle, title: "Verified Listings", description: "100% owner-verified properties." }
];

const Features = () => {
  return (
    <section id="features" className="py-32 relative overflow-hidden bg-background/50">
      {/* Decorative blurring to give the glass a deep premium feel */}
      <div className="absolute top-1/4 right-[10%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      
      <div className="container px-4 relative z-10">
        
        {/* Section Header */}
        <ScrollReveal className="text-center max-w-3xl mx-auto mb-28">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/20 dark:border-white/10 mb-8 shadow-sm">
            <Search className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold tracking-wide text-foreground">SEAMLESS PROCESS</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black mb-8 tracking-tight text-foreground">
            How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Works</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-light">
            We've simplified the entire property search journey. Discover top rentals, book viewings, and secure your dream home in three effortless steps.
          </p>
        </ScrollReveal>

        {/* The 3 Steps Timeline Layout */}
        <div className="grid md:grid-cols-3 gap-12 relative mb-24 max-w-6xl mx-auto">
          {/* Connecting line - only visible on md and up */}
          <ScrollReveal delay={300} animation="fade-in" duration={1000} className="hidden md:block absolute top-[4.5rem] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-border to-transparent -z-10" />

          {steps.map((step, index) => (
            <ScrollReveal key={index} delay={index * 200} className="relative flex flex-col items-center group text-center px-4">
              
              {/* Massive Background Step Number */}
              <div className="absolute top-[-3rem] md:top-[-4rem] left-1/2 -translate-x-1/2 text-[10rem] md:text-[14rem] font-black text-foreground/[0.03] dark:text-foreground/[0.02] -z-20 select-none group-hover:scale-105 transition-transform duration-700 pointer-events-none tracking-tighter">
                {step.number}
              </div>
              
              {/* Floating Icon Container */}
              <div className="relative w-28 h-28 rounded-full bg-background flex items-center justify-center border border-border/50 shadow-2xl mb-8 group-hover:-translate-y-2 transition-all duration-500 z-10">
                {/* Glowing ring effect */}
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 bg-primary" />
                <div className="w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center bg-background/50 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-inner">
                  <step.icon className={`w-8 h-8 ${step.color} drop-shadow-md`} />
                </div>
              </div>

              {/* Step Content */}
              <h3 className="text-2xl font-bold mb-4 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-base">
                {step.description}
              </p>
            </ScrollReveal>
          ))}
        </div>

        {/* Secondary Features - Liquid Glass Mini Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {miniFeatures.map((feat, index) => (
            <ScrollReveal key={index} delay={index * 150 + 200} className="h-full">
              <div 
                className="h-full group flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-5 p-6 rounded-3xl bg-background/30 dark:bg-background/10 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:-translate-y-1 transition-transform duration-300 ring-1 ring-inset ring-white/10"
              >
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner group-hover:scale-105 transition-transform">
                  <feat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="mt-2 md:mt-0">
                  <h4 className="font-bold text-lg text-foreground mb-1">{feat.title}</h4>
                  <p className="text-sm text-muted-foreground whitespace-normal md:whitespace-nowrap">{feat.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;
