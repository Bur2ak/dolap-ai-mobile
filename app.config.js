module.exports = ({ config }) => {
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  const sentryOrganization = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const extra = {
    ...config.extra,
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? config.extra?.siteUrl ?? "https://shipirio.com",
  };

  if (easProjectId) {
    extra.eas = {
      ...config.extra?.eas,
      projectId: easProjectId,
    };
  }

  return {
    ...config,
    plugins: configureSentryPlugin(config.plugins, sentryOrganization, sentryProject),
    extra,
  };
};

function configureSentryPlugin(plugins = [], organization, project) {
  if (!organization || !project) {
    return plugins;
  }

  return plugins.map((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    if (pluginName !== "@sentry/react-native" && pluginName !== "@sentry/react-native/expo") {
      return plugin;
    }

    const existingOptions = Array.isArray(plugin) && typeof plugin[1] === "object" ? plugin[1] : {};
    const options = {
      ...existingOptions,
      organization,
      project,
    };
    if (process.env.SENTRY_URL ?? existingOptions.url) {
      options.url = process.env.SENTRY_URL ?? existingOptions.url;
    }

    return [
      "@sentry/react-native/expo",
      options,
    ];
  });
}
