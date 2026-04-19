
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  generations_count INTEGER NOT NULL DEFAULT 0,
  total_views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Presentations
CREATE TABLE public.presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,
  language TEXT DEFAULT 'pt-BR',
  theme TEXT DEFAULT 'profissional-azul',
  font_style TEXT DEFAULT 'modern-sans',
  slug TEXT NOT NULL UNIQUE,
  slides_count INTEGER NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_password_protected BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_presentations_user ON public.presentations(user_id);
CREATE INDEX idx_presentations_slug ON public.presentations(slug);
CREATE POLICY "presentations_owner_all" ON public.presentations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presentations_public_read" ON public.presentations FOR SELECT USING (is_published = true AND deleted_at IS NULL);

-- Slides
CREATE TABLE public.slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  slide_type TEXT NOT NULL DEFAULT 'content',
  layout_template TEXT DEFAULT 'title-content',
  background_color TEXT,
  background_image_url TEXT,
  speaker_notes TEXT,
  animation_transition TEXT DEFAULT 'fade',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_slides_presentation ON public.slides(presentation_id);
CREATE POLICY "slides_owner_all" ON public.slides FOR ALL
  USING (EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = presentation_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = presentation_id AND p.user_id = auth.uid()));
CREATE POLICY "slides_public_read" ON public.slides FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = presentation_id AND p.is_published = true AND p.deleted_at IS NULL));

-- Slide views (analytics)
CREATE TABLE public.slide_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  viewer_ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.slide_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_views_presentation ON public.slide_views(presentation_id);
CREATE POLICY "views_anyone_insert" ON public.slide_views FOR INSERT WITH CHECK (true);
CREATE POLICY "views_owner_select" ON public.slide_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = presentation_id AND p.user_id = auth.uid()));

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_presentations_updated BEFORE UPDATE ON public.presentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_slides_updated BEFORE UPDATE ON public.slides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
