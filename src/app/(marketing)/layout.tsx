import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={Boolean(auth)} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
