import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, Ruler, Calendar, ImageIcon, User, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

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

  const prevImage = () => setCurrentImageIndex(i => (i - 1 + images.length) % images.length);
  const nextImage = () => setCurrentImageIndex(i => (i + 1) % images.length);

  const isAvailable = property.availability_status?.toLowerCase() === 'available';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCurrentImageIndex(0); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-3xl [&>button]:z-50 [&>button]:text-white [&>button]:bg-black/30 [&>button]:hover:bg-black/50 [&>button]:rounded-full [&>button]:w-8 [&>button]:h-8 [&>button]:top-4 [&>button]:right-4">

        {/* ── Hero Image ── */}
        <div className="relative h-[48vh] min-h-72 overflow-hidden rounded-t-3xl bg-muted">
          {hasImages ? (
            <img
              src={images[currentImageIndex]}
              alt={`${property.property_type} - Photo ${currentImageIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-sm opacity-60">No photos available</p>
            </div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />

          {/* Image navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Image counter pill */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {images.length}
              </div>
            </>
          )}

          {/* Property title overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-7">
            <p className="section-label text-white/60 mb-1.5">For Rent</p>
            <h2 className="font-display font-light text-[clamp(2rem,4vw,3rem)] leading-tight text-white">
              {property.property_type}
            </h2>
            <div className="flex items-center gap-1.5 text-white/75 text-sm mt-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{property.location}</span>
            </div>
          </div>
        </div>

        {/* ── Thumbnail Strip ── */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 py-3 bg-muted/40 border-b border-border/40">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  i === currentImageIndex
                    ? 'border-primary shadow-md scale-105'
                    : 'border-transparent opacity-50 hover:opacity-80 hover:border-border'
                }`}
              >
                <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div className="px-6 md:px-8 py-8 space-y-8">

          {/* Price + Availability */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-label mb-2">Monthly Rental</p>
              <div className="flex items-end gap-2">
                <span className="font-display font-light text-[clamp(2.4rem,5vw,3.2rem)] leading-none text-foreground">
                  RM {property.rental_price.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-base mb-1">/mo</span>
              </div>
            </div>
            <Badge
              className={`mt-1 px-3 py-1 text-xs font-medium rounded-full border ${
                isAvailable
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {isAvailable ? 'Available' : property.availability_status}
            </Badge>
          </div>

          {/* Feature Stats */}
          <div className="grid grid-cols-3 gap-3 py-6 border-y border-border/50">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bed className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-medium text-2xl leading-none">{property.num_bedroom}</p>
                <p className="text-xs text-muted-foreground mt-1">Bedroom{property.num_bedroom !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 text-center border-x border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bath className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-medium text-2xl leading-none">{property.num_bathroom}</p>
                <p className="text-xs text-muted-foreground mt-1">Bathroom{property.num_bathroom !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-medium text-2xl leading-none">{property.property_size || '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">Sq Ft</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <p className="section-label mb-3">About this Property</p>
              <p className="text-muted-foreground leading-[1.75] text-[0.9375rem]">
                {property.description}
              </p>
            </div>
          )}

          {/* Owner Card */}
          <div className="card-elevated p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Listed by</p>
                <p className="font-medium text-sm truncate">{property.property_owner?.name || 'Property Owner'}</p>
                {property.property_owner?.contact_no && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{property.property_owner.contact_no}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>

          {/* CTA */}
          <Button
            className="w-full h-13 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            onClick={onBookViewing}
            disabled={!isAvailable}
          >
            <Calendar className="w-5 h-5 mr-2.5" />
            {isAvailable ? 'Book a Viewing' : 'Not Available'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyDetailModal;
