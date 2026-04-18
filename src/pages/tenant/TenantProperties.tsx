import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bed, Bath, Ruler, Calendar, Search, Filter, ImageIcon, Eye, Heart } from "lucide-react";
import PropertyDetailModal from "@/components/properties/PropertyDetailModal";
import { logAppointmentCreation } from "@/utils/auditLog";
import { notifyNewBooking } from "@/utils/n8nService";

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
const TenantProperties = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: "",
    time: ""
  });
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
      // Get tenant_id and favorites
      if (user) {
        const {
          data: tenantData
        } = await supabase.from("tenant").select("tenant_id").eq("user_id", user.id).maybeSingle();
        if (tenantData) {
          setTenantId(tenantData.tenant_id);

          // Fetch favorites
          const {
            data: favData
          } = await supabase.from("favorites").select("property_id").eq("tenant_id", tenantData.tenant_id);
          if (favData) {
            setFavorites(favData.map(f => f.property_id));
          }
        }
      }

      // Fetch available properties (excluding owner contact_no as it's encrypted and not needed here)
      const {
        data,
        error
      } = await supabase.from("property").select(`
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
        `).eq("availability_status", "Available").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      setProperties(data as unknown as Property[] || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const toggleFavorite = async (propertyId: number) => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "Please log in to save favorites",
        variant: "destructive"
      });
      return;
    }
    const isFavorited = favorites.includes(propertyId);
    try {
      if (isFavorited) {
        // Remove from favorites
        const {
          error
        } = await supabase.from("favorites").delete().eq("tenant_id", tenantId).eq("property_id", propertyId);
        if (error) throw error;
        setFavorites(favorites.filter(id => id !== propertyId));
        toast({
          title: "Removed",
          description: "Property removed from favorites"
        });
      } else {
        // Add to favorites
        const {
          error
        } = await supabase.from("favorites").insert({
          tenant_id: tenantId,
          property_id: propertyId
        });
        if (error) throw error;
        setFavorites([...favorites, propertyId]);
        toast({
          title: "Saved",
          description: "Property added to favorites"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
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
      toast({
        title: "Error",
        description: "Please log in to book an appointment",
        variant: "destructive"
      });
      return;
    }
    if (!bookingData.date || !bookingData.time) {
      toast({
        title: "Error",
        description: "Please select date and time",
        variant: "destructive"
      });
      return;
    }
    if (bookingData.date < getTomorrowDate()) {
      toast({
        title: "Error",
        description: "Appointment date must be tomorrow or later",
        variant: "destructive"
      });
      return;
    }
    setIsBooking(true);
    try {
      const {
        data: newAppointment,
        error
      } = await supabase.from("appointment").insert({
        appointment_date: bookingData.date,
        appointment_time: bookingData.time,
        status: "pending",
        tenant_id: tenantId,
        property_id: selectedProperty.property_id,
        owner_id: selectedProperty.owner_id
      }).select('appointment_id').single();
      if (error) throw error;

      // Log appointment creation and trigger n8n email notifications
      if (newAppointment) {
        await logAppointmentCreation(
          newAppointment.appointment_id.toString(),
          selectedProperty.property_id.toString()
        );
        // Fire-and-forget: n8n sends confirmation emails to tenant and owner
        notifyNewBooking(newAppointment.appointment_id);
      }

      toast({
        title: "Appointment Requested",
        description: "Your viewing appointment is pending approval from the property owner."
      });
      setBookingDialog(false);
      setSelectedProperty(null);
      setBookingData({
        date: "",
        time: ""
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsBooking(false);
    }
  };
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };
  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>;
  }
  return <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Browse Properties</h2>
        <p className="text-muted-foreground">Find your perfect home and book a viewing appointment</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label className="sr-only">Search Location</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by location..." value={searchLocation} onChange={e => setSearchLocation(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="sr-only">Property Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Apartment">Apartment</SelectItem>
                  <SelectItem value="House">House</SelectItem>
                  <SelectItem value="Condo">Condo</SelectItem>
                  <SelectItem value="Townhouse">Townhouse</SelectItem>
                  <SelectItem value="Studio">Studio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="sr-only">Min Price</Label>
              <Input type="number" placeholder="Min Price" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            </div>
            <div>
              <Label className="sr-only">Max Price</Label>
              <Input type="number" placeholder="Max Price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
            <div>
              <Label className="sr-only">Bedrooms</Label>
              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger>
                  <SelectValue placeholder="Beds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Beds</SelectItem>
                  <SelectItem value="1">1 Bed</SelectItem>
                  <SelectItem value="2">2 Beds</SelectItem>
                  <SelectItem value="3">3 Beds</SelectItem>
                  <SelectItem value="4">4+ Beds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <Filter className="w-4 h-4 inline mr-1" />
          {filteredProperties.length} properties found
        </p>
      </div>

      {filteredProperties.length === 0 ? <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No properties match your criteria</p>
          </CardContent>
        </Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map(property => <Card key={property.property_id} className="hover-lift overflow-hidden flex flex-col">
              {/* Property Image */}
              <div className="relative h-48 bg-muted flex-shrink-0">
                {property.images && property.images.length > 0 ? <img src={property.images[0]} alt={`${property.property_type} at ${property.location}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                  </div>}
                <Badge className="absolute top-3 right-3 bg-green-500/90 text-white border-0">Available</Badge>
                {/* Favorite Button */}
                <Button variant="ghost" size="icon" className="absolute top-3 left-3 bg-background/80 hover:bg-background" onClick={e => {
            e.stopPropagation();
            toggleFavorite(property.property_id);
          }}>
                  <Heart className={`w-5 h-5 ${favorites.includes(property.property_id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                </Button>
                {property.images && property.images.length > 1 && <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    +{property.images.length - 1} photos
                  </div>}
              </div>
              <CardHeader className="pb-2">
                <div>
                  <CardTitle className="text-lg">{property.property_type}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="line-clamp-1">{property.location}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 pb-4">
                <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                  
                  <span>RM {property.rental_price.toLocaleString()}</span>
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    <span>{property.num_bedroom} Bed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4" />
                    <span>{property.num_bathroom} Bath</span>
                  </div>
                  {property.property_size && <div className="flex items-center gap-1">
                      <Ruler className="w-4 h-4" />
                      <span>{property.property_size} sqft</span>
                    </div>}
                </div>
                {property.description && <p className="text-sm text-muted-foreground line-clamp-2">{property.description}</p>}
                <p className="text-xs text-muted-foreground">Listed by: {property.property_owner?.name || "Owner"}</p>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => {
              setSelectedProperty(property);
              setDetailModalOpen(true);
            }}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button className="flex-1" onClick={() => {
              setSelectedProperty(property);
              setBookingDialog(true);
            }}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Book
                  </Button>
                </div>
              </CardContent>
            </Card>)}
        </div>}

      {/* Property Detail Modal */}
      <PropertyDetailModal property={selectedProperty} open={detailModalOpen} onOpenChange={setDetailModalOpen} onBookViewing={() => {
      setDetailModalOpen(false);
      setBookingDialog(true);
    }} />

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onOpenChange={open => {
      setBookingDialog(open);
      if (!open) setBookingData({
        date: "",
        time: ""
      });
    }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Viewing Appointment</DialogTitle>
            <DialogDescription>Select your preferred date and time for viewing this property.</DialogDescription>
          </DialogHeader>
          {selectedProperty && <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <p className="font-medium">{selectedProperty.property_type}</p>
                <p className="text-sm text-muted-foreground">{selectedProperty.location}</p>
                <p className="text-lg font-bold text-primary mt-2">
                  RM {selectedProperty.rental_price.toLocaleString()}/mo
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="booking-date">Date *</Label>
                  <Input id="booking-date" type="date" min={getTomorrowDate()} value={bookingData.date} onChange={e => setBookingData({
                ...bookingData,
                date: e.target.value
              })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-time">Time *</Label>
                  <Select value={bookingData.time} onValueChange={v => setBookingData({
                ...bookingData,
                time: v
              })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="09:00">9:00 AM</SelectItem>
                      <SelectItem value="10:00">10:00 AM</SelectItem>
                      <SelectItem value="11:00">11:00 AM</SelectItem>
                      <SelectItem value="14:00">2:00 PM</SelectItem>
                      <SelectItem value="15:00">3:00 PM</SelectItem>
                      <SelectItem value="16:00">4:00 PM</SelectItem>
                      <SelectItem value="17:00">5:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBookAppointment} disabled={isBooking}>
              {isBooking ? "Booking..." : "Request Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
};
export default TenantProperties;