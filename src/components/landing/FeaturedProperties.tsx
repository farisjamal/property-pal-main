import { useState } from "react";
import { Building2, MapPin, Bed, Bath, Square, ArrowRight, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const propertyTypes = ["All", "Apartment", "House", "Condo", "Townhouse", "Studio"];

const FeaturedProperties = () => {
  const [activeType, setActiveType] = useState("All");

  const { data: allProperties, isLoading } = useQuery({
    queryKey: ["featured-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property")
        .select("*")
        .limit(9)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const properties = allProperties?.filter(
    (p) => activeType === "All" || p.property_type === activeType
  );

  return (
    <section id="properties" className="py-24 bg-secondary/10">
      <div className="container px-4">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="space-y-4">
            <span className="section-label">Curated Listings</span>
            <h2 className="font-display font-light text-[clamp(2.5rem,6vw,5rem)] leading-[0.93] tracking-[-0.025em] text-foreground">
              Featured{" "}
              <em className="text-primary not-italic">Properties</em>
            </h2>
            <p className="text-base text-muted-foreground max-w-md">
              Explore quality rental properties available for immediate viewing.
            </p>
          </div>
          <Link to="/auth" className="shrink-0">
            <Button variant="outline" className="font-medium border-2 hover:bg-muted/50">
              View All Properties
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-10">
          {propertyTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`pill ${activeType === type ? "pill-active" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!properties || properties.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No properties found. Check back soon!</p>
          </div>
        )}

        {/* Property grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties?.map((property, index) => (
            <div
              key={property.property_id}
              className="property-card group animate-fade-up"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              {/* Image */}
              <div className="relative h-56 overflow-hidden bg-muted">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.property_type}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Building2 className="w-12 h-12 text-muted-foreground/25" />
                  </div>
                )}

                {/* Status badge */}
                <Badge
                  className={`absolute top-3.5 left-3.5 text-xs font-medium ${
                    property.availability_status === "Available"
                      ? "bg-emerald-500/90 text-white border-0"
                      : "bg-orange-500/90 text-white border-0"
                  }`}
                >
                  {property.availability_status || "Unknown"}
                </Badge>

                {/* Price overlay */}
                <div className="absolute top-3.5 right-3.5 bg-card/92 backdrop-blur-sm rounded-xl px-3 py-1.5">
                  <span className="font-bold text-primary text-sm">
                    RM {property.rental_price?.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">/mo</span>
                </div>

                {/* Photo count */}
                {property.images && property.images.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/55 text-white text-xs px-2 py-1 rounded-lg font-medium">
                    +{property.images.length - 1} photos
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider font-medium">{property.property_type}</span>
                </div>

                <h3 className="font-semibold text-base mb-2 group-hover:text-primary transition-colors leading-snug">
                  {property.property_type} in {property.location?.split(",")[0]}
                </h3>

                <div className="flex items-center gap-1 text-muted-foreground mb-4">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm truncate">{property.location}</span>
                </div>

                {/* Specs */}
                <div className="flex items-center gap-4 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bed className="w-3.5 h-3.5" />
                    <span>{property.num_bedroom} Beds</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bath className="w-3.5 h-3.5" />
                    <span>{property.num_bathroom} Baths</span>
                  </div>
                  {property.property_size && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Square className="w-3.5 h-3.5" />
                      <span>{property.property_size} sqft</span>
                    </div>
                  )}
                </div>

                <Link to="/auth" className="block mt-4">
                  <Button className="w-full bg-primary hover:bg-primary/90 font-medium h-10">
                    <Calendar className="w-4 h-4 mr-2" />
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
