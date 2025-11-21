CREATE OR REPLACE FUNCTION public.update_stok_durumu()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.eldeki_miktar = 0 THEN
        NEW.stok_durumu = 'bitti';
    ELSIF NEW.eldeki_miktar <= NEW.minimum_stok THEN
        NEW.stok_durumu = 'kritik';
    ELSE
        NEW.stok_durumu = 'normal';
    END IF;
    
    NEW.guncelleme_tarihi = now();
    RETURN NEW;
END;
$function$
