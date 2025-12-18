import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from '@elizaos/core';
import { AnalyticsScheduleService } from './service';
import type { AnalyticsResponse } from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Formats analytics data into a human-readable context string for the LLM
 */
function formatAnalyticsContext(analytics: AnalyticsResponse): string {
  const sections: string[] = [];

  sections.push('# Platform Analytics Summary\n');

  // Period info
  if (analytics.period) {
    sections.push(`Data period: ${analytics.period.start} to ${analytics.period.end}\n`);
  }

  // Platform metrics
  if (analytics.platforms && analytics.platforms.length > 0) {
    sections.push('## Platform Metrics');
    for (const platform of analytics.platforms) {
      const metrics: string[] = [];
      if (platform.followers !== undefined) metrics.push(`Followers: ${platform.followers.toLocaleString()}`);
      if (platform.impressions !== undefined)
        metrics.push(`Impressions: ${platform.impressions.toLocaleString()}`);
      if (platform.engagements !== undefined)
        metrics.push(`Engagements: ${platform.engagements.toLocaleString()}`);
      if (platform.engagementRate !== undefined)
        metrics.push(`Engagement Rate: ${(platform.engagementRate * 100).toFixed(2)}%`);
      if (platform.reach !== undefined) metrics.push(`Reach: ${platform.reach.toLocaleString()}`);

      sections.push(`\n### ${platform.platform}`);
      sections.push(metrics.join(' | '));
    }
    sections.push('');
  }

  // Engagement by hour
  if (analytics.engagementByHour && analytics.engagementByHour.length > 0) {
    sections.push('## Best Performing Hours (by Engagement Rate)');
    const sortedHours = [...analytics.engagementByHour].sort(
      (a, b) => b.engagementRate - a.engagementRate
    );
    const topHours = sortedHours.slice(0, 5);

    for (const hourData of topHours) {
      const timeStr = `${hourData.hour.toString().padStart(2, '0')}:00`;
      const dayStr = hourData.dayOfWeek !== undefined ? ` (${DAY_NAMES[hourData.dayOfWeek]})` : '';
      sections.push(
        `- ${timeStr}${dayStr}: ${(hourData.engagementRate * 100).toFixed(2)}% engagement`
      );
    }
    sections.push('');
  }

  // Engagement by day of week
  if (analytics.engagementByDayOfWeek && analytics.engagementByDayOfWeek.length > 0) {
    sections.push('## Best Performing Days');
    const sortedDays = [...analytics.engagementByDayOfWeek].sort(
      (a, b) => b.avgEngagementRate - a.avgEngagementRate
    );

    for (const dayData of sortedDays) {
      const dayName = dayData.dayName || DAY_NAMES[dayData.dayOfWeek];
      sections.push(`- ${dayName}: ${(dayData.avgEngagementRate * 100).toFixed(2)}% avg engagement`);
    }
    sections.push('');
  }

  // Content performance
  if (analytics.contentPerformance && analytics.contentPerformance.length > 0) {
    sections.push('## Content Type Performance');
    const sortedContent = [...analytics.contentPerformance].sort(
      (a, b) => b.avgEngagementRate - a.avgEngagementRate
    );

    for (const content of sortedContent) {
      sections.push(
        `- ${content.contentType}: ${(content.avgEngagementRate * 100).toFixed(2)}% avg engagement (${content.postCount} posts)`
      );
    }
    sections.push('');
  }

  // Audience timezones
  if (analytics.audienceTimezones && analytics.audienceTimezones.length > 0) {
    sections.push('## Audience Timezone Distribution');
    const topTimezones = analytics.audienceTimezones.slice(0, 5);

    for (const tz of topTimezones) {
      sections.push(`- ${tz.timezone}: ${(tz.percentage * 100).toFixed(1)}%`);
    }
    sections.push('');
  }

  // Top performing posts
  if (analytics.topPerformingPosts && analytics.topPerformingPosts.length > 0) {
    sections.push('## Top Performing Posts');
    const topPosts = analytics.topPerformingPosts.slice(0, 3);

    for (const post of topPosts) {
      const preview = post.content ? post.content.substring(0, 100) + '...' : '[No preview]';
      sections.push(
        `- [${post.platform}] ${(post.engagementRate * 100).toFixed(2)}% engagement at ${post.postedAt}`
      );
      sections.push(`  "${preview}"`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Provider that supplies platform analytics context to the agent
 */
export const analyticsProvider: Provider = {
  name: 'ANALYTICS_PROVIDER',
  description: 'Provides platform analytics data and engagement insights for content scheduling decisions',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<ProviderResult> => {
    const service = runtime.getService<AnalyticsScheduleService>(
      AnalyticsScheduleService.serviceType
    );

    if (!service) {
      return {
        text: '',
        values: {},
        data: { analyticsAvailable: false },
      };
    }

    const status = service.getStatus();

    if (!status.configured) {
      return {
        text: 'Analytics service is not configured. Set ANALYTICS_API_ENDPOINT to enable analytics-based scheduling.',
        values: { analyticsConfigured: false },
        data: { analyticsAvailable: false, status },
      };
    }

    const analytics = service.getLatestAnalytics();

    if (!analytics) {
      const errorMsg = status.error
        ? `Analytics data unavailable: ${status.error}`
        : 'No analytics data available yet. Data will be fetched from the configured endpoint.';

      return {
        text: errorMsg,
        values: { analyticsAvailable: false, hasError: !!status.error },
        data: { analyticsAvailable: false, status },
      };
    }

    const formattedContext = formatAnalyticsContext(analytics);

    return {
      text: formattedContext,
      values: {
        analyticsAvailable: true,
        lastFetch: status.lastFetch,
        platformCount: analytics.platforms?.length ?? 0,
      },
      data: {
        analyticsAvailable: true,
        analytics,
        status,
      },
    };
  },
};
