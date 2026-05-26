
-- 1) Tighten storage.objects policies for business-assets bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "business-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "business-assets read own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets insert own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets update own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets delete own" ON storage.objects;

-- Public URL access (/object/public/*) bypasses RLS, so restricting SELECT
-- here prevents listing/browsing while logos still render via public URLs.
CREATE POLICY "business-assets read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2) doc_counters: add owner-scoped write policies
CREATE POLICY "counters insert own" ON public.doc_counters
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counters update own" ON public.doc_counters
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counters delete own" ON public.doc_counters
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from anon/public.
--    Trigger-only functions: revoke from authenticated too.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

--    Callable functions: keep authenticated, drop anon/public.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.next_doc_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO authenticated;
