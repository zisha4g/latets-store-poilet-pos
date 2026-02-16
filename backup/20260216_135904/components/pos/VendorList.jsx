import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Mail, Phone as PhoneIcon } from 'lucide-react';
import VendorModal from './VendorModal';
import { toast } from '@/components/ui/use-toast';
import { useResponsive } from '@/lib/responsive';

const VendorList = ({ vendors = [], handlers }) => {
  const { isMobile } = useResponsive();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredVendors = (vendors || []).filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.contact_person && v.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddVendor = () => {
    setSelectedVendor(null);
    setIsModalOpen(true);
  };

  const handleEditVendor = (vendor) => {
    setSelectedVendor(vendor);
    setIsModalOpen(true);
  };

  const handleDeleteVendor = async (vendorId) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      try {
        if (!handlers?.vendors) {
          toast({ title: "Error", description: "Vendor handlers not available", variant: "destructive" });
          return;
        }
        await handlers.vendors.delete(vendorId);
        toast({ title: "Vendor Deleted", description: "The vendor has been successfully deleted." });
      } catch (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleSaveVendor = async (vendorData) => {
    try {
      if (!handlers?.vendors) {
        toast({ title: "Error", description: "Vendor handlers not available", variant: "destructive" });
        return;
      }
      if (vendorData.id) {
        await handlers.vendors.update(vendorData);
        toast({ title: "Vendor Updated", description: "The vendor has been successfully updated." });
      } else {
        await handlers.vendors.add(vendorData);
        toast({ title: "Vendor Added", description: "The vendor has been successfully added." });
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 mb-4">
          <div className="relative flex-grow sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          <Button onClick={handleAddVendor} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Vendor</span><span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block flex-grow bg-card rounded-xl shadow-md overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Person</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-secondary">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{vendor.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{vendor.contact_person || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{vendor.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{vendor.phone || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEditVendor(vendor)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteVendor(vendor.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex-grow space-y-3 overflow-auto">
          {filteredVendors.map((vendor) => (
            <motion.div
              key={vendor.id}
              className="bg-card rounded-lg shadow p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{vendor.name}</h3>
                  {vendor.contact_person && (
                    <p className="text-sm text-muted-foreground">{vendor.contact_person}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 mb-3">
                {vendor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">
                      {vendor.email}
                    </a>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${vendor.phone}`} className="text-blue-600 hover:underline">
                      {vendor.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleEditVendor(vendor)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDeleteVendor(vendor.id)}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </div>
            </motion.div>
          ))}
          {filteredVendors.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No vendors found</p>
            </div>
          )}
        </div>
      </div>
      {isModalOpen && (
        <VendorModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVendor(null);
          }}
          vendor={selectedVendor}
          onSave={handleSaveVendor}
        />
      )}
    </>
  );
};

export default VendorList;