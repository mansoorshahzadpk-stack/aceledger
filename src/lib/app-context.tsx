import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CurrencyCode } from "@/lib/format";

export type UiTheme = "light" | "dark" | "contrast" | "lavender" | "maroon" | "green";
export type DocTemplate = "acelog" | "classic" | "modern" | "compact";

export interface AppSettings {
  currency: CurrencyCode;
  theme: UiTheme;
  default_doc_template: DocTemplate;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_logo_url: string | null;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  currency: CurrencyCode;
  owner_name: string | null;
  business_code: string | null;
  created_at: string;
  updated_at: string;
}

interface AppContextValue {
  user: { id: string; email?: string } | null;
  loadingAuth: boolean;
  settings: AppSettings;
  businesses: Business[];
  activeBusiness: Business | null;
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string) => Promise<void>;
  createBusiness: (
    name: string,
    currency: CurrencyCode,
    details?: Partial<Omit<Business, "id" | "user_id" | "created_at" | "updated_at">>
  ) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  updateBusiness: (
    patch: Partial<Omit<Business, "id" | "user_id" | "created_at" | "updated_at">>
  ) => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: (
    patch: Partial<Omit<AppSettings, "business_name" | "business_address" | "business_phone" | "business_logo_url" | "currency">>
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function applyTheme(theme: UiTheme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("dark");
  html.removeAttribute("data-theme");
  if (theme === "dark") html.classList.add("dark");
  else if (theme === "contrast") html.setAttribute("data-theme", "contrast");
  else if (theme === "lavender") html.setAttribute("data-theme", "lavender");
  else if (theme === "maroon") html.setAttribute("data-theme", "maroon");
  else if (theme === "green") html.setAttribute("data-theme", "green");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppContextValue["user"]>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [theme, setTheme] = useState<UiTheme>("light");
  const [docTemplate, setDocTemplate] = useState<DocTemplate>("acelog");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
      setLoadingAuth(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
      setLoadingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshSettings = async () => {
    if (!user) return;

    // 1. Fetch app_settings
    let { data: appSettingsData } = await supabase
      .from("app_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!appSettingsData) {
      const { data: newSettings } = await supabase
        .from("app_settings")
        .insert({ user_id: user.id })
        .select()
        .single();
      appSettingsData = newSettings;
    }

    // 2. Fetch businesses
    let { data: bizList } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    // Fallback: create default business if none exists
    if (!bizList || bizList.length === 0) {
      const { data: defaultBiz } = await supabase
        .from("businesses")
        .insert({
          user_id: user.id,
          name: appSettingsData?.business_name || "My Business",
          address: appSettingsData?.business_address,
          phone: appSettingsData?.business_phone,
          logo_url: appSettingsData?.business_logo_url,
          currency: (appSettingsData?.currency || "PKR") as CurrencyCode,
        })
        .select()
        .single();

      if (defaultBiz) {
        bizList = [defaultBiz];
        await supabase
          .from("app_settings")
          .update({ active_business_id: defaultBiz.id })
          .eq("user_id", user.id);
        appSettingsData.active_business_id = defaultBiz.id;
      }
    }

    const loadedBusinesses = (bizList || []) as Business[];
    setBusinesses(loadedBusinesses);

    let activeId = appSettingsData?.active_business_id;
    let activeBiz = loadedBusinesses.find((b) => b.id === activeId) || null;

    if (!activeBiz && loadedBusinesses.length > 0) {
      activeBiz = loadedBusinesses[0];
      activeId = activeBiz.id;
      await supabase
        .from("app_settings")
        .update({ active_business_id: activeId })
        .eq("user_id", user.id);
    }

    setActiveBusiness(activeBiz);
    setActiveBusinessId(activeId);

    if (appSettingsData) {
      const themeVal = appSettingsData.theme as UiTheme;
      setTheme(themeVal);
      setDocTemplate(appSettingsData.default_doc_template as DocTemplate);
      applyTheme(themeVal);
    }
  };

  useEffect(() => {
    if (user) {
      refreshSettings();
    } else {
      setTheme("light");
      setDocTemplate("acelog");
      setBusinesses([]);
      setActiveBusiness(null);
      setActiveBusinessId(null);
      applyTheme("light");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSetActiveBusinessId = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("app_settings")
      .update({ active_business_id: id })
      .eq("user_id", user.id);
    if (error) throw error;
    await refreshSettings();
  };

  const createBusiness = async (
    name: string,
    currency: CurrencyCode,
    details?: Partial<Omit<Business, "id" | "user_id" | "created_at" | "updated_at">>
  ) => {
    if (!user) return;
    if (businesses.length >= 10) {
      throw new Error("Maximum limit of 10 businesses reached");
    }

    const { data: newBiz, error } = await supabase
      .from("businesses")
      .insert({
        user_id: user.id,
        name,
        currency,
        ...details,
      })
      .select()
      .single();

    if (error) throw error;
    if (newBiz) {
      await supabase
        .from("app_settings")
        .update({ active_business_id: newBiz.id })
        .eq("user_id", user.id);
      await refreshSettings();
    }
  };

  const deleteBusiness = async (id: string) => {
    if (!user) return;
    if (businesses.length <= 1) {
      throw new Error("You must have at least one business");
    }

    const remaining = businesses.filter((b) => b.id !== id);
    if (activeBusinessId === id && remaining.length > 0) {
      await supabase
        .from("app_settings")
        .update({ active_business_id: remaining[0].id })
        .eq("user_id", user.id);
    }

    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) throw error;
    await refreshSettings();
  };

  const updateBusiness = async (
    patch: Partial<Omit<Business, "id" | "user_id" | "created_at" | "updated_at">>
  ) => {
    if (!user || !activeBusinessId) return;
    const { error } = await supabase
      .from("businesses")
      .update(patch)
      .eq("id", activeBusinessId);
    if (error) throw error;
    await refreshSettings();
  };

  const updateSettings = async (
    patch: Partial<Omit<AppSettings, "business_name" | "business_address" | "business_phone" | "business_logo_url" | "currency">>
  ) => {
    if (!user) return;
    const { error } = await supabase
      .from("app_settings")
      .update(patch)
      .eq("user_id", user.id);
    if (error) throw error;
    await refreshSettings();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const settingsMerged: AppSettings = {
    currency: activeBusiness?.currency ?? "PKR",
    theme,
    default_doc_template: docTemplate,
    business_name: activeBusiness?.name ?? null,
    business_address: activeBusiness?.address ?? null,
    business_phone: activeBusiness?.phone ?? null,
    business_logo_url: activeBusiness?.logo_url ?? null,
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loadingAuth,
        settings: settingsMerged,
        businesses,
        activeBusiness,
        activeBusinessId,
        setActiveBusinessId: handleSetActiveBusinessId,
        createBusiness,
        deleteBusiness,
        updateBusiness,
        refreshSettings,
        updateSettings,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
