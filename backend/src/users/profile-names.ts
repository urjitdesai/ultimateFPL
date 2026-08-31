type ProfileNameData = {
  firstName?: unknown;
  lastName?: unknown;
  managerName?: unknown;
  displayName?: unknown;
  userName?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function publicProfileNames(data: ProfileNameData | undefined) {
  const firstName = text(data?.firstName);
  const lastName = text(data?.lastName);
  const managerName = text(data?.managerName) || text(data?.displayName) || "UFL Player";
  const userName = [firstName, lastName].filter(Boolean).join(" ") || text(data?.userName) || managerName;

  return {
    firstName,
    lastName,
    managerName,
    userName,
    displayName: managerName,
  };
}
