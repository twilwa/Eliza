import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';

import { proposeScheduleAction, refreshAnalyticsAction, analyticsStatusAction } from './action';
import { analyticsProvider } from './provider';
import { AnalyticsScheduleService } from './service';

/**
 * Configuration schema for the analytics schedule plugin
 */
const configSchema = z.object({
  ANALYTICS_API_ENDPOINT: z
    .string()
    .url('ANALYTICS_API_ENDPOINT must be a valid URL')
    .optional()
    .transform((val) => {
      if (!val) {
        logger.warn(
          '[AnalyticsSchedule] ANALYTICS_API_ENDPOINT not configured - plugin will be inactive until set'
        );
      }
      return val;
    }),
  ANALYTICS_API_KEY: z.string().optional(),
  ANALYTICS_POLL_INTERVAL_MS: z
    .string()
    .optional()
    .transform((val) => {
      if (val) {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 60000) {
          logger.warn(
            '[AnalyticsSchedule] ANALYTICS_POLL_INTERVAL_MS must be at least 60000ms (1 minute), using default'
          );
          return undefined;
        }
        return val;
      }
      return undefined;
    }),
});

/**
 * Analytics Schedule Plugin
 *
 * This plugin polls an external analytics endpoint for platform engagement data
 * and uses that data to propose optimal posting schedules.
 *
 * Features:
 * - Periodic polling of analytics endpoints
 * - Analytics data provider for LLM context
 * - Schedule recommendation action based on engagement patterns
 * - Manual refresh and status check actions
 *
 * Configuration (environment variables or agent settings):
 * - ANALYTICS_API_ENDPOINT: URL to poll for analytics data (required)
 * - ANALYTICS_API_KEY: API key for authentication (optional)
 * - ANALYTICS_POLL_INTERVAL_MS: Polling interval in ms (default: 3600000 = 1 hour)
 *
 * Expected Analytics Response Format:
 * ```json
 * {
 *   "timestamp": "2024-01-15T10:00:00Z",
 *   "platforms": [{ "platform": "twitter", "followers": 10000, "engagementRate": 0.05 }],
 *   "engagementByHour": [{ "hour": 9, "engagementRate": 0.08 }],
 *   "engagementByDayOfWeek": [{ "dayOfWeek": 1, "avgEngagementRate": 0.06 }],
 *   "contentPerformance": [{ "contentType": "video", "avgEngagementRate": 0.12, "postCount": 50 }]
 * }
 * ```
 */
export const analyticsSchedulePlugin: Plugin = {
  name: 'plugin-analytics-schedule',
  description:
    'Polls platform analytics endpoints and proposes optimal posting schedules based on engagement data',

  config: {
    ANALYTICS_API_ENDPOINT: process.env.ANALYTICS_API_ENDPOINT,
    ANALYTICS_API_KEY: process.env.ANALYTICS_API_KEY,
    ANALYTICS_POLL_INTERVAL_MS: process.env.ANALYTICS_POLL_INTERVAL_MS,
  },

  async init(config: Record<string, string>) {
    logger.info('[AnalyticsSchedule] Initializing plugin');

    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set validated environment variables
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) {
          process.env[key] = value;
        }
      }

      logger.info('[AnalyticsSchedule] Plugin initialized successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },

  services: [AnalyticsScheduleService],

  actions: [proposeScheduleAction, refreshAnalyticsAction, analyticsStatusAction],

  providers: [analyticsProvider],

  routes: [
    {
      name: 'analytics-status',
      path: '/analytics/status',
      type: 'GET',
      handler: async (req: { runtime?: { getService?: (type: string) => AnalyticsScheduleService | null } }, res: { json: (data: unknown) => void }) => {
        const runtime = req.runtime;
        if (!runtime?.getService) {
          res.json({ error: 'Runtime not available' });
          return;
        }

        const service = runtime.getService(AnalyticsScheduleService.serviceType);
        if (!service) {
          res.json({ error: 'Analytics service not available' });
          return;
        }

        res.json(service.getStatus());
      },
    },
    {
      name: 'analytics-data',
      path: '/analytics/data',
      type: 'GET',
      handler: async (req: { runtime?: { getService?: (type: string) => AnalyticsScheduleService | null } }, res: { json: (data: unknown) => void }) => {
        const runtime = req.runtime;
        if (!runtime?.getService) {
          res.json({ error: 'Runtime not available' });
          return;
        }

        const service = runtime.getService(AnalyticsScheduleService.serviceType);
        if (!service) {
          res.json({ error: 'Analytics service not available' });
          return;
        }

        const analytics = service.getLatestAnalytics();
        res.json({
          lastFetch: service.getLastFetchTime()?.toISOString() ?? null,
          data: analytics,
        });
      },
    },
    {
      name: 'analytics-refresh',
      path: '/analytics/refresh',
      type: 'POST',
      handler: async (req: { runtime?: { getService?: (type: string) => AnalyticsScheduleService | null } }, res: { json: (data: unknown) => void }) => {
        const runtime = req.runtime;
        if (!runtime?.getService) {
          res.json({ error: 'Runtime not available' });
          return;
        }

        const service = runtime.getService(AnalyticsScheduleService.serviceType);
        if (!service) {
          res.json({ error: 'Analytics service not available' });
          return;
        }

        const analytics = await service.refresh();
        res.json({
          success: !!analytics,
          lastFetch: service.getLastFetchTime()?.toISOString() ?? null,
          status: service.getStatus(),
        });
      },
    },
  ],
};

export default analyticsSchedulePlugin;
