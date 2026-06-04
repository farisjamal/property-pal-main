import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin, Bed, Bath, Ruler, Image as ImageIcon, Building2 } from 'lucide-react';
import PropertyPhotoUpload from '@/components/properties/PropertyPhotoUpload';
import { logPropertyCreation, logPropertyUpdate, logPropertyDeletion } from '@/security/auditLog';
import KycGate from '@/components/kyc/KycGate';
import { getOwnerKycStatus, KycStatus } from '@/security/kyc';

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
  created_at: string;
  images: string[] | null;
}

interface PropertyFormData {
  property_type: string;
  location: string;
  rental_price: string;
  num_bedroom: string;
  num_bathroom: string;
  property_size: string;
  description: string;
  availability_status: string;
  images: string[];
}

const initialFormData: PropertyFormData = {
  property_type: '',
  location: '',
  rental_price: '',
  num_bedroom: '',
  num_bathroom: '',
  property_size: '',
  description: '',
  availability_status: 'Available',
  images: [],
};

const statusConfig: Record<string, string> = {
  Available: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  Occupied: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
  Reserved: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
};

const OwnerProperties = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>('not_submitted');

  useEffect(() => {
    if (user) fetchOwnerIdAndProperties();
  }, [user]);

  const fetchOwnerIdAndProperties = async () => {
    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (ownerError) throw ownerError;
      if (ownerData) {
        setOwnerId(ownerData.owner_id);
        const st = await getOwnerKycStatus(ownerData.owner_id);
        setKycStatus(st);
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('property')
          .select('*')
          .eq('owner_id', ownerData.owner_id)
          .order('created_at', { ascending: false });

        if (propertiesError) throw propertiesError;
        setProperties(propertiesData || []);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) {
      toast({ title: 'Error', description: 'Owner profile not found', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const propertyData = {
        property_type: formData.property_type,
        location: formData.location,
        rental_price: parseFloat(formData.rental_price),
        num_bedroom: parseInt(formData.num_bedroom),
        num_bathroom: parseInt(formData.num_bathroom),
        property_size: formData.property_size ? parseFloat(formData.property_size) : null,
        description: formData.description || null,
        availability_status: formData.availability_status,
        owner_id: ownerId,
        images: formData.images,
      };

      if (editingProperty) {
        const { error } = await supabase
          .from('property')
          .update(propertyData)
          .eq('property_id', editingProperty.property_id)
          .eq('owner_id', ownerId);

        if (error) throw error;

        const updatedFields = Object.keys(propertyData).filter(
          key => propertyData[key as keyof typeof propertyData] !== undefined
        );
        await logPropertyUpdate(editingProperty.property_id.toString(), updatedFields);

        toast({ title: 'Success', description: 'Property updated successfully' });
      } else {
        const { data: newProperty, error } = await supabase
          .from('property')
          .insert(propertyData)
          .select('property_id')
          .single();

        if (error) throw error;
        if (newProperty) await logPropertyCreation(newProperty.property_id.toString(), formData.property_type);

        toast({ title: 'Success', description: 'Property added successfully' });
      }

      setIsDialogOpen(false);
      setEditingProperty(null);
      setFormData(initialFormData);
      fetchOwnerIdAndProperties();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setFormData({
      property_type: property.property_type,
      location: property.location,
      rental_price: property.rental_price.toString(),
      num_bedroom: property.num_bedroom.toString(),
      num_bathroom: property.num_bathroom.toString(),
      property_size: property.property_size?.toString() || '',
      description: property.description || '',
      availability_status: property.availability_status || 'Available',
      images: property.images || [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (propertyId: number) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      const propertyToDelete = properties.find(p => p.property_id === propertyId);
      const propertyTitle = propertyToDelete?.property_type || 'Unknown';

      const { error } = await supabase
        .from('property')
        .delete()
        .eq('property_id', propertyId)
        .eq('owner_id', ownerId);

      if (error) throw error;
      await logPropertyDeletion(propertyId.toString(), propertyTitle);

      toast({ title: 'Success', description: 'Property deleted successfully' });
      fetchOwnerIdAndProperties();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade-up">
        <div>
          <p className="section-label mb-1.5">Portfolio</p>
          <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em]">
            My Properties
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? '—' : `${properties.length} listing${properties.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={open => {
            setIsDialogOpen(open);
            if (!open) { setEditingProperty(null); setFormData(initialFormData); }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="bg-primary hover:bg-primary/90 font-medium gap-2 rounded-xl px-5"
              disabled={kycStatus !== 'approved'}
              title={kycStatus !== 'approved' ? 'Complete KYC verification to add listings' : undefined}
            >
              <Plus className="w-4 h-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display font-light text-2xl">
                {editingProperty ? 'Edit Property' : 'List a New Property'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_type" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Property Type *
                  </Label>
                  <Select
                    value={formData.property_type}
                    onValueChange={v => setFormData({ ...formData, property_type: v })}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Apartment', 'House', 'Condo', 'Townhouse', 'Studio'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability_status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={formData.availability_status}
                    onValueChange={v => setFormData({ ...formData, availability_status: v })}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Available', 'Occupied', 'Reserved'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Location *
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  required
                  placeholder="Enter full address"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rental_price" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Monthly Rent (RM) *
                  </Label>
                  <Input
                    id="rental_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rental_price}
                    onChange={e => setFormData({ ...formData, rental_price: e.target.value })}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_bedroom" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bedrooms *
                  </Label>
                  <Input
                    id="num_bedroom"
                    type="number"
                    min="0"
                    value={formData.num_bedroom}
                    onChange={e => setFormData({ ...formData, num_bedroom: e.target.value })}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_bathroom" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bathrooms *
                  </Label>
                  <Input
                    id="num_bathroom"
                    type="number"
                    min="0"
                    value={formData.num_bathroom}
                    onChange={e => setFormData({ ...formData, num_bathroom: e.target.value })}
                    required
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="property_size" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Property Size (sq ft)
                </Label>
                <Input
                  id="property_size"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.property_size}
                  onChange={e => setFormData({ ...formData, property_size: e.target.value })}
                  placeholder="Optional"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your property..."
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>

              <PropertyPhotoUpload
                images={formData.images}
                onImagesChange={images => setFormData({ ...formData, images })}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 rounded-xl px-6"
                >
                  {isSubmitting ? 'Saving...' : editingProperty ? 'Update Property' : 'Add Property'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KYC Gate */}
      {kycStatus !== 'approved' && (
        <KycGate status={kycStatus}>{null}</KycGate>
      )}

      {/* Property Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card-elevated overflow-hidden animate-pulse">
              <div className="h-52 bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-muted rounded-lg w-3/4" />
                <div className="h-3 bg-muted rounded-lg w-1/2" />
                <div className="h-6 bg-muted rounded-lg w-2/3 mt-2" />
                <div className="h-3 bg-muted rounded-lg w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="card-elevated p-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary/50" />
          </div>
          <h3 className="font-display font-light text-2xl mb-2">No properties yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Start building your portfolio by listing your first property.
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            disabled={kycStatus !== 'approved'}
            className="bg-primary hover:bg-primary/90 font-medium gap-2 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Your First Property
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property, i) => (
            <div
              key={property.property_id}
              className="property-card group animate-fade-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {/* Image */}
              <div className="relative h-52 overflow-hidden bg-muted">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.property_type}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
                {property.images && property.images.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <ImageIcon className="w-3 h-3" />
                    +{property.images.length - 1}
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge className={`text-xs border ${statusConfig[property.availability_status] || 'bg-muted text-muted-foreground border-border'}`}>
                    {property.availability_status}
                  </Badge>
                </div>
              </div>

              {/* Details */}
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-base leading-tight">{property.property_type}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1">{property.location}</span>
                  </div>
                </div>

                <div className="flex items-end gap-1.5">
                  <span className="font-display font-light text-[1.8rem] leading-none text-foreground">
                    RM {property.rental_price.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">/mo</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5" />{property.num_bedroom} Bed
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" />{property.num_bathroom} Bath
                  </span>
                  {property.property_size && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5" />{property.property_size} ft²
                      </span>
                    </>
                  )}
                </div>

                {property.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {property.description}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl gap-1.5 text-xs font-medium hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleEdit(property)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                    onClick={() => handleDelete(property.property_id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OwnerProperties;
