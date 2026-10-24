import Link from "next/link";
import { Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="cp-grid-bg flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/"><Logo /></Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-8">
        <div className="w-full max-w-md">
          <div className="cp-card p-6 md:p-8">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <div className="mt-4 text-center text-xs text-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
