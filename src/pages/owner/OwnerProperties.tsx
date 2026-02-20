import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin, Bed, Bath, Ruler, Image as ImageIcon } from 'lucide-react';
import PropertyPhotoUpload from '@/components/properties/PropertyPhotoUpload';
import { logPropertyCreation, logPropertyUpdate, logPropertyDeletion } from '@/utils/auditLog';
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
  images: []
};
const OwnerProperties = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (user) {
      fetchOwnerIdAndProperties();
    }
  }, [user]);
  const fetchOwnerIdAndProperties = async () => {
    try {
      // Get owner_id for the current user
      const {
        data: ownerData,
        error: ownerError
      } = await supabase.from('property_owner').select('owner_id').eq('user_id', user!.id).maybeSingle();
      if (ownerError) throw ownerError;
      if (ownerData) {
        setOwnerId(ownerData.owner_id);

        // Fetch properties for this owner
        const {
          data: propertiesData,
          error: propertiesError
        } = await supabase.from('property').select('*').eq('owner_id', ownerData.owner_id).order('created_at', {
          ascending: false
        });
        if (propertiesError) throw propertiesError;
        setProperties(propertiesData || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) {
      toast({
        title: 'Error',
        description: 'Owner profile not found',
        variant: 'destructive'
      });
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
        images: formData.images
      };
      if (editingProperty) {
        const {
          error
        } = await supabase.from('property').update(propertyData).eq('property_id', editingProperty.property_id).eq('owner_id', ownerId);
        if (error) throw error;

        // Log property update
        const updatedFields = Object.keys(propertyData).filter(key =>
          propertyData[key as keyof typeof propertyData] !== undefined
        );
        await logPropertyUpdate(editingProperty.property_id.toString(), updatedFields);

        toast({
          title: 'Success',
          description: 'Property updated successfully'
        });
      } else {
        const {
          data: newProperty,
          error
        } = await supabase.from('property').insert(propertyData).select('property_id').single();
        if (error) throw error;

        // Log property creation
        if (newProperty) {
          await logPropertyCreation(newProperty.property_id.toString(), formData.property_type);
        }

        toast({
          title: 'Success',
          description: 'Property added successfully'
        });
      }
      setIsDialogOpen(false);
      setEditingProperty(null);
      setFormData(initialFormData);
      fetchOwnerIdAndProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
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
      images: property.images || []
    });
    setIsDialogOpen(true);
  };
  const handleDelete = async (propertyId: number) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
      // Get property title before deletion for logging
      const propertyToDelete = properties.find(p => p.property_id === propertyId);
      const propertyTitle = propertyToDelete?.property_type || 'Unknown';

      const {
        error
      } = await supabase.from('property').delete().eq('property_id', propertyId).eq('owner_id', ownerId);
      if (error) throw error;

      // Log property deletion
      await logPropertyDeletion(propertyId.toString(), propertyTitle);

      toast({
        title: 'Success',
        description: 'Property deleted successfully'
      });
      fetchOwnerIdAndProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Occupied':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Reserved':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Properties</h2>
          <p className="text-muted-foreground">Manage your property listings</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingProperty(null);
          setFormData(initialFormData);
        }
      }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Property</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_type">Property Type *</Label>
                  <Select value={formData.property_type} onValueChange={v => setFormData({
                  ...formData,
                  property_type: v
                })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Apartment">Apartment</SelectItem>
                      <SelectItem value="House">House</SelectItem>
                      <SelectItem value="Condo">Condo</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability_status">Status</Label>
                  <Select value={formData.availability_status} onValueChange={v => setFormData({
                  ...formData,
                  availability_status: v
                })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Occupied">Occupied</SelectItem>
                      <SelectItem value="Reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input id="location" value={formData.location} onChange={e => setFormData({
                ...formData,
                location: e.target.value
              })} required placeholder="Enter full address" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rental_price">Monthly Rent (RM) *</Label>
                  <Input id="rental_price" type="number" step="0.01" min="0" value={formData.rental_price} onChange={e => setFormData({
                  ...formData,
                  rental_price: e.target.value
                })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_bedroom">Bedrooms *</Label>
                  <Input id="num_bedroom" type="number" min="0" value={formData.num_bedroom} onChange={e => setFormData({
                  ...formData,
                  num_bedroom: e.target.value
                })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_bathroom">Bathrooms *</Label>
                  <Input id="num_bathroom" type="number" min="0" value={formData.num_bathroom} onChange={e => setFormData({
                  ...formData,
                  num_bathroom: e.target.value
                })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_size">Property Size (sq ft)</Label>
                <Input id="property_size" type="number" step="0.01" min="0" value={formData.property_size} onChange={e => setFormData({
                ...formData,
                property_size: e.target.value
              })} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={e => setFormData({
                ...formData,
                description: e.target.value
              })} placeholder="Describe your property..." rows={3} />
              </div>
              <PropertyPhotoUpload images={formData.images} onImagesChange={images => setFormData({
              ...formData,
              images
            })} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingProperty ? 'Update' : 'Add Property'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {properties.length === 0 ? <Card><CardContent className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground mb-4">You haven't added any properties yet</p><Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Your First Property</Button></CardContent></Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(property => <Card key={property.property_id} className="hover-lift overflow-hidden">
              {property.images && property.images.length > 0 && <div className="aspect-video relative overflow-hidden">
                  <img src={property.images[0]} alt={property.property_type} className="w-full h-full object-cover" />
                  {property.images.length > 1 && <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      +{property.images.length - 1}
                    </div>}
                </div>}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{property.property_type}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{property.location}</span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(property.availability_status || 'Available')}>{property.availability_status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                  
                  <span>RM {property.rental_price.toLocaleString()}</span>
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1"><Bed className="w-4 h-4" /><span>{property.num_bedroom} Bed</span></div>
                  <div className="flex items-center gap-1"><Bath className="w-4 h-4" /><span>{property.num_bathroom} Bath</span></div>
                  {property.property_size && <div className="flex items-center gap-1"><Ruler className="w-4 h-4" /><span>{property.property_size} sqft</span></div>}
                </div>
                {property.description && <p className="text-sm text-muted-foreground line-clamp-2">{property.description}</p>}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(property)}><Edit className="w-4 h-4 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(property.property_id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>)}
        </div>}
    </div>;
};
export default OwnerProperties;