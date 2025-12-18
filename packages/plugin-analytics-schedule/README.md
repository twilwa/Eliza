# @elizaos/plugin-analytics-schedule

A plugin for ElizaOS that polls platform analytics endpoints and proposes optimal posting schedules based on engagement data.

## Features

- **Periodic Analytics Polling**: Automatically fetches analytics data from a configurable endpoint
- **Schedule Recommendations**: Uses LLM to analyze engagement patterns and propose optimal posting times
- **Context Provider**: Supplies analytics data to the agent for informed decision-making
- **HTTP API Routes**: RESTful endpoints for status, data retrieval, and manual refresh

## Installation

```bash
bun add @elizaos/plugin-analytics-schedule
```

## Configuration

Set the following environment variables or agent settings:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANALYTICS_API_ENDPOINT` | Yes | - | URL to poll for analytics data |
| `ANALYTICS_API_KEY` | No | - | API key for authentication (sent as Bearer token) |
| `ANALYTICS_POLL_INTERVAL_MS` | No | 3600000 | Polling interval in milliseconds (1 hour default) |

## Usage

### Adding to Your Agent

```typescript
import { analyticsSchedulePlugin } from '@elizaos/plugin-analytics-schedule';

const agent = {
  plugins: [analyticsSchedulePlugin],
  settings: {
    ANALYTICS_API_ENDPOINT: 'https://your-api.com/analytics',
    ANALYTICS_API_KEY: 'your-api-key',
    ANALYTICS_POLL_INTERVAL_MS: '3600000',
  }
};
```

### Available Actions

#### PROPOSE_POSTING_SCHEDULE

Analyzes analytics data and generates a posting schedule recommendation.

**Triggers:**
- "What's the best time to post?"
- "Suggest a posting schedule"
- "Create a content calendar"
- "When should I post for maximum engagement?"

#### REFRESH_ANALYTICS

Manually refreshes analytics data from the endpoint.

**Triggers:**
- "Refresh my analytics"
- "Update analytics data"
- "Sync analytics"

#### ANALYTICS_STATUS

Shows the current status of the analytics service.

**Triggers:**
- "What's my analytics status?"
- "Check analytics"
- "Analytics info"

### HTTP API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/analytics/status` | GET | Get service status |
| `/analytics/data` | GET | Get latest analytics data |
| `/analytics/refresh` | POST | Manually trigger data refresh |

## Expected Analytics Response Format

Your analytics endpoint should return data in this format:

```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-15"
  },
  "platforms": [
    {
      "platform": "twitter",
      "followers": 10000,
      "impressions": 50000,
      "engagements": 2500,
      "engagementRate": 0.05
    }
  ],
  "engagementByHour": [
    {
      "hour": 9,
      "dayOfWeek": 1,
      "engagementRate": 0.08,
      "impressions": 5000
    }
  ],
  "engagementByDayOfWeek": [
    {
      "dayOfWeek": 1,
      "dayName": "Monday",
      "avgEngagementRate": 0.06
    }
  ],
  "contentPerformance": [
    {
      "contentType": "video",
      "avgEngagementRate": 0.12,
      "postCount": 50
    }
  ],
  "audienceTimezones": [
    {
      "timezone": "America/New_York",
      "percentage": 0.35
    }
  ],
  "topPerformingPosts": [
    {
      "id": "123",
      "platform": "twitter",
      "content": "Check out our new...",
      "engagementRate": 0.15,
      "impressions": 10000,
      "postedAt": "2024-01-10T14:00:00Z"
    }
  ]
}
```

All fields except `timestamp` are optional. The plugin will use whatever data is available to make recommendations.

## Example Schedule Output

```markdown
# Posting Schedule Recommendation
Generated: 2024-01-15T10:00:00Z

## Weekly Schedule

### Monday
- 09:00 (High Priority) - Peak morning engagement based on 8% avg rate
- 13:00 (Medium Priority) - Lunch break activity window
- 18:00 (High Priority) - Post-work engagement peak

### Tuesday
- 08:00 (High Priority) - Early morning audience active
- 12:00 (Medium Priority) - Midday engagement window

...

## Content Mix Recommendations
- Video content: 40% (highest engagement at 12%)
- Image posts: 35%
- Text/Link posts: 25%

## Overall Strategy
Focus on morning (8-10 AM) and evening (5-7 PM) posts for maximum reach.
Consider your audience's primary timezone (35% EST) when scheduling.
```

## License

MIT
