import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { navigate } from "./navigation";

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    if (path === "/" || !["/register", "/login", "/dashboard"].includes(path)) navigate("/register", true);
    return () => window.removeEventListener("popstate", update);
  }, [path]);
  if (path === "/login") return <LoginPage />;
  if (path === "/dashboard") return <HomePage />;
  return <RegisterPage />;
}
