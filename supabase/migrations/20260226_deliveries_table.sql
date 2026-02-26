-- Create deliveries table
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  address TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deliveries"
  ON public.deliveries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deliveries"
  ON public.deliveries FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON public.deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(user_id, status);
