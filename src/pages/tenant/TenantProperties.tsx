import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bed, Bath, Ruler, Calendar, Search, ImageIcon, Eye, Heart, Building2, X } from "lucide-react";
import PropertyDetailModal from "@/components/properties/PropertyDetailModal";
import { logAppointmentCreation } from "@/utils/auditLog";

interface Property {
  property_id: number;
  property_type: string;
  location: string;
  rental_price: number;
  num_bedroom: number;
  num_bathroom: number;
  property_size: number | null;
  description: string | null;
  availability_status: string;
  owner_id: number;
  images: string[] | null;
  property_owner: {
    name: string;
  };
}

const timeSlots = [
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
];

const propertyTypes = ["all", "Apartment", "House", "Condo", "Townhouse", "Studio"];
const bedroomOptions = [
  { value: "all", label: "Any Beds" },
  { value: "1", label: "1 Bed" },
  { value: "2", label: "2 Beds" },
  { value: "3", label: "3 Beds" },
  { value: "4", label: "4+ Beds" },
];

const TenantProperties = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingData, setBookingData] = useState({ date: "", time: "" });
  const [favorites, setFavorites] = useState<number[]>([]);

  // Filters
  const [searchLocation, setSearchLocation] = useState("");
  const [propertyType, setPropertyType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("all");

  useEffect(() => {
    fetchTenantAndProperties();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [properties, searchLocation, propertyType, minPrice, maxPrice, bedrooms]);

  const fetchTenantAndProperties = async () => {
    try {
      if (user) {
        const { data: tenantData } = await supabase
          .from("tenant")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (tenantData) {
          setTenantId(tenantData.tenant_id);
          const { data: favData } = await supabase
            .from("favorites")
            .select("property_id")
            .eq("tenant_id", tenantData.tenant_id);
          if (favData) {
            setFavorites(favData.map(f => f.property_id));
          }
        }
      }

      const { data, error } = await supabase
        .from("property")
        .select(`
          property_id,
          property_type,
          location,
          rental_price,
          num_bedroom,
          num_bathroom,
          property_size,
          description,
          availability_status,
          owner_id,
          images,
          property_owner:owner_id(name)
        `)
        .eq("availability_status", "Available")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProperties(data as unknown as Property[] || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (propertyId: number) => {
    if (!tenantId) {
      toast({ title: "Error", description: "Please log in to save favorites", variant: "destructive" });
      return;
    }
    const isFavorited = favorites.includes(propertyId);
    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("property_id", propertyId);
        if (error) throw error;
        setFavorites(favorites.filter(id => id !== propertyId));
        toast({ title: "Removed", description: "Property removed from favorites" });
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ tenant_id: tenantId, property_id: propertyId });
        if (error) throw error;
        setFavorites([...favorites, propertyId]);
        toast({ title: "Saved", description: "Property added to favorites" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];
    if (searchLocation) {
      filtered = filtered.filter(p => p.location.toLowerCase().includes(searchLocation.toLowerCase()));
    }
    if (propertyType !== "all") {
      filtered = filtered.filter(p => p.property_type === propertyType);
    }
    if (minPrice) {
      filtered = filtered.filter(p => p.rental_price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(p => p.rental_price <= parseFloat(maxPrice));
    }
    if (bedrooms !== "all") {
      filtered = filtered.filter(p => p.num_bedroom === parseInt(bedrooms));
    }
    setFilteredProperties(filtered);
  };

  const handleBookAppointment = async () => {
    if (!selectedProperty || !tenantId) {
      toast({ title: "Error", description: "Please log in to book an appointment", variant: "destructive" });
      return;
    }
    if (!bookingData.date || !bookingData.time) {
      toast({ title: "Error", description: "Please select date and time", variant: "destructive" });
      return;
    }
    setIsBooking(true);
    try {
      const { data: newAppointment, error } = await supabase
        .from("appointment")
        .insert({
          appointment_date: bookingData.date,
          appointment_time: bookingData.time,
          status: "pending",
          tenant_id: tenantId,
          property_id: selectedProperty.property_id,
          owner_id: selectedProperty.owner_id,
        })
        .select("appointment_id")
        .single();
      if (error) throw error;

      if (newAppointment) {
        await logAppointmentCreation(
          newAppointment.appointment_id.toString(),
          selectedProperty.property_id.toString()
        );
      }

      toast({
        title: "Appointment Requested",
        description: "Your viewing appointment is pending approval from the property owner.",
      });
      setBookingDialog(false);
      setSelectedProperty(null);
      setBookingData({ date: "", time: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBooking(false);
    }
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const hasActiveFilters =
    searchLocation || propertyType !== "all" || minPrice || maxPrice || bedrooms !== "all";

  const clearFilters = () => {
    setSearchLocation("");
    setPropertyType("all");
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded-xl animate-pulse" />
        <div className="h-14 bg-muted/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="font-display font-light text-[clamp(1.6rem,3.5vw,2.4rem)] leading-tight tracking-[-0.02em]">
          Browse Properties
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Find your perfect home and book a viewing appointment
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by location, area, or city..."
          value={searchLocation}
          onChange={e => setSearchLocation(e.target.value)}
          className="pl-11 h-12 bg-card border-border/70 rounded-2xl text-base shadow-sm"
        />
        {searchLocation && (
          <button
            onClick={() => setSearchLocation("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* Property type pills */}
          {propertyTypes.map(type => (
            <button
              key={type}
              onClick={() => setPropertyType(type)}
              className={`pill ${propertyType === type ? "pill-active" : ""}`}
            >
              {type === "all" ? "All Types" : type}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Bedrooms pills */}
          {bedroomOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setBedrooms(opt.value)}
              className={`pill ${bedrooms === opt.value ? "pill-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}

          {/* Price range */}
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              placeholder="Min RM"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              className="h-8 w-24 text-sm rounded-full border-border/60 px-3"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <Input
              type="number"
              placeholder="Max RM"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="h-8 w-24 text-sm rounded-full border-border/60 px-3"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2">
        <span className="font-display text-2xl font-medium text-foreground leading-none">
          {filteredProperties.length}
        </span>
        <span className="text-sm text-muted-foreground">
          {filteredProperties.length === 1 ? "property" : "properties"} found
        </span>
      </div>

      {/* Empty state */}
      {filteredProperties.length === 0 ? (
        <div className="card-elevated p-14 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/25 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No properties match your criteria</p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        /* Property grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((property, i) => (
            <div
              key={property.property_id}
              className="property-card group flex flex-col animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Image */}
              <div className="relative h-52 bg-muted flex-shrink-0 overflow-hidden">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={`${property.property_type} at ${property.location}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/80">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}

                {/* Available badge */}
                <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 text-xs font-medium">
                  Available
                </Badge>

                {/* Favorite button */}
                <button
                  className="absolute top-3 left-3 w-8 h-8 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-all"
                  onClick={e => {
                    e.stopPropagation();
                    toggleFavorite(property.property_id);
                  }}
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      favorites.includes(property.property_id)
                        ? "fill-rose-500 text-rose-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>

                {/* Photo count */}
                {property.images && property.images.length > 1 && (
                  <div className="absolute bottom-2.5 right-2.5 bg-black/55 text-white text-xs px-2 py-1 rounded-lg font-medium">
                    +{property.images.length - 1} photos
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col p-5 gap-3">
                {/* Type + location */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider font-medium">{property.property_type}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="line-clamp-1">{property.location}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-semibold text-2xl text-primary leading-none">
                    RM {property.rental_price.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">/mo</span>
                </div>

                {/* Specs */}
                <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5" />
                    <span>{property.num_bedroom} Bed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" />
                    <span>{property.num_bathroom} Bath</span>
                  </div>
                  {property.property_size && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5" />
                      <span>{property.property_size} sqft</span>
                    </div>
                  )}
                </div>

                {property.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {property.description}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-auto">
                  Listed by <span className="font-medium">{property.property_owner?.name || "Owner"}</span>
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-2 font-medium"
                    onClick={() => {
                      setSelectedProperty(property);
                      setDetailModalOpen(true);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90 font-medium"
                    onClick={() => {
                      setSelectedProperty(property);
                      setBookingDialog(true);
                    }}
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    Book
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Detail Modal */}
      <PropertyDetailModal
        property={selectedProperty}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onBookViewing={() => {
          setDetailModalOpen(false);
          setBookingDialog(true);
        }}
      />

      {/* Booking Dialog */}
      <Dialog
        open={bookingDialog}
        onOpenChange={open => {
          setBookingDialog(open);
          if (!open) setBookingData({ date: "", time: "" });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-2xl">Book a Viewing</DialogTitle>
            <DialogDescription>
              Select your preferred date and time for this property viewing.
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-5">
              {/* Property summary */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border/60">
                {selectedProperty.images?.[0] && (
                  <div className="h-28 rounded-lg overflow-hidden mb-3">
                    <img
                      src={selectedProperty.images[0]}
                      alt={selectedProperty.property_type}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{selectedProperty.property_type}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedProperty.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary text-sm">
                      RM {selectedProperty.rental_price.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </div>
              </div>

              {/* Date picker */}
              <div className="space-y-2">
                <Label htmlFor="booking-date" className="text-sm font-medium">
                  Viewing Date
                </Label>
                <Input
                  id="booking-date"
                  type="date"
                  min={getTomorrowDate()}
                  value={bookingData.date}
                  onChange={e => setBookingData({ ...bookingData, date: e.target.value })}
                  className="h-11"
                />
              </div>

              {/* Time slots — pill buttons */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preferred Time</Label>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map(slot => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setBookingData({ ...bookingData, time: slot.value })}
                      className={`py-2.5 px-2 rounded-xl text-sm font-medium border-2 transition-all duration-150 ${
                        bookingData.time === slot.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBookingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBookAppointment}
              disabled={isBooking || !bookingData.date || !bookingData.time}
              className="bg-primary hover:bg-primary/90 font-medium"
            >
              {isBooking ? "Requesting..." : "Request Viewing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantProperties;
