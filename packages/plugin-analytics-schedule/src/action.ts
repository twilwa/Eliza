import {
  logger,
  ModelType,
  type Action,
  type ActionResult,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from '@elizaos/core';
import { AnalyticsScheduleService } from './service';
import type { AnalyticsResponse, ScheduleRecommendation } from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Builds the schedule recommendation prompt based on analytics data
 */
function buildSchedulePrompt(analytics: AnalyticsResponse): string {
  const sections: string[] = [];

  sections.push(
    'Based on the following platform analytics data, create a detailed posting schedule recommendation:\n'
  );

  // Include engagement by hour data
  if (analytics.engagementByHour && analytics.engagementByHour.length > 0) {
    sections.push('## Engagement by Hour:');
    for (const h of analytics.engagementByHour) {
      const dayStr = h.dayOfWeek !== undefined ? ` (${DAY_NAMES[h.dayOfWeek]})` : '';
      sections.push(`- Hour ${h.hour}${dayStr}: ${(h.engagementRate * 100).toFixed(2)}% engagement`);
    }
    sections.push('');
  }

  // Include engagement by day data
  if (analytics.engagementByDayOfWeek && analytics.engagementByDayOfWeek.length > 0) {
    sections.push('## Engagement by Day of Week:');
    for (const d of analytics.engagementByDayOfWeek) {
      const dayName = d.dayName || DAY_NAMES[d.dayOfWeek];
      sections.push(`- ${dayName}: ${(d.avgEngagementRate * 100).toFixed(2)}% avg engagement`);
    }
    sections.push('');
  }

  // Include content performance
  if (analytics.contentPerformance && analytics.contentPerformance.length > 0) {
    sections.push('## Content Type Performance:');
    for (const c of analytics.contentPerformance) {
      sections.push(
        `- ${c.contentType}: ${(c.avgEngagementRate * 100).toFixed(2)}% engagement (${c.postCount} posts)`
      );
    }
    sections.push('');
  }

  // Include audience timezones
  if (analytics.audienceTimezones && analytics.audienceTimezones.length > 0) {
    sections.push('## Primary Audience Timezones:');
    for (const tz of analytics.audienceTimezones.slice(0, 3)) {
      sections.push(`- ${tz.timezone}: ${(tz.percentage * 100).toFixed(1)}%`);
    }
    sections.push('');
  }

  sections.push(`
Please provide a weekly posting schedule recommendation with:
1. Best times to post for each day of the week (specify hour in 24h format)
2. Priority level for each time slot (high, medium, low)
3. Recommended number of posts per day
4. Content type mix recommendations
5. Overall strategy summary
6. Any caveats or considerations

Format the response as a clear, actionable schedule.`);

  return sections.join('\n');
}

/**
 * Parses the LLM response into a structured schedule format
 */
function formatScheduleResponse(llmResponse: string, analytics: AnalyticsResponse): string {
  // The LLM response is already formatted for human consumption
  // Add a header and timestamp
  const timestamp = new Date().toISOString();
  return `# Posting Schedule Recommendation
Generated: ${timestamp}

Based on your platform analytics data:
- Data points analyzed: ${analytics.engagementByHour?.length ?? 0} hourly records
- Days analyzed: ${analytics.engagementByDayOfWeek?.length ?? 0}
- Content types analyzed: ${analytics.contentPerformance?.length ?? 0}

---

${llmResponse}

---
*This recommendation is based on historical engagement patterns. Actual results may vary based on content quality, audience growth, and external factors.*`;
}

/**
 * Action that proposes a posting schedule based on analytics data
 */
export const proposeScheduleAction: Action = {
  name: 'PROPOSE_POSTING_SCHEDULE',
  similes: [
    'SUGGEST_SCHEDULE',
    'RECOMMEND_POSTING_TIMES',
    'CREATE_CONTENT_CALENDAR',
    'OPTIMIZE_POSTING',
    'SCHEDULE_RECOMMENDATION',
    'BEST_TIMES_TO_POST',
  ],
  description:
    'Analyzes platform analytics data and proposes an optimal posting schedule with recommended times and content cadence',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const service = runtime.getService<AnalyticsScheduleService>(
      AnalyticsScheduleService.serviceType
    );

    if (!service) {
      logger.debug('[ProposeSchedule] Analytics service not available');
      return false;
    }

    // Check if we have analytics data or can fetch it
    if (!service.isConfigured()) {
      logger.debug('[ProposeSchedule] Analytics service not configured');
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<AnalyticsScheduleService>(
        AnalyticsScheduleService.serviceType
      );

      if (!service) {
        const errorMsg = 'Analytics service is not available. Please ensure the plugin is properly configured.';
        if (callback) {
          await callback({
            text: errorMsg,
            actions: ['PROPOSE_POSTING_SCHEDULE'],
            source: message.content.source,
          });
        }
        return {
          success: false,
          error: new Error(errorMsg),
        };
      }

      // Get or refresh analytics data
      let analytics = service.getLatestAnalytics();

      if (!analytics) {
        // Try to fetch fresh data
        if (callback) {
          await callback({
            text: 'Fetching latest analytics data...',
            actions: ['PROPOSE_POSTING_SCHEDULE'],
            source: message.content.source,
          });
        }

        analytics = await service.refresh();

        if (!analytics) {
          const status = service.getStatus();
          const errorMsg = status.error
            ? `Failed to fetch analytics: ${status.error}`
            : 'No analytics data available. Please check the endpoint configuration.';

          if (callback) {
            await callback({
              text: errorMsg,
              actions: ['PROPOSE_POSTING_SCHEDULE'],
              source: message.content.source,
            });
          }
          return {
            success: false,
            error: new Error(errorMsg),
          };
        }
      }

      // Build the prompt for schedule generation
      const schedulePrompt = buildSchedulePrompt(analytics);

      // Generate schedule recommendation using LLM
      logger.debug('[ProposeSchedule] Generating schedule recommendation');

      const llmResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: schedulePrompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      if (!llmResponse || typeof llmResponse !== 'string') {
        throw new Error('Failed to generate schedule recommendation');
      }

      // Format the final response
      const formattedSchedule = formatScheduleResponse(llmResponse, analytics);

      if (callback) {
        await callback({
          text: formattedSchedule,
          actions: ['PROPOSE_POSTING_SCHEDULE'],
          source: message.content.source,
        });
      }

      return {
        success: true,
        text: formattedSchedule,
        data: {
          action: 'PROPOSE_POSTING_SCHEDULE',
          analytics: {
            lastFetch: service.getLastFetchTime()?.toISOString(),
            platformCount: analytics.platforms?.length ?? 0,
            dataPoints: analytics.engagementByHour?.length ?? 0,
          },
        },
      };
    } catch (error) {
      logger.error({ error }, '[ProposeSchedule] Error generating schedule');

      const errorMsg =
        error instanceof Error ? error.message : 'An unexpected error occurred generating the schedule';

      if (callback) {
        await callback({
          text: `Error generating schedule: ${errorMsg}`,
          actions: ['PROPOSE_POSTING_SCHEDULE'],
          source: message.content.source,
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Can you suggest the best times to post on social media?',
          actions: [],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: `# Posting Schedule Recommendation
Generated: 2024-01-15T10:00:00Z

Based on your platform analytics:

## Weekly Schedule

### Monday
- 09:00 (High Priority) - Peak morning engagement
- 13:00 (Medium Priority) - Lunch break activity
- 18:00 (High Priority) - Post-work peak

### Tuesday
- 08:00 (High Priority) - Early morning audience
- 12:00 (Medium Priority) - Midday break

...

## Content Mix
- Video content: 40% (highest engagement)
- Image posts: 35%
- Text/Link posts: 25%

## Strategy
Focus on morning and evening peak times when audience engagement is highest.`,
          actions: ['PROPOSE_POSTING_SCHEDULE'],
        },
      },
    ],
    [
      {
        name: '{{userName}}',
        content: {
          text: 'What posting schedule would you recommend based on my analytics?',
          actions: [],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Based on your engagement data, I recommend posting during these optimal windows...',
          actions: ['PROPOSE_POSTING_SCHEDULE'],
        },
      },
    ],
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Help me create a content calendar',
          actions: [],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: "I'll analyze your analytics and create a content calendar recommendation...",
          actions: ['PROPOSE_POSTING_SCHEDULE'],
        },
      },
    ],
  ],
};

/**
 * Action to refresh analytics data manually
 */
export const refreshAnalyticsAction: Action = {
  name: 'REFRESH_ANALYTICS',
  similes: ['UPDATE_ANALYTICS', 'FETCH_ANALYTICS', 'SYNC_ANALYTICS'],
  description: 'Manually refreshes the analytics data from the configured endpoint',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const service = runtime.getService<AnalyticsScheduleService>(
      AnalyticsScheduleService.serviceType
    );
    return !!service?.isConfigured();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<AnalyticsScheduleService>(
        AnalyticsScheduleService.serviceType
      );

      if (!service) {
        const errorMsg = 'Analytics service not available';
        if (callback) {
          await callback({
            text: errorMsg,
            actions: ['REFRESH_ANALYTICS'],
            source: message.content.source,
          });
        }
        return { success: false, error: new Error(errorMsg) };
      }

      const analytics = await service.refresh();

      if (analytics) {
        const status = service.getStatus();
        const successMsg = `Analytics data refreshed successfully at ${status.lastFetch}. Found ${analytics.platforms?.length ?? 0} platforms with ${analytics.engagementByHour?.length ?? 0} hourly data points.`;

        if (callback) {
          await callback({
            text: successMsg,
            actions: ['REFRESH_ANALYTICS'],
            source: message.content.source,
          });
        }

        return {
          success: true,
          text: successMsg,
          data: { analytics },
        };
      } else {
        const status = service.getStatus();
        const errorMsg = status.error
          ? `Failed to refresh analytics: ${status.error}`
          : 'Failed to fetch analytics data';

        if (callback) {
          await callback({
            text: errorMsg,
            actions: ['REFRESH_ANALYTICS'],
            source: message.content.source,
          });
        }

        return { success: false, error: new Error(errorMsg) };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (callback) {
        await callback({
          text: `Error refreshing analytics: ${errorMsg}`,
          actions: ['REFRESH_ANALYTICS'],
          source: message.content.source,
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Refresh my analytics data',
          actions: [],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Analytics data refreshed successfully at 2024-01-15T10:00:00Z. Found 3 platforms with 168 hourly data points.',
          actions: ['REFRESH_ANALYTICS'],
        },
      },
    ],
  ],
};

/**
 * Action to check analytics service status
 */
export const analyticsStatusAction: Action = {
  name: 'ANALYTICS_STATUS',
  similes: ['CHECK_ANALYTICS', 'ANALYTICS_INFO', 'ANALYTICS_HEALTH'],
  description: 'Checks the status of the analytics service and displays configuration info',

  validate: async (): Promise<boolean> => {
    return true; // Always valid - even if not configured, we report that
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<AnalyticsScheduleService>(
      AnalyticsScheduleService.serviceType
    );

    if (!service) {
      const msg =
        'Analytics service is not loaded. Ensure the plugin-analytics-schedule plugin is added to your agent configuration.';
      if (callback) {
        await callback({
          text: msg,
          actions: ['ANALYTICS_STATUS'],
          source: message.content.source,
        });
      }
      return {
        success: true,
        text: msg,
        data: { available: false },
      };
    }

    const status = service.getStatus();

    const statusLines = [
      '# Analytics Service Status',
      '',
      `**Configured:** ${status.configured ? 'Yes' : 'No'}`,
    ];

    if (status.configured) {
      statusLines.push(`**Endpoint:** ${status.endpoint}`);
      statusLines.push(`**Last Fetch:** ${status.lastFetch ?? 'Never'}`);
      statusLines.push(`**Has Data:** ${status.hasData ? 'Yes' : 'No'}`);

      if (status.error) {
        statusLines.push(`**Error:** ${status.error}`);
      }
    } else {
      statusLines.push('');
      statusLines.push(
        'To configure, set `ANALYTICS_API_ENDPOINT` in your environment or agent settings.'
      );
    }

    const statusText = statusLines.join('\n');

    if (callback) {
      await callback({
        text: statusText,
        actions: ['ANALYTICS_STATUS'],
        source: message.content.source,
      });
    }

    return {
      success: true,
      text: statusText,
      data: { status },
    };
  },

  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'What is the status of my analytics?',
          actions: [],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: `# Analytics Service Status

**Configured:** Yes
**Endpoint:** https://api.example.com/analytics
**Last Fetch:** 2024-01-15T10:00:00Z
**Has Data:** Yes`,
          actions: ['ANALYTICS_STATUS'],
        },
      },
    ],
  ],
};
