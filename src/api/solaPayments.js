import { supabase } from '@/lib/customSupabaseClient';

export const getSolaConfig = async () => {
  const { data, error } = await supabase.functions.invoke('sola-config');
  if (error) {
    throw error;
  }
  return data;
};

export const chargeSolaCard = async (payload) => {
  const { data, error } = await supabase.functions.invoke('sola-charge', {
    body: payload,
  });
  if (error) {
    throw error;
  }
  return data;
};
