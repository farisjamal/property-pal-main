import { ArrowRight, Shield, Calendar, MapPin, CheckCircle, Search, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroBackground from "@/assets/hero-background.jpg";

interface FeaturedProperty {
  property_id: number;
  property_type: string;
  location: string;
  rental_price: number;
  images: string[] | null;
}

const Hero = () => {
  const [featuredProperty, setFeaturedProperty] = useState<FeaturedProperty | null>(null);

  useEffect(() => {
    const fetchFeaturedProperty = async () => {
      const { data } = await supabase
        .from("property")
        .select("property_id, property_type, location, rental_price, images")
        .eq("availability_status", "Available")
        .not("images", "is", null)
        .limit(1)
        .single();

      if (data && data.images && data.images.length > 0) {
        setFeaturedProperty(data);
      }
    };

    fetchFeaturedProperty();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
      </div>

      {/* ── Liquid glass layer ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Blob 1 — large warm amber, top-left */}
        <div
          className="absolute rounded-full blur-[90px] opacity-55 mix-blend-overlay"
          style={{
            width: 'clamp(340px, 50vw, 680px)',
            height: 'clamp(340px, 50vw, 680px)',
            top: '-12%',
            left: '-8%',
            background: 'radial-gradient(circle at 40% 40%, hsl(25 95% 68%) 0%, hsl(20 90% 55% / 0.55) 40%, transparent 70%)',
            animation: 'liquid-drift 14s ease-in-out infinite alternate',
          }}
        />
        {/* Blob 2 — golden-white highlight, right */}
        <div
          className="absolute rounded-full blur-[70px] opacity-40 mix-blend-overlay"
          style={{
            width: 'clamp(220px, 35vw, 480px)',
            height: 'clamp(220px, 35vw, 480px)',
            top: '15%',
            right: '-4%',
            background: 'radial-gradient(circle at 55% 35%, hsl(45 100% 88%) 0%, hsl(35 90% 72% / 0.6) 45%, transparent 72%)',
            animation: 'liquid-drift 18s ease-in-out infinite alternate-reverse',
          }}
        />
        {/* Blob 3 — cool blue-teal refraction, bottom center */}
        <div
          className="absolute rounded-full blur-[80px] opacity-30 mix-blend-overlay"
          style={{
            width: 'clamp(200px, 30vw, 420px)',
            height: 'clamp(200px, 30vw, 420px)',
            bottom: '5%',
            left: '35%',
            background: 'radial-gradient(circle, hsl(195 80% 72%) 0%, hsl(210 70% 60% / 0.45) 50%, transparent 72%)',
            animation: 'liquid-drift 22s ease-in-out infinite alternate',
            animationDelay: '4s',
          }}
        />
        {/* Blob 4 — iridescent white refraction, center */}
        <div
          className="absolute rounded-full blur-[50px] opacity-35 mix-blend-overlay"
          style={{
            width: 'clamp(150px, 22vw, 320px)',
            height: 'clamp(150px, 22vw, 320px)',
            top: '30%',
            left: '28%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,240,220,0.5) 40%, transparent 70%)',
            animation: 'liquid-drift 16s ease-in-out infinite alternate-reverse',
            animationDelay: '2s',
          }}
        />
        {/* Blob 5 — deep rose accent, bottom-left */}
        <div
          className="absolute rounded-full blur-[100px] opacity-25 mix-blend-overlay"
          style={{
            width: 'clamp(180px, 28vw, 380px)',
            height: 'clamp(180px, 28vw, 380px)',
            bottom: '-5%',
            left: '-5%',
            background: 'radial-gradient(circle, hsl(15 85% 62%) 0%, hsl(340 70% 55% / 0.4) 50%, transparent 72%)',
            animation: 'liquid-drift 20s ease-in-out infinite alternate',
            animationDelay: '7s',
          }}
        />
      </div>

      {/* Inline keyframes for liquid blob drift */}
      <style>{`
        @keyframes liquid-drift {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(3%, 4%) scale(1.04); }
          66%  { transform: translate(-2%, 2%) scale(0.97); }
          100% { transform: translate(4%, -3%) scale(1.06); }
        }
      `}</style>

      <div className="container relative z-10 px-4 py-28">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-20 items-center min-h-[calc(100vh-9rem)]">

          {/* Left: Editorial headline block */}
          <div className="space-y-9">
            {/* Platform label */}
            <div className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="h-px w-8 bg-primary shrink-0" />
              <span className="section-label">Malaysia's Premier Property Platform</span>
            </div>

            {/* Giant editorial headline */}
            <div className="space-y-1 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <p className="text-xl md:text-2xl font-light text-muted-foreground tracking-wide">
                Find Your Perfect
              </p>
              <h1 className="font-display font-light text-[clamp(5rem,11vw,9.5rem)] leading-[0.88] tracking-[-0.04em] text-foreground">
                Home
              </h1>
              <p className="font-display italic text-2xl md:text-3xl text-primary font-light">
                starts right here.
              </p>
            </div>

            {/* Description */}
            <p
              className="text-base md:text-lg text-muted-foreground max-w-[26rem] leading-relaxed animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              Browse curated rental properties across Malaysia. Schedule viewings instantly,
              connect with verified owners, and manage everything from one secure platform.
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <Link to="/auth">
                <Button size="lg" className="bg-primary hover:bg-primary/90 px-8 h-12 font-medium text-base">
                  <Search className="mr-2 w-4 h-4" />
                  Browse Properties
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 h-12 font-medium text-base border-2 hover:bg-muted/50"
                >
                  List Your Property
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>

          </div>

          {/* Right: Property showcase card */}
          <div
            className="hidden lg:block animate-fade-up"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="relative">
              {/* Main card */}
              <div className="bg-card/90 backdrop-blur-sm border border-border/60 rounded-3xl overflow-hidden shadow-2xl">
                {/* Property image */}
                <div className="h-64 overflow-hidden">
                  {featuredProperty?.images?.[0] ? (
                    <img
                      src={featuredProperty.images[0]}
                      alt={featuredProperty.property_type}
                      className="w-full h-full object-cover object-[center_65%] transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Home className="w-16 h-16 text-primary/25" />
                    </div>
                  )}
                </div>

                {/* Property details */}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-lg leading-tight">
                        {featuredProperty?.property_type || "Luxury Apartment"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{featuredProperty?.location || "Kuala Lumpur"}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-primary font-bold text-xl leading-tight">
                        RM {featuredProperty?.rental_price?.toLocaleString() || "2,500"}
                      </div>
                      <div className="text-xs text-muted-foreground">/month</div>
                    </div>
                  </div>

                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                    Available Now
                  </Badge>

                  <Link to="/auth">
                    <Button className="w-full bg-primary hover:bg-primary/90 font-medium">
                      <Calendar className="w-4 h-4 mr-2" />
                      Book a Viewing
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Floating: Appointment card */}
              <div className="absolute -left-10 top-1/3 bg-card border border-border/70 rounded-2xl p-4 shadow-xl animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Scheduled</p>
                    <p className="text-sm font-semibold">Tomorrow, 2:00 PM</p>
                  </div>
                </div>
              </div>

              {/* Floating: Verified badge */}
              <div
                className="absolute -right-6 bottom-44 bg-card border border-border/70 rounded-2xl px-4 py-3 shadow-xl animate-float"
                style={{ animationDelay: "1s" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold">Verified Owner</span>
                </div>
              </div>

              {/* Floating: Security badge */}
              <div
                className="absolute -left-6 bottom-16 bg-primary rounded-2xl px-4 py-2.5 shadow-xl animate-float"
                style={{ animationDelay: "0.5s" }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                  <span className="text-sm font-medium text-primary-foreground">Encrypted & Secure</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
