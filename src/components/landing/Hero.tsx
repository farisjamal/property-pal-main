import { ArrowRight, Shield, Calendar, MapPin, CheckCircle, Search, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
      backgroundImage: `url(${heroBackground})`
    }}>
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
      </div>

      <div className="container relative z-10 px-4 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-fade-up" style={{
            animationDelay: "0.1s"
          }}>
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Secure & Trusted Platform</span>
            </div>

            {/* Main heading */}
            <div className="space-y-2 animate-fade-up" style={{
            animationDelay: "0.2s"
          }}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">Property</h1>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary">
                Appointment System
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-lg text-muted-foreground max-w-lg animate-fade-up" style={{
            animationDelay: "0.3s"
          }}>
              Streamline your property viewings with our AI-powered scheduling system. Book appointments instantly, receive automatic notifications, and manage everything from one secure dashboard.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{
            animationDelay: "0.4s"
          }}>
              <Link to="/auth">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base">
                  <Search className="mr-2 w-5 h-5" />
                  Browse Properties
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="px-8 py-6 text-base hover-lift border-2">
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>

            {/* Stats */}
            
          </div>

          {/* Right Content - Property Card Preview */}
          <div className="hidden lg:block animate-fade-up" style={{
          animationDelay: "0.4s"
        }}>
            <div className="relative">
              {/* Main Property Card */}
              <div className="bg-card/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-border/50">
                {/* Property Image Placeholder */}
                {featuredProperty?.images && featuredProperty.images.length > 0 ? (
                  <div className="rounded-2xl h-48 mb-4 overflow-hidden">
                    <img 
                      src={featuredProperty.images[0]} 
                      alt={featuredProperty.property_type}
                      className="w-full h-full object-cover object-[center_65%]"
                    />
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl h-48 mb-4 flex items-center justify-center">
                    <div className="text-center">
                      <Home className="w-12 h-12 text-primary mx-auto mb-2" />
                      <span className="text-sm font-medium text-foreground">Featured Property</span>
                    </div>
                  </div>
                )}
                
                {/* Property Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-foreground">
                      {featuredProperty?.property_type || "Luxury Apartment"}
                    </h3>
                    <span className="text-primary font-bold">
                      RM {featuredProperty?.rental_price?.toLocaleString() || "2,500"}/mo
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{featuredProperty?.location || "Kuala Lumpur"}</span>
                  </div>
                </div>
              </div>

              {/* Floating Appointment Card */}
              <div className="absolute -left-8 top-1/4 bg-card rounded-xl p-4 shadow-lg border border-border/50 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next Appointment</p>
                    <p className="text-sm font-medium text-foreground">Tomorrow, 2 PM</p>
                  </div>
                </div>
              </div>

              {/* Floating Verified Badge */}
              <div className="absolute -right-4 bottom-1/4 bg-card rounded-xl px-4 py-3 shadow-lg border border-border/50 animate-float" style={{
              animationDelay: "1s"
            }}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">Verified Owner</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default Hero;