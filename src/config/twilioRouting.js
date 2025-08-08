const fs = require('fs');
const path = require('path');
const { normalizePhoneNumber } = require('../utils/conversation');

/**
 * Carga configuración de routing desde JSON si existe
 */
function loadRoutingConfig() {
  try {
    const configuredPath = process.env.TWILIO_ROUTING_PATH || path.join(process.cwd(), 'config', 'twilioRouting.json');
    if (fs.existsSync(configuredPath)) {
      const raw = fs.readFileSync(configuredPath, 'utf8');
      const json = JSON.parse(raw);
      return json && typeof json === 'object' ? json : null;
    }
  } catch (_) {
    // Ignorar errores de lectura/parseo, se usará fallback ENV
  }
  return null;
}

/**
 * Resuelve workspaceId/tenantId/agentEmail a partir del número destino/origen de Twilio
 * @param {{ toPhone?: string, fromPhone?: string }} params
 * @returns {{ workspaceId?: string, tenantId?: string, agentEmail?: string } | null}
 */
function resolveRouting({ toPhone, fromPhone }) {
  const cfg = loadRoutingConfig();
  const toNorm = normalizePhoneNumber(toPhone || '') || toPhone || '';
  const fromNorm = normalizePhoneNumber(fromPhone || '') || fromPhone || '';

  // 1) Intentar por archivo de configuración
  if (cfg) {
    // Estructura esperada: { "+123...": { workspaceId, tenantId, agentEmail }, ... }
    if (toNorm && cfg[toNorm]) return cfg[toNorm];
    if (fromNorm && cfg[fromNorm]) return cfg[fromNorm];
    // Alternativas por clave sin normalizar
    if (toPhone && cfg[toPhone]) return cfg[toPhone];
    if (fromPhone && cfg[fromPhone]) return cfg[fromPhone];
  }

  // 2) Fallback por ENV simples (para un solo workspace/tenant)
  const envWorkspaceId = process.env.WORKSPACE_ID || process.env.DEFAULT_WORKSPACE_ID || null;
  const envTenantId = process.env.TENANT_ID || process.env.DEFAULT_TENANT_ID || null;
  const envAgentEmail = process.env.DEFAULT_AGENT_EMAIL || null;

  if (envWorkspaceId || envTenantId || envAgentEmail) {
    return {
      workspaceId: envWorkspaceId || undefined,
      tenantId: envTenantId || undefined,
      agentEmail: envAgentEmail || undefined
    };
  }

  // 3) Sin datos
  return null;
}

module.exports = { resolveRouting }; 