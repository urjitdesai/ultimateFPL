export function googleProfileNameDefaults(displayName: string | null, email: string | null) {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    firstName: parts.shift() ?? email?.split("@")[0]?.trim() ?? "",
    lastName: parts.join(" "),
  };
}
