-- Add display_name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create billing_profiles table for payment preferences
CREATE TABLE public.billing_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    payment_method TEXT DEFAULT 'transfer',
    nif TEXT,
    billing_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for billing_profiles
CREATE POLICY "Users can view own billing profile"
ON public.billing_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing profile"
ON public.billing_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own billing profile"
ON public.billing_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Create updated_at trigger for billing_profiles
CREATE TRIGGER update_billing_profiles_updated_at
    BEFORE UPDATE ON public.billing_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();