import { z } from 'zod';

/**
 * Schema for platform analytics data
 */
export const PlatformMetricsSchema = z.object({
  platform: z.string(),
  followers: z.number().optional(),
  impressions: z.number().optional(),
  engagements: z.number().optional(),
  engagementRate: z.number().optional(),
  reach: z.number().optional(),
  clicks: z.number().optional(),
  shares: z.number().optional(),
  comments: z.number().optional(),
  likes: z.number().optional(),
  saves: z.number().optional(),
});

export type PlatformMetrics = z.infer<typeof PlatformMetricsSchema>;

/**
 * Schema for time-based engagement data
 */
export const EngagementByHourSchema = z.object({
  hour: z.number().min(0).max(23),
  dayOfWeek: z.number().min(0).max(6).optional(), // 0 = Sunday, 6 = Saturday
  engagementRate: z.number(),
  impressions: z.number().optional(),
  posts: z.number().optional(),
});

export type EngagementByHour = z.infer<typeof EngagementByHourSchema>;

/**
 * Schema for content performance data
 */
export const ContentPerformanceSchema = z.object({
  contentType: z.string(), // e.g., 'image', 'video', 'text', 'carousel', 'link'
  avgEngagementRate: z.number(),
  avgImpressions: z.number().optional(),
  avgReach: z.number().optional(),
  postCount: z.number(),
});

export type ContentPerformance = z.infer<typeof ContentPerformanceSchema>;

/**
 * Schema for the full analytics response from the endpoint
 */
export const AnalyticsResponseSchema = z.object({
  timestamp: z.string().or(z.number()),
  period: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  platforms: z.array(PlatformMetricsSchema).optional(),
  engagementByHour: z.array(EngagementByHourSchema).optional(),
  engagementByDayOfWeek: z
    .array(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        dayName: z.string().optional(),
        avgEngagementRate: z.number(),
        avgImpressions: z.number().optional(),
      })
    )
    .optional(),
  contentPerformance: z.array(ContentPerformanceSchema).optional(),
  audienceTimezones: z
    .array(
      z.object({
        timezone: z.string(),
        percentage: z.number(),
      })
    )
    .optional(),
  topPerformingPosts: z
    .array(
      z.object({
        id: z.string(),
        platform: z.string(),
        content: z.string().optional(),
        engagementRate: z.number(),
        impressions: z.number().optional(),
        postedAt: z.string(),
      })
    )
    .optional(),
});

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

/**
 * Schema for recommended posting schedule
 */
export const PostingScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  dayName: z.string(),
  timeSlots: z.array(
    z.object({
      hour: z.number().min(0).max(23),
      minute: z.number().min(0).max(59).default(0),
      priority: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    })
  ),
  recommendedPostCount: z.number(),
});

export type PostingSchedule = z.infer<typeof PostingScheduleSchema>;

/**
 * Full schedule recommendation
 */
export const ScheduleRecommendationSchema = z.object({
  generatedAt: z.string(),
  weeklySchedule: z.array(PostingScheduleSchema),
  contentMix: z
    .object({
      recommendations: z.array(
        z.object({
          contentType: z.string(),
          percentage: z.number(),
          reasoning: z.string(),
        })
      ),
    })
    .optional(),
  overallStrategy: z.string().optional(),
  caveats: z.array(z.string()).optional(),
});

export type ScheduleRecommendation = z.infer<typeof ScheduleRecommendationSchema>;

/**
 * Configuration for the analytics service
 */
export interface AnalyticsServiceConfig {
  endpoint: string;
  apiKey?: string;
  pollIntervalMs: number;
  headers?: Record<string, string>;
}
