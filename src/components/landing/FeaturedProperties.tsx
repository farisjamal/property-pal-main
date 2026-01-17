import { Building2, MapPin, Bed, Bath, Square, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    <section id="properties" className="py-24">
      <div className="container px-4">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Featured <span className="text-primary">Properties</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Explore our handpicked selection of quality rental properties available for viewing.
            </p>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="hover-lift">
              View All Properties
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!properties || properties.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            No properties found. Check back soon!
          </div>
        )}

        {/* Properties grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties?.map((property, index) => (
            <div
              key={property.property_id}
              className="group bg-card rounded-2xl border border-border overflow-hidden hover-lift"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Image */}
              <div className="relative h-56 overflow-hidden bg-muted">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.property_type}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Building2 className="w-12 h-12 opacity-20" />
                  </div>
                )}
                <Badge
                  className={`absolute top-4 left-4 ${property.availability_status === "Available"
                      ? "bg-accent text-accent-foreground"
                      : "bg-property-warm text-primary-foreground"
                    }`}
                >
                  {property.availability_status || 'Unknown'}
                </Badge>
                <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="font-bold text-primary">RM {property.rental_price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">{property.property_type}</span>
                </div>

                <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {property.property_type} in {property.location.split(",")[0]}
                </h3>

                <div className="flex items-center gap-1 text-muted-foreground mb-4">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{property.location}</span>
                </div>

                {/* Features */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bed className="w-4 h-4" />
                    <span>{property.num_bedroom} Beds</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bath className="w-4 h-4" />
                    <span>{property.num_bathroom} Baths</span>
                  </div>
                  {property.property_size && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Square className="w-4 h-4" />
                      <span>{property.property_size} sqft</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Link to="/auth" className="block mt-6">
                  <Button className="w-full bg-gradient-primary hover:opacity-90">
                    Book Viewing
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProperties;
