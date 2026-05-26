import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">لم نتمكن من العثور على ما تبحث عنه.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">حاول مرة أخرى أو ارجع للرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            إعادة المحاولة
          </button>
          <a href="/" className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Munasabati — مناسبتي" },
        { name: "description", content: "نظم ديكوراتك بسهولة، وخلي كل مناسبة في وقتها المثالي." },
        { name: "author", content: "Munasabati" },
        { property: "og:title", content: "Munasabati — مناسبتي" },
        { property: "og:description", content: "نظم ديكوراتك بسهولة، وخلي كل مناسبة في وقتها المثالي." },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: "Munasabati — مناسبتي" },
        { name: "twitter:description", content: "نظم ديكوراتك بسهولة، وخلي كل مناسبة في وقتها المثالي." },
        { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/524cdfbf-5c98-432c-a703-c727fa546492/id-preview-7ec1f58e--ce538c62-b1f8-4a33-995f-e6026d415661.lovable.app-1778988194965.png" },
        { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/524cdfbf-5c98-432c-a703-c727fa546492/id-preview-7ec1f58e--ce538c62-b1f8-4a33-995f-e6026d415661.lovable.app-1778988194965.png" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" dir="rtl" toastOptions={{ style: { fontFamily: "inherit" } }} />
    </QueryClientProvider>
  );
}
