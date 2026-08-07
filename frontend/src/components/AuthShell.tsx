import type { ReactNode } from "react";
import { BrandPanel } from "./BrandPanel";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-shell"><BrandPanel /><section className="form-stage"><div className="mobile-brand">Ultimate Fantasy League</div>{children}</section></main>;
}
