function optionalTextEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export const APPLICATION_NAME = "Atuária Previdenciária";
export const APPLICATION_SLUG = "atuaria-previdenciaria";

export type PublicApplicationConfig = {
  name: string;
  shortName: string;
  organizationName: string | null;
};

export function getPublicApplicationConfig(): PublicApplicationConfig {
  return {
    name: APPLICATION_NAME,
    shortName: APPLICATION_NAME,
    organizationName: optionalTextEnv("APP_ORGANIZATION_NAME")
  };
}

export function getApplicationName() {
  return APPLICATION_NAME;
}
