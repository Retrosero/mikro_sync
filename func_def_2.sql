CREATE OR REPLACE FUNCTION public.update_guncelleme_tarihi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.guncelleme_tarihi = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$
