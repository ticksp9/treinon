-- Create payment configuration table (global settings for beneficiary)
CREATE TABLE public.payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  beneficiary_name text,
  iban text,
  mbway_number text,
  instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(club_id)
);

-- Enable RLS
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

-- Only club admins/owners can manage payment config
CREATE POLICY "Club admins can manage payment config"
ON public.payment_config
FOR ALL
USING (is_club_staff_admin(club_id, auth.uid()));

-- Staff can view payment config
CREATE POLICY "Staff can view payment config"
ON public.payment_config
FOR SELECT
USING (is_club_staff_member(club_id, auth.uid()));

-- Create subscription payments table for payment proofs
CREATE TABLE public.subscription_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'transfer',
  proof_url text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  validated_at timestamp with time zone,
  validated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Users can view and insert their own payments
CREATE POLICY "Users can view own payments"
ON public.subscription_payments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
ON public.subscription_payments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending payments"
ON public.subscription_payments
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Club admins can view and manage club payments
CREATE POLICY "Club admins can manage club payments"
ON public.subscription_payments
FOR ALL
USING (club_id IS NOT NULL AND is_club_staff_admin(club_id, auth.uid()));

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage policies for payment proofs
CREATE POLICY "Users can upload their payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Club admins can view payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs');

-- Trigger for updated_at
CREATE TRIGGER update_payment_config_updated_at
BEFORE UPDATE ON public.payment_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_payments_updated_at
BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();