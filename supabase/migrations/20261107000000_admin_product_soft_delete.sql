
























ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.products.deleted_by IS
  'Terisi = dihapus admin (Super Admin). NULL + deleted_at terisi = ditarik penjual. Dipakai UI untuk memilih label dan jalur pemulihan.';
COMMENT ON COLUMN public.products.deletion_reason IS
  'Alasan penghapusan oleh admin; ditampilkan di panel agar keputusan dapat ditelusuri.';

CREATE OR REPLACE FUNCTION public.lock_products_deletion_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  
  NEW.deleted_by := OLD.deleted_by;
  NEW.deletion_reason := OLD.deletion_reason;
  
  
  IF OLD.deleted_by IS NOT NULL THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_lock_deletion ON public.products;
CREATE TRIGGER trg_products_lock_deletion
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.lock_products_deletion_on_update();

COMMENT ON FUNCTION public.lock_products_deletion_on_update() IS
  'Menghapus/memulihkan produk adalah keputusan admin; penjual tetap dapat menarik produknya sendiri, tetapi tidak dapat mengubah jejak penghapusan admin.';



