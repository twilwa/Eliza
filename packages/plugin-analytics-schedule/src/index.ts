/**
 * @elizaos/plugin-analytics-schedule
 *
 * A plugin for ElizaOS that polls platform analytics endpoints and proposes
 * optimal posting schedules based on engagement data.
 *
 * @example
 * ```typescript
 * import { analyticsSchedulePlugin } from '@elizaos/plugin-analytics-schedule';
 *
 * // Add to your agent's plugins
 * const agent = {
 *   plugins: [analyticsSchedulePlugin],
 *   settings: {
 *     ANALYTICS_API_ENDPOINT: 'https://your-api.com/analytics',
 *     ANALYTICS_API_KEY: 'your-api-key',
 *     ANALYTICS_POLL_INTERVAL_MS: '3600000', // 1 hour
 *   }
 * };
 * ```
 *
 * @packageDocumentation
 */

// Main plugin export
export { analyticsSchedulePlugin, analyticsSchedulePlugin as default } from './plugin';

// Service export for direct access
export { AnalyticsScheduleService } from './service';

// Actions export
export {
  proposeScheduleAction,
  refreshAnalyticsAction,
  analyticsStatusAction,
} from './action';

// Provider export
export { analyticsProvider } from './provider';

// Types export
export type {
  AnalyticsResponse,
  AnalyticsServiceConfig,
  ContentPerformance,
  EngagementByHour,
  PlatformMetrics,
  PostingSchedule,
  ScheduleRecommendation,
} from './types';

export {
  AnalyticsResponseSchema,
  ContentPerformanceSchema,
  EngagementByHourSchema,
  PlatformMetricsSchema,
  PostingScheduleSchema,
  ScheduleRecommendationSchema,
} from './types';
