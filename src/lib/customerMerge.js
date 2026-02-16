import { supabase } from '@/lib/customSupabaseClient';

const normalizePhone = (value) => (value || '').replace(/\D/g, '');
const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export const groupDuplicateCustomers = (customers = []) => {
  const phoneMap = new Map();
  const emailMap = new Map();

  customers.forEach((customer) => {
    const phone = normalizePhone(customer.phone);
    const email = normalizeEmail(customer.email);

    if (phone) {
      const group = phoneMap.get(phone) || [];
      group.push(customer);
      phoneMap.set(phone, group);
    }

    if (email) {
      const group = emailMap.get(email) || [];
      group.push(customer);
      emailMap.set(email, group);
    }
  });

  const groups = [];

  phoneMap.forEach((group, key) => {
    if (group.length > 1) {
      groups.push({ type: 'phone', key, customers: group });
    }
  });

  emailMap.forEach((group, key) => {
    if (group.length > 1) {
      groups.push({ type: 'email', key, customers: group });
    }
  });

  return groups;
};

export const mergeCustomers = async ({ primaryId, duplicateId, strategy = 'fill-missing' }) => {
  if (!primaryId || !duplicateId) {
    throw new Error('Missing customer ids for merge');
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .in('id', [primaryId, duplicateId]);

  if (error) {
    throw error;
  }

  const primary = data?.find((c) => c.id === primaryId);
  const duplicate = data?.find((c) => c.id === duplicateId);

  if (!primary) {
    throw new Error('Primary customer not found');
  }

  if (!duplicate) {
    throw new Error('Duplicate customer not found');
  }

  const merged = { ...duplicate, ...primary, id: primaryId };

  if (strategy === 'fill-missing') {
    Object.keys(duplicate).forEach((key) => {
      const primaryValue = primary[key];
      if (primaryValue === null || primaryValue === undefined || primaryValue === '') {
        merged[key] = duplicate[key];
      }
    });
  }

  const { error: updateError } = await supabase
    .from('customers')
    .update(merged)
    .eq('id', primaryId);

  if (updateError) {
    throw updateError;
  }

  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', duplicateId);

  if (deleteError) {
    throw deleteError;
  }

  return merged;
};
