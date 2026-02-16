import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { demoData } from '@/data/sample-demo-data';

const tables = [
  'products', 'categories', 'customers', 'sales', 'invoices', 
  'expenses', 'vendors', 'saved_carts', 'taxes', 'service_charges', 
  'settings', 'chart_of_accounts', 'journal_entries', 'vendor_bills',
  'purchase_orders',
  'pbx_business_hours', 'pbx_ivr_menus', 'pbx_audio_files', 'pbx_extensions', 'pbx_call_logs', 'pbx_voicemails'
];

const pbxTables = ['pbx_business_hours', 'pbx_ivr_menus', 'pbx_audio_files', 'pbx_extensions', 'pbx_call_logs', 'pbx_voicemails'];

const showDemoToast = () => {
  toast({
    title: "Read-Only Demo",
    description: "This feature is disabled in the demo. Sign up for a free trial to get full access!",
    variant: "destructive",
  });
};

const createDemoHandlers = (table) => ({
  getAll: async () => {},
  getById: async () => {},
  add: async () => { showDemoToast(); return null; },
  update: async () => { showDemoToast(); return null; },
  delete: async () => { showDemoToast(); return null; },
  batchUpdate: async () => { showDemoToast(); return null; },
  batchDelete: async () => { showDemoToast(); return null; },
  upsert: async () => { showDemoToast(); return null; },
  ...(table === 'customers' && { findByPhone: async () => null }),
  ...(table === 'taxes' && { getApplicable: () => [] }),
  ...(table === 'service_charges' && { getApplicable: () => [] }),
});

export function useDataManagement(user, isDemo = false) {
  const [data, setData] = useState({
    products: [], 
    categories: [], 
    customers: [], 
    sales: [], 
    invoices: [],
    expenses: [], 
    vendors: [], 
    saved_carts: [], 
    taxes: [], 
    service_charges: [],
    settings: {}, 
    chartOfAccounts: [], 
    journalEntries: [], 
    vendorBills: [],
    purchaseOrders: [],
    pbxData: {
      businessHours: [], 
      ivrMenus: [], 
      audioFiles: [], 
      extensions: [], 
      callLogs: [], 
      voicemails: [],
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshData = useCallback(async () => {
    if (isDemo) {
        setData(demoData);
        setLoading(false);
        return;
    }
    
    if (!user?.id) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchPromises = tables.map(table =>
        supabase.from(table).select('*').eq('user_id', user.id)
      );

      const results = await Promise.all(fetchPromises);
      const fetchedData = tables.reduce((acc, table, index) => {
        if (results[index].error) {
          console.error(`Error fetching ${table}:`, results[index].error);
          toast({ title: `Error fetching data`, description: `Could not load ${table}.`, variant: "destructive" });
        }
        acc[table] = results[index].data || [];
        return acc;
      }, {});

      const settingsObject = (fetchedData.settings || []).reduce((acc, setting) => {
        acc[setting.key] = setting;
        return acc;
      }, {});

      setData({
        products: fetchedData.products || [],
        categories: fetchedData.categories || [],
        customers: fetchedData.customers || [],
        sales: fetchedData.sales || [],
        invoices: fetchedData.invoices || [],
        expenses: fetchedData.expenses || [],
        vendors: fetchedData.vendors || [],
        saved_carts: fetchedData.saved_carts || [],
        taxes: fetchedData.taxes || [],
        service_charges: fetchedData.service_charges || [],
        settings: settingsObject,
        chartOfAccounts: fetchedData.chart_of_accounts || [],
        journalEntries: fetchedData.journal_entries || [],
        vendorBills: fetchedData.vendor_bills || [],
        purchaseOrders: fetchedData.purchase_orders || [],
        pbxData: {
          businessHours: fetchedData.pbx_business_hours || [],
          ivrMenus: fetchedData.pbx_ivr_menus || [],
          audioFiles: fetchedData.pbx_audio_files || [],
          extensions: fetchedData.pbx_extensions || [],
          callLogs: (fetchedData.pbx_call_logs || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
          voicemails: (fetchedData.pbx_voicemails || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
        },
      });

    } catch (error) {
      console.error("Error fetching initial data:", error);
      setError(error.message);
      toast({ title: "Data Loading Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemo]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const createHandlers = (table) => ({
    getAll: async () => {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    add: async (item) => {
      const { data: [newItem], error } = await supabase.from(table).insert({ ...item, user_id: user.id }).select();
      if (error) throw error;
      await refreshData();
      return newItem;
    },
    update: async (item) => {
      const { data: [updatedItem], error } = await supabase.from(table).update(item).eq('id', item.id).select();
      if (error) throw error;
      await refreshData();
      return updatedItem;
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await refreshData();
    },
    batchUpdate: async (items) => {
        const { error } = await supabase.from(table).upsert(items);
        if (error) throw error;
        await refreshData();
    },
    batchDelete: async (ids) => {
        const { error } = await supabase.from(table).delete().in('id', ids);
        if (error) throw error;
        await refreshData();
    },
    upsert: async (items) => {
        const itemsToUpsert = Array.isArray(items) ? items : [items];
        const { error } = await supabase.from(table).upsert(itemsToUpsert.map(item => ({...item, user_id: user.id })));
        if (error) throw error;
        await refreshData();
    },
  });

  const handlers = useMemo(() => {
    if (isDemo) {
        const demoHandlers = tables.reduce((acc, table) => {
            acc[table] = createDemoHandlers(table);
            return acc;
        }, {});
        
        demoHandlers.pbx = pbxTables.reduce((acc, table) => {
            const tableName = table.replace('pbx_', '');
            const key = tableName.charAt(0).toLowerCase() + tableName.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase());
            acc[key] = createDemoHandlers(table);
            return acc;
        }, {});
        
        demoHandlers.serviceCharges = { ...createDemoHandlers('service_charges') };
        
        return demoHandlers;
    }
    
    if (!user?.id) return {};
    
    return {
      products: { ...createHandlers('products') },
      categories: { ...createHandlers('categories') },
      customers: {
        ...createHandlers('customers'),
        findByPhone: async (phone) => {
            if (!phone) return null;
            const { data, error } = await supabase.from('customers').select('*').eq('user_id', user.id).like('phone', `%${phone}`);
            
            if (error) {
              console.error("Error finding customer by phone:", error);
              toast({
                  title: "Search Failed",
                  description: "There was a problem searching for the customer.",
                  variant: "destructive",
              });
              return null;
            }

            if (!data || data.length === 0) return null;
            if (data.length === 1) return data[0];
            return { multiple: true, matches: data };
        }
      },
      sales: { ...createHandlers('sales') },
      invoices: { ...createHandlers('invoices') },
      expenses: { ...createHandlers('expenses') },
      vendors: { ...createHandlers('vendors') },
      savedCarts: { ...createHandlers('saved_carts') },
      taxes: { 
        ...createHandlers('taxes'),
        getApplicable: (amount) => {
          try {
            const applicableTaxes = (data.taxes || []).filter(t => t.is_default);
            return applicableTaxes.map(t => ({
              name: t.name || 'Tax',
              rate: parseFloat(t.rate) || 0,
              amount: amount * (parseFloat(t.rate) / 100)
            }));
          } catch (error) {
            console.error('Error calculating applicable taxes:', error);
            return [];
          }
        }
      },
      serviceCharges: { 
        ...createHandlers('service_charges'),
        getApplicable: (amount) => {
          try {
            return (data.service_charges || []).map(sc => {
              const value = parseFloat(sc.value) || 0;
              const calculatedAmount = sc.type === 'percentage' 
                ? amount * (value / 100) 
                : value;
              
              return {
                name: sc.name || 'Service Charge',
                type: sc.type || 'fixed',
                value: value,
                amount: calculatedAmount
              };
            });
          } catch (error) {
            console.error('Error calculating service charges:', error);
            return [];
          }
        }
      },
      purchase_orders: { ...createHandlers('purchase_orders') },
      settings: {
        update: async (setting) => {
            const { data: [updatedSetting], error } = await supabase.from('settings').upsert({ ...setting, user_id: user.id }, { onConflict: ['user_id', 'key'] }).select();
            if (error) throw error;
            await refreshData();
            return updatedSetting;
        }
      },
      accounting: {
          chartOfAccounts: { ...createHandlers('chart_of_accounts') },
          journalEntries: { ...createHandlers('journal_entries') },
          vendorBills: { ...createHandlers('vendor_bills') },
      },
      pbx: {
        business_hours: { ...createHandlers('pbx_business_hours'), upsert: async (items) => {
            const { error } = await supabase.from('pbx_business_hours').upsert(items.map(i => ({...i, user_id: user.id})), {onConflict: ['user_id', 'day_of_week']});
            if (error) throw error;
            await refreshData();
        }},
        ivr_menus: { ...createHandlers('pbx_ivr_menus') },
        audio_files: {
            ...createHandlers('pbx_audio_files'),
            add: async (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;
                let { error: uploadError } = await supabase.storage.from('pbx_audio').upload(filePath, file);
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage.from('pbx_audio').getPublicUrl(filePath);

                const { data: dbData, error: dbError } = await supabase.from('pbx_audio_files').insert({ user_id: user.id, name: file.name, file_url: publicUrl }).select();
                if (dbError) throw dbError;
                await refreshData();
                return dbData;
            },
            delete: async(id) => {
                const fileToDelete = data.pbxData.audioFiles.find(f => f.id === id);
                if(fileToDelete) {
                    const filePath = fileToDelete.file_url.substring(fileToDelete.file_url.indexOf(user.id));
                    await supabase.storage.from('pbx_audio').remove([filePath]);
                }
                await createHandlers('pbx_audio_files').delete(id);
            }
        },
        extensions: { ...createHandlers('pbx_extensions') },
        call_logs: { ...createHandlers('pbx_call_logs') },
        voicemails: { ...createHandlers('pbx_voicemails') },
      }
    };
  }, [user?.id, refreshData, isDemo, data.pbxData?.audioFiles, data.taxes, data.service_charges]);

  const customersWithStats = useMemo(() => {
    return (data.customers || []).map(customer => {
      const customerSales = (data.sales || []).filter(sale => sale.customer_id === customer.id);
      const totalSpent = customerSales.reduce((acc, sale) => acc + (sale.total || 0), 0);
      return { ...customer, totalSpent, visits: customerSales.length };
    });
  }, [data.customers, data.sales]);

  return { 
    data, 
    handlers, 
    loading, 
    error,
    customersWithStats, 
    refreshData 
  };
}