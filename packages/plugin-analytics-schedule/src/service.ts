import { logger, Service, type IAgentRuntime, type Task } from '@elizaos/core';
import { AnalyticsResponseSchema, type AnalyticsResponse, type AnalyticsServiceConfig } from './types';

const TASK_NAME = 'ANALYTICS_POLL_TASK';
const DEFAULT_POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Service that polls an external analytics endpoint for platform data
 * and provides schedule recommendations based on engagement patterns
 */
export class AnalyticsScheduleService extends Service {
  static serviceType = 'analytics-schedule';
  capabilityDescription =
    'Polls platform analytics endpoints and provides posting schedule recommendations based on engagement data';

  private config: AnalyticsServiceConfig | null = null;
  private latestAnalytics: AnalyticsResponse | null = null;
  private lastFetchTime: Date | null = null;
  private fetchError: Error | null = null;

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }

  /**
   * Starts the analytics service and registers polling task
   */
  static async start(runtime: IAgentRuntime): Promise<Service> {
    logger.info('[AnalyticsSchedule] Starting analytics schedule service');
    const service = new AnalyticsScheduleService(runtime);

    // Load configuration from environment/settings
    const endpoint =
      runtime.getSetting('ANALYTICS_API_ENDPOINT') || process.env.ANALYTICS_API_ENDPOINT;
    const apiKey = runtime.getSetting('ANALYTICS_API_KEY') || process.env.ANALYTICS_API_KEY;
    const pollIntervalStr =
      runtime.getSetting('ANALYTICS_POLL_INTERVAL_MS') || process.env.ANALYTICS_POLL_INTERVAL_MS;

    if (endpoint) {
      service.config = {
        endpoint,
        apiKey: apiKey || undefined,
        pollIntervalMs: pollIntervalStr ? parseInt(pollIntervalStr, 10) : DEFAULT_POLL_INTERVAL_MS,
      };

      // Register the task worker for polling
      await service.registerPollingTask();

      // Do initial fetch
      await service.fetchAnalytics();
    } else {
      logger.warn(
        '[AnalyticsSchedule] No ANALYTICS_API_ENDPOINT configured - service will be inactive until configured'
      );
    }

    return service;
  }

  /**
   * Stops the analytics service
   */
  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('[AnalyticsSchedule] Stopping analytics schedule service');
    const service = runtime.getService(AnalyticsScheduleService.serviceType);
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {
    logger.info('[AnalyticsSchedule] Service stopped');
    // Clean up any tasks
    const tasks = await this.runtime.getTasksByName(TASK_NAME);
    for (const task of tasks) {
      if (task.id) {
        await this.runtime.deleteTask(task.id);
      }
    }
  }

  /**
   * Configure the service with a new endpoint
   */
  async configure(config: Partial<AnalyticsServiceConfig>): Promise<void> {
    if (!config.endpoint && !this.config?.endpoint) {
      throw new Error('Analytics endpoint is required');
    }

    this.config = {
      endpoint: config.endpoint || this.config!.endpoint,
      apiKey: config.apiKey ?? this.config?.apiKey,
      pollIntervalMs: config.pollIntervalMs ?? this.config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      headers: config.headers ?? this.config?.headers,
    };

    // Re-register task with new interval
    await this.registerPollingTask();

    // Fetch immediately with new config
    await this.fetchAnalytics();
  }

  /**
   * Register the polling task worker
   */
  private async registerPollingTask(): Promise<void> {
    // Register task worker
    this.runtime.registerTaskWorker({
      name: TASK_NAME,
      validate: async () => {
        // Only valid if we have a configured endpoint
        return !!this.config?.endpoint;
      },
      execute: async () => {
        await this.fetchAnalytics();
      },
    });

    // Check if task already exists
    const existingTasks = await this.runtime.getTasksByName(TASK_NAME);

    if (existingTasks.length === 0) {
      // Create repeating task
      await this.runtime.createTask({
        name: TASK_NAME,
        description: 'Polls analytics endpoint for platform data',
        metadata: {
          updatedAt: Date.now(),
          updateInterval: this.config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        },
        tags: ['queue', 'repeat'],
      });
      logger.info(
        `[AnalyticsSchedule] Created polling task with interval: ${this.config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS}ms`
      );
    } else {
      // Update existing task interval if needed
      const task = existingTasks[0];
      if (task.id && task.metadata?.updateInterval !== this.config?.pollIntervalMs) {
        await this.runtime.updateTask(task.id, {
          metadata: {
            ...task.metadata,
            updateInterval: this.config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          },
        });
      }
    }
  }

  /**
   * Fetch analytics from the configured endpoint
   */
  async fetchAnalytics(): Promise<AnalyticsResponse | null> {
    if (!this.config?.endpoint) {
      logger.warn('[AnalyticsSchedule] No endpoint configured, skipping fetch');
      return null;
    }

    try {
      logger.debug(`[AnalyticsSchedule] Fetching analytics from ${this.config.endpoint}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response against schema
      const validated = AnalyticsResponseSchema.safeParse(data);

      if (!validated.success) {
        logger.warn(
          { errors: validated.error.errors },
          '[AnalyticsSchedule] Analytics response validation failed, using raw data'
        );
        // Store raw data if validation fails but response was received
        this.latestAnalytics = data as AnalyticsResponse;
      } else {
        this.latestAnalytics = validated.data;
      }

      this.lastFetchTime = new Date();
      this.fetchError = null;

      logger.info(
        `[AnalyticsSchedule] Successfully fetched analytics data at ${this.lastFetchTime.toISOString()}`
      );

      return this.latestAnalytics;
    } catch (error) {
      this.fetchError = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: this.fetchError }, '[AnalyticsSchedule] Failed to fetch analytics');
      return null;
    }
  }

  /**
   * Get the latest analytics data
   */
  getLatestAnalytics(): AnalyticsResponse | null {
    return this.latestAnalytics;
  }

  /**
   * Get the last fetch time
   */
  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }

  /**
   * Get any fetch error
   */
  getFetchError(): Error | null {
    return this.fetchError;
  }

  /**
   * Check if the service is configured and active
   */
  isConfigured(): boolean {
    return !!this.config?.endpoint;
  }

  /**
   * Get service status
   */
  getStatus(): {
    configured: boolean;
    endpoint: string | null;
    lastFetch: string | null;
    hasData: boolean;
    error: string | null;
  } {
    return {
      configured: this.isConfigured(),
      endpoint: this.config?.endpoint ?? null,
      lastFetch: this.lastFetchTime?.toISOString() ?? null,
      hasData: !!this.latestAnalytics,
      error: this.fetchError?.message ?? null,
    };
  }

  /**
   * Manually trigger a fetch (for action use)
   */
  async refresh(): Promise<AnalyticsResponse | null> {
    return this.fetchAnalytics();
  }
}
