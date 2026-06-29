import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { useEffect } from "react";
import { AppProvider } from "@/lib/app-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const router = useRouter();

  useEffect(() => {
    const trace = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname,
      hash: window.location.hash,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      routerState: {
        currentLocation: router.state.location,
        resolvedLocation: router.state.resolvedLocation,
      }
    };
    console.error("Structured Client-Side 404 Routing Trace:", JSON.stringify(trace, null, 2));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ledger — B2B Accounts" },
      {
        name: "description",
        content: "Vendor and client ledger for raw material supply businesses.",
      },
      { property: "og:title", content: "Ledger — B2B Accounts" },
      { name: "twitter:title", content: "Ledger — B2B Accounts" },
      {
        property: "og:description",
        content: "Vendor and client ledger for raw material supply businesses.",
      },
      {
        name: "twitter:description",
        content: "Vendor and client ledger for raw material supply businesses.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b872978-8de0-4298-a749-a07ba8f87da5/id-preview-11e3b2b3--e5a1c247-e4cd-4f42-859d-76bd1b1e9380.lovable.app-1779811763140.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b872978-8de0-4298-a749-a07ba8f87da5/id-preview-11e3b2b3--e5a1c247-e4cd-4f42-859d-76bd1b1e9380.lovable.app-1779811763140.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AppProvider>
    </QueryClientProvider>
  );
}
