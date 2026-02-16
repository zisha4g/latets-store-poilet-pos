import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tjjueyedvxhkvinxsszy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqanVleWVkdnhoa3Zpbnhzc3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2MTE2NzQsImV4cCI6MjA2NjE4NzY3NH0.mG7gympgMBIx4uBMXhyBmFokesVDqbKyEhcxDMFulWU';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
