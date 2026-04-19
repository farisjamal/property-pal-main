import { ArrowRight, Shield, Calendar, MapPin, CheckCircle, Search, Home, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
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
        .from('property')
        .select('property_id, property_type, location, rental_price, images')
        .eq('availability_status', 'Available')
        .not('images', 'is', null)
        .limit(1)
        .single();
      
      if (data && data.images && data.images.length > 0) {
        setFeaturedProperty(data);
      }
    };

    fetchFeaturedProperty();
  }, []);

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-36 pb-16 lg:pt-40 lg:pb-0">
      
      {/* Immersive Background System */}
      <div className="absolute inset-0 bg-background/70 dark:bg-background/90 z-0" />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 mix-blend-multiply dark:opacity-30 dark:mix-blend-overlay z-0"
        style={{ backgroundImage: `url(${heroBackground})` }}
      />

      {/* Animated Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] min-w-[500px] min-h-[500px] bg-primary/30 dark:bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse z-0" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] min-w-[600px] min-h-[600px] bg-accent/40 dark:bg-accent/20 rounded-full blur-[150px] pointer-events-none z-0" />

      <div className="container relative z-10 px-4 py-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* Left Content */}
          <div className="space-y-8 mt-8 lg:mt-0 flex flex-col justify-center text-center lg:text-left items-center lg:items-start">
            
            {/* Main heading */}
            <ScrollReveal delay={100} animation="fade-up">
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.15] mb-2">
                Smart Property{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-500 pb-2 drop-shadow-sm inline-block mt-2">
                  Appointments
                </span>
              </h1>
            </ScrollReveal>

            {/* Subtitle */}
            <ScrollReveal delay={300} animation="fade-up">
              <p className="text-lg md:text-xl xl:text-2xl text-muted-foreground max-w-xl font-light leading-relaxed mx-auto lg:mx-0">
                Streamline your property viewings with our elite AI scheduling system. Book instantly and manage everything from one secure dashboard.
              </p>
            </ScrollReveal>

            {/* CTA buttons */}
            <ScrollReveal delay={400} animation="fade-up" className="w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center lg:justify-start">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 px-8 text-base md:text-lg rounded-2xl shadow-[0_0_30px_rgba(234,88,12,0.3)] hover:shadow-[0_0_40px_rgba(234,88,12,0.5)] transition-all hover:-translate-y-1">
                    <Search className="mr-2 w-5 h-5" />
                    Browse Properties
                  </Button>
                </Link>
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full bg-background/50 border-2 border-border text-foreground hover:bg-accent hover:text-accent-foreground h-14 px-8 text-base md:text-lg rounded-2xl font-bold backdrop-blur-md hover:-translate-y-1 transition-all shadow-sm">
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            {/* Social Proof */}
            <ScrollReveal delay={500} animation="fade-up">
              <div className="flex items-center gap-4 mt-4 bg-background/30 dark:bg-background/10 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl p-4 shadow-sm w-max mx-auto lg:mx-0">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-background overflow-hidden bg-muted">
                       <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 15}&backgroundColor=e2e8f0`} alt="user" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col">
                   <div className="flex text-amber-500 gap-0.5">
                       {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current"/>)}
                   </div>
                   <span className="text-xs font-semibold text-foreground mt-0.5 text-left">Over 2,000+ Happy Renters</span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Content - Floating Property Card */}
          <ScrollReveal delay={600} animation="fade-up" className="hidden lg:block relative perspective-1000 z-10 xl:ml-10">
            <div className="relative hover:-translate-y-4 hover:rotate-1 transition-all duration-700 ease-out">
              
              {/* Main Liquid Glass Property Card */}
              <div className="bg-background/20 dark:bg-background/10 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[3rem] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/20 relative z-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                {/* Property Image Placeholder */}
                {featuredProperty?.images && featuredProperty.images.length > 0 ? (
                  <div className="rounded-[2rem] h-72 mb-6 overflow-hidden shadow-inner relative group">
                    <img 
                      src={featuredProperty.images[0]} 
                      alt={featuredProperty.property_type}
                      className="w-full h-full object-cover object-[center_65%] group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 bg-background/60 backdrop-blur-xl border border-white/20 text-foreground px-3 py-1.5 rounded-xl text-sm font-bold shadow-lg">
                      RM {featuredProperty?.rental_price?.toLocaleString() || "2,500"}/mo
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-primary/20 to-accent/10 rounded-[2rem] h-72 mb-6 flex items-center justify-center shadow-inner relative border border-white/10 dark:border-white/5">
                    <div className="text-center">
                      <Home className="w-16 h-16 text-primary/50 mx-auto mb-3" />
                      <span className="text-sm font-semibold text-foreground/70 uppercase tracking-widest">Featured Property</span>
                    </div>
                  </div>
                )}
                
                {/* Property Details */}
                <div className="space-y-4 relative z-10 px-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-extrabold text-2xl text-foreground leading-tight line-clamp-2">
                      {featuredProperty?.property_type || "Luxury Modern Apartment"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground font-medium bg-background/40 w-max px-3 py-1.5 rounded-lg border border-white/10">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm">{featuredProperty?.location || "Kuala Lumpur, Malaysia"}</span>
                  </div>
                </div>
              </div>

              {/* Floating Appointment Card */}
              <div className="absolute -left-8 md:-left-12 top-[20%] -translate-y-1/2 z-30">
                <div className="bg-background/40 dark:bg-background/30 backdrop-blur-3xl rounded-2xl p-4.5 shadow-[0_15px_35px_rgba(0,0,0,0.2)] border border-white/50 dark:border-white/20 ring-1 ring-inset ring-white/40 animate-float">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div className="pr-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Next Viewing</p>
                      <p className="text-base font-black text-foreground">Tomorrow, 2 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Verified Badge */}
              <div className="absolute -right-6 md:-right-8 top-[80%] md:top-[60%] -translate-y-1/2 z-30">
                <div className="bg-background/40 dark:bg-background/30 backdrop-blur-3xl rounded-2xl px-6 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.2)] border border-white/50 dark:border-white/20 ring-1 ring-inset ring-white/40 animate-float" style={{ animationDelay: "1.5s" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <span className="text-sm font-black text-foreground tracking-wide">Verified Owner</span>
                  </div>
                </div>
              </div>
              
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};

export default Hero;