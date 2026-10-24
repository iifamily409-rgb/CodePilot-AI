/** Safe, public representation of a provider row: never includes secrets. */
export function publicProvider(
  provider: any,
  modelCounts?: Record<string, { total: number; eligible: number }>,
) {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.base_url,
    authType: provider.auth_type,
    hasApiKey: Boolean(provider.api_key_enc),
    hasCustomHeaders: Boolean(provider.headers_enc),
    enabled: Boolean(provider.enabled),
    lastCheckAt: provider.last_check_at,
    lastCheckOk: provider.last_check_ok === null ? null : Boolean(provider.last_check_ok),
    lastCheckMessage: provider.last_check_message,
    modelCounts: modelCounts?.[provider.id] ?? { total: 0, eligible: 0 },
    createdAt: provider.created_at,
  };
}
