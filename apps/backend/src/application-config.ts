function textEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function optionalTextEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export type PublicApplicationConfig = {
  name: string;
  shortName: string;
  organizationName: string | null;
};

export function getPublicApplicationConfig(): PublicApplicationConfig {
  return {
    name: textEnv("APP_NAME", "Plataforma Atuarial"),
    shortName: textEnv("APP_SHORT_NAME", "Atuária"),
    organizationName: optionalTextEnv("APP_ORGANIZATION_NAME")
  };
}

export function getApplicationName() {
  return getPublicApplicationConfig().name;
}
