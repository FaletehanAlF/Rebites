









DELETE FROM public.activity_logs a
 WHERE a.activity_type = 'login'
   AND EXISTS (
     SELECT 1 FROM public.profiles p
      WHERE p.id = a.user_id AND p.role = 'admin'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.reports r WHERE r.activity_id = a.id
   );
