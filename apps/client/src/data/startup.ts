export function initialMode(development: boolean, apiUrl: string | undefined) {
  return development && !apiUrl?.trim() ? "fixture" : "api";
}

export function apiConfiguration(value: string | undefined, platform: string) {
  const baseUrl = value?.trim() ?? "";
  if (!baseUrl) return { baseUrl: "", error: "missing" } as const;
  try {
    const url = new URL(baseUrl);
    const localWeb =
      platform === "web" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !localWeb) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid API URL");
    return { baseUrl: baseUrl.replace(/\/+$/, ""), error: null } as const;
  } catch {
    return { baseUrl: "", error: "invalid" } as const;
  }
}
