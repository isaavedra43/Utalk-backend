/**
 * 📈 COPILOT METRICS SERVICE
 *
 * Recolecta métricas de performance, uso y calidad (in-memory)
 * y genera reportes simples para observabilidad.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

class CopilotMetricsService {
  constructor() {
    this.reset();
  }

  reset() {
    this.counters = {
      totalRequests: 0,
      totalSuccess: 0,
      totalFailures: 0,
      totalLatencyMs: 0,
      perAgentUsage: new Map(), // agentId -> { uses, features: Map }
      accuracySamples: [] // { userMessageLen, responseLen, feedbackScore }
    };
  }

  async trackResponseTime(startTime, endTime, ok = true) {
    try {
      const latency = Math.max(0, (endTime - startTime));
      this.counters.totalRequests += 1;
      this.counters.totalLatencyMs += latency;
      if (ok) this.counters.totalSuccess += 1; else this.counters.totalFailures += 1;
      return latency;
    } catch (_) { /* noop */ }
  }

  async trackAccuracy(userMessage, response, feedback = null) {
    try {
      // feedback esperado: { score: 0..1 } (opcional)
      const sample = {
        userMessageLen: (userMessage || '').length,
        responseLen: (response || '').length,
        feedbackScore: typeof feedback?.score === 'number' ? feedback.score : null
      };
      this.counters.accuracySamples.push(sample);
    } catch (_) { /* noop */ }
  }

  async trackUsage(agentId, feature = 'chat') {
    try {
      if (!agentId) return;
      if (!this.counters.perAgentUsage.has(agentId)) {
        this.counters.perAgentUsage.set(agentId, { uses: 0, features: new Map() });
      }
      const rec = this.counters.perAgentUsage.get(agentId);
      rec.uses += 1;
      rec.features.set(feature, (rec.features.get(feature) || 0) + 1);
      this.counters.perAgentUsage.set(agentId, rec);
    } catch (_) { /* noop */ }
  }

  async generatePerformanceReport() {
    const avgLatency = this.counters.totalRequests > 0
      ? Math.round(this.counters.totalLatencyMs / this.counters.totalRequests)
      : 0;
    const successRate = this.counters.totalRequests > 0
      ? Math.round((this.counters.totalSuccess / this.counters.totalRequests) * 100)
      : 0;

    const agents = Array.from(this.counters.perAgentUsage.entries()).map(([agentId, rec]) => ({
      agentId,
      uses: rec.uses,
      features: Array.from(rec.features.entries()).map(([f, n]) => ({ feature: f, count: n }))
    }));

    const lastAccuracySamples = this.counters.accuracySamples.slice(-50);
    const avgFeedback = lastAccuracySamples
      .filter(s => typeof s.feedbackScore === 'number')
      .reduce((acc, s, _, arr) => acc + s.feedbackScore / arr.length, 0) || null;

    return {
      totals: {
        requests: this.counters.totalRequests,
        success: this.counters.totalSuccess,
        failures: this.counters.totalFailures
      },
      latency: { avgMs: avgLatency },
      successRate,
      usageByAgent: agents,
      quality: { avgFeedback }
    };
  }
}

// Singleton
const copilotMetricsService = new CopilotMetricsService();

module.exports = {
  CopilotMetricsService,
  copilotMetricsService
};
