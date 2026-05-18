-- fx_rates
CREATE TABLE public.fx_rates (
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL DEFAULT 'EUR',
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.fx_rates FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.fx_rates(base_currency, quote_currency, rate) VALUES ('EUR','EUR',1)
  ON CONFLICT DO NOTHING;

-- item_offers
CREATE TABLE public.item_offers (
  id TEXT PRIMARY KEY,
  standard_item_id TEXT NOT NULL REFERENCES public.standard_items(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_sku TEXT,
  spec TEXT,
  dimensions TEXT,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  price_eur NUMERIC,
  lead_time_days INTEGER,
  moq INTEGER,
  valid_until DATE,
  notes TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.item_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.item_offers FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_item_offers_standard_item ON public.item_offers(standard_item_id);
CREATE UNIQUE INDEX uniq_item_offers_selected_per_item
  ON public.item_offers(standard_item_id) WHERE is_selected = true;

-- item_offer_history
CREATE TABLE public.item_offer_history (
  history_id BIGSERIAL PRIMARY KEY,
  offer_id TEXT NOT NULL,
  standard_item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.item_offer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.item_offer_history FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_offer_history_item ON public.item_offer_history(standard_item_id, changed_at DESC);
CREATE INDEX idx_offer_history_offer ON public.item_offer_history(offer_id, changed_at DESC);

-- BEFORE INSERT/UPDATE: compute price_eur + updated_at
CREATE OR REPLACE FUNCTION public.item_offers_compute_eur()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r NUMERIC;
BEGIN
  NEW.updated_at := now();
  IF NEW.currency IS NULL OR NEW.currency = 'EUR' THEN
    NEW.price_eur := NEW.price;
  ELSE
    SELECT rate INTO r FROM public.fx_rates
      WHERE base_currency = NEW.currency AND quote_currency = 'EUR' LIMIT 1;
    IF r IS NULL THEN
      NEW.price_eur := NEW.price;
    ELSE
      NEW.price_eur := NEW.price * r;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_item_offers_compute_eur
  BEFORE INSERT OR UPDATE ON public.item_offers
  FOR EACH ROW EXECUTE FUNCTION public.item_offers_compute_eur();

-- AFTER trigger: mirror selected offer onto standard_items, and write history
CREATE OR REPLACE FUNCTION public.item_offers_after_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act TEXT; snap JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    act := 'deleted';
    snap := to_jsonb(OLD);
    INSERT INTO public.item_offer_history(offer_id, standard_item_id, action, snapshot)
      VALUES (OLD.id, OLD.standard_item_id, act, snap);
    IF OLD.is_selected THEN
      UPDATE public.standard_items SET unit_price_eur = NULL, supplier_id = NULL
        WHERE id = OLD.standard_item_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    act := CASE WHEN NEW.is_selected THEN 'selected' ELSE 'created' END;
  ELSE
    IF NEW.is_selected AND NOT OLD.is_selected THEN act := 'selected';
    ELSIF OLD.is_selected AND NOT NEW.is_selected THEN act := 'deselected';
    ELSE act := 'updated';
    END IF;
  END IF;

  snap := to_jsonb(NEW);
  INSERT INTO public.item_offer_history(offer_id, standard_item_id, action, snapshot)
    VALUES (NEW.id, NEW.standard_item_id, act, snap);

  IF NEW.is_selected THEN
    UPDATE public.standard_items
      SET unit_price_eur = NEW.price_eur, supplier_id = NEW.supplier_id
      WHERE id = NEW.standard_item_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_selected AND NOT NEW.is_selected THEN
    UPDATE public.standard_items SET unit_price_eur = NULL, supplier_id = NULL
      WHERE id = NEW.standard_item_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_item_offers_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.item_offers
  FOR EACH ROW EXECUTE FUNCTION public.item_offers_after_change();