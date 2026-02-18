import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const createSupabaseClient = (url: string, key: string, authHeader?: string) => {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: authHeader
      ? {
          headers: {
            Authorization: authHeader,
          },
        }
      : undefined,
  });
};
