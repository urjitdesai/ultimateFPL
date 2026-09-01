import type { ReactNode } from "react";
import { APP_NAME } from "../brand";
import { BrandLogo } from "./BrandLogo";
import { BrandPanel } from "./BrandPanel";

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-shell"><BrandPanel /><section className="form-stage"><div className="mobile-brand"><BrandLogo />{APP_NAME}</div>{children}</section></main>;
}
