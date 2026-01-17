import { Calendar, Shield, Bell, Search, Clock, CheckCircle } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Browse Properties",
    description: "Explore a wide range of available rental properties with detailed descriptions and photos.",
  },
  {
    icon: Calendar,
    title: "Easy Scheduling",
    description: "Book property viewings at your convenience with our simple appointment system.",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Receive email confirmations and updates when your viewing is approved.",
  },
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Your data is protected with enterprise-grade security and authentication.",
  },
  {
    icon: Clock,
    title: "Quick Response",
    description: "Property owners respond to viewing requests promptly through our platform.",
  },
  {
    icon: CheckCircle,
    title: "Verified Listings",
    description: "All properties are verified by owners ensuring accurate and reliable information.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container px-4">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            How It{" "}
            <span className="text-gradient">Works</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Book property viewings in three simple steps. Browse, schedule, and visit your potential new home.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-8 rounded-2xl bg-card border border-border hover-lift cursor-default"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
