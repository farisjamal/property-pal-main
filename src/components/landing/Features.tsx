import { Search, Calendar, Bell, Shield, Clock, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Browse Listings",
    description:
      "Explore a curated selection of verified rental properties with photos, pricing, and detailed specs.",
  },
  {
    number: "02",
    icon: Calendar,
    title: "Book a Viewing",
    description:
      "Pick your preferred date and time. Your request goes directly to the property owner for approval.",
  },
  {
    number: "03",
    icon: Bell,
    title: "Get Confirmed",
    description:
      "Receive instant email confirmation once the owner approves. Show up, explore, and decide.",
  },
];

const features = [
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Enterprise-grade encryption protects your data at every step.",
  },
  {
    icon: Clock,
    title: "Quick Response",
    description: "Property owners respond to viewing requests within 24 hours.",
  },
  {
    icon: CheckCircle,
    title: "Verified Listings",
    description: "All properties verified by registered owners for accuracy.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container px-4">
        {/* Section header */}
        <div className="max-w-2xl mb-16 animate-fade-up">
          <span className="section-label">Simple & Transparent</span>
          <h2 className="font-display font-light text-[clamp(2.5rem,6vw,5rem)] leading-[0.93] tracking-[-0.025em] mt-3 mb-5">
            How It{" "}
            <em className="text-primary not-italic">Works</em>
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Book property viewings in three simple steps. Browse, schedule, and visit your
            potential new home — no hassle, no guesswork.
          </p>
        </div>

        {/* 3-step process */}
        <div className="grid md:grid-cols-3 gap-0 mb-20">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-0 h-px bg-border z-0" />
              )}

              <div
                className="relative z-10 animate-fade-up p-6 md:pr-12"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step number */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-display text-5xl font-light text-border leading-none select-none">
                    {step.number}
                  </span>
                </div>

                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-14">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium px-2">
            Platform Highlights
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Feature cards grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-7 rounded-2xl bg-card border border-border/60 card-elevated animate-fade-up"
              style={{ animationDelay: `${(index + 3) * 0.1}s` }}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors duration-200">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
