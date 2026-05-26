import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CurrencyCode } from "@/lib/format";

export type UiTheme = "light" | "dark" | "contrast";
export type DocTemplate = "classic" | "modern" | "compact";

export interface AppSettings {
  currency: CurrencyCode;
  theme: UiTheme;
  default_doc_template: DocTemplate;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_logo_url: string | null;
}

interface AppContextValue {
  user: { id: string; email?: string } | null;
  loadingAuth: boolean;
  settings: AppSettings;
  refreshSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  signOut: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  currency: "PKR",
  theme: "light",
  default_doc_template: "classic",
  business_name: null,
  business_address: null,
  business_phone: null,
  business_logo_url: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function applyTheme(theme: UiTheme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("dark");
  html.removeAttribute("data-theme");
  if (theme === "dark") html.classList.add("dark");
  if (theme === "contrast") html.setAttribute("data-theme", "contrast");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppContextValue["user"]>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

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
    const { data } = await supabase.from("app_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const next: AppSettings = {
        currency: data.currency as CurrencyCode,
        theme: data.theme as UiTheme,
        default_doc_template: data.default_doc_template as DocTemplate,
        business_name: data.business_name,
        business_address: data.business_address,
        business_phone: data.business_phone,
        business_logo_url: (data as any).business_logo_url ?? null,
      };
      setSettings(next);
      applyTheme(next.theme);
    }
  };

  useEffect(() => {
    if (user) refreshSettings();
    else {
      setSettings(DEFAULT_SETTINGS);
      applyTheme("light");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next.theme);
    await supabase.from("app_settings").upsert({ user_id: user.id, ...next });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{ user, loadingAuth, settings, refreshSettings, updateSettings, signOut }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
