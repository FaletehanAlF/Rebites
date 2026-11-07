















ALTER TABLE public.orders
  DROP COLUMN IF EXISTS midtrans_order_id;




UPDATE public.umkm_profiles
SET address = 'Jl. Margonda Raya No. 45, Beji, Kota Depok',
    city = 'Beji'
WHERE slug = 'warung-nusantara';

UPDATE public.umkm_profiles
SET address = 'Jl. Nusantara Raya No. 22, Sukmajaya, Kota Depok',
    city = 'Sukmajaya'
WHERE slug = 'dapur-ibu-tini';

UPDATE public.umkm_profiles
SET address = 'Jl. Juanda Raya No. 8, Cimanggis, Kota Depok',
    city = 'Cimanggis'
WHERE slug = 'warkop-pak-iman';
