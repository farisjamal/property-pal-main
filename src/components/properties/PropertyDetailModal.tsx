import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { MapPin, Bed, Bath, DollarSign, Ruler, Calendar, ImageIcon, User, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

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
    contact_no: string | null;
  };
}

interface PropertyDetailModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookViewing: () => void;
}

const PropertyDetailModal = ({ property, open, onOpenChange, onBookViewing }: PropertyDetailModalProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!property) return null;

  const images = property.images || [];
  const hasImages = images.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{property.property_type}</DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {property.location}
          </DialogDescription>
        </DialogHeader>

        {/* Image Gallery */}
        <div className="relative">
          {hasImages ? (
            <div className="space-y-4">
              {/* Main Carousel */}
              <Carousel className="w-full">
                <CarouselContent>
                  {images.map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                          src={image}
                          alt={`${property.property_type} - Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2 bg-background/80 hover:bg-background" />
                    <CarouselNext className="right-2 bg-background/80 hover:bg-background" />
                  </>
                )}
              </Carousel>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                        index === currentImageIndex
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Image Counter */}
              <p className="text-sm text-muted-foreground text-center">
                {images.length} photo{images.length !== 1 ? 's' : ''} available
              </p>
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>No photos available</p>
              </div>
            </div>
          )}
        </div>

        {/* Property Details */}
        <div className="space-y-6">
          {/* Price & Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-3xl font-bold text-primary">
              <DollarSign className="w-7 h-7" />
              <span>RM {property.rental_price.toLocaleString()}</span>
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-sm px-3 py-1">
              {property.availability_status}
            </Badge>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Bed className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-semibold">{property.num_bedroom}</p>
                <p className="text-sm text-muted-foreground">Bedroom{property.num_bedroom !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Bath className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-semibold">{property.num_bathroom}</p>
                <p className="text-sm text-muted-foreground">Bathroom{property.num_bathroom !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Ruler className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xl font-semibold">{property.property_size || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">Sq Ft</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-muted-foreground leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* Owner Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-3">Listed By</h4>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{property.property_owner?.name || 'Property Owner'}</p>
                {property.property_owner?.contact_no && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {property.property_owner.contact_no}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button className="w-full" size="lg" onClick={onBookViewing}>
            <Calendar className="w-5 h-5 mr-2" />
            Book Viewing Appointment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyDetailModal;
