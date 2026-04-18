import { Building2, MapPin, Bed, Bath, Square, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const FeaturedProperties = () => {
  const { data: properties, isLoading } = useQuery({
    queryKey: ['featured-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property')
        .select('*')
        .limit(3)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <section id="properties" className="py-24 relative">
      {/* Optional decorative blobs to make glass pop if on a light background */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-primary/20 rounded-full blur-[100px] -z-10 opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-accent/20 rounded-full blur-[120px] -z-10 opacity-50 pointer-events-none" />

      <div className="container px-4 relative z-10">
        {/* Section header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Featured <span className="text-primary">Properties</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Explore our handpicked selection of quality rental properties available for viewing.
            </p>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="backdrop-blur-md bg-background/50 border-border/50">
              View All Properties
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </ScrollReveal>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!properties || properties.length === 0) && (
          <ScrollReveal className="text-center py-12 text-muted-foreground">
            No properties found. Check back soon!
          </ScrollReveal>
        )}

        {/* Properties grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties?.map((property, index) => (
            <ScrollReveal key={property.property_id} delay={index * 150} className="h-full">
              <div
                className="group relative h-full bg-background/20 dark:bg-background/10 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2rem] overflow-hidden hover:-translate-y-2 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/20 flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50 pointer-events-none" />
                
                {/* Image */}
                <div className="relative h-56 overflow-hidden shrink-0">
                  {property.images && property.images.length > 0 ? (
                    <img
                      src={property.images[0]}
                      alt={property.property_type}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground">
                      <Building2 className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  
                  {/* Image Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60 pointer-events-none" />

                  <Badge
                    className={`absolute top-4 left-4 backdrop-blur-md border border-white/20 shadow-sm ${property.availability_status === "Available"
                        ? "bg-accent/80 text-accent-foreground"
                        : "bg-property-warm/80 text-primary-foreground"
                      }`}
                  >
                    {property.availability_status || 'Unknown'}
                  </Badge>
                  
                  <div className="absolute top-4 right-4 bg-background/60 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-1.5 shadow-sm">
                    <span className="font-bold text-foreground">RM {property.rental_price}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 relative z-10 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-muted-foreground mb-3">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{property.property_type}</span>
                  </div>

                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-1">
                    {property.property_type} in {property.location.split(",")[0]}
                  </h3>

                  <div className="flex items-center gap-2 text-muted-foreground mb-5">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm line-clamp-1">{property.location}</span>
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-5 pt-5 border-t border-border/40 mt-auto">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Bed className="w-4 h-4 text-muted-foreground" />
                      <span>{property.num_bedroom} Beds</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Bath className="w-4 h-4 text-muted-foreground" />
                      <span>{property.num_bathroom} Baths</span>
                    </div>
                    {property.property_size && (
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Square className="w-4 h-4 text-muted-foreground" />
                        <span>{property.property_size} sqft</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link to="/auth" className="block mt-6">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-11 shadow-md hover:shadow-lg transition-all">
                      Book Viewing
                    </Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProperties;
