# Place Monitor Alert System

An automated monitoring system that tracks places mentioned in your city guides using the Google Maps API and sends notifications when businesses close or change status.

## Features

- 🔍 **Automated Monitoring**: Regular checks of place status using Google Maps Places API
- 📧 **Email Notifications**: Immediate alerts when places close permanently or temporarily
- 💬 **Slack Integration**: Optional Slack notifications for team collaboration
- 📊 **Daily Reports**: Comprehensive status reports with statistics
- 📱 **Batch Processing**: Efficient API usage with rate limiting
- 💾 **Data Persistence**: JSON-based storage for places and alert history
- ⏰ **Flexible Scheduling**: Configurable check intervals
- 🔧 **Command Line Tools**: Easy management and testing

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required: Google Maps API Key
GOOGLE_MAPS_API_KEY=your_api_key_here

# Email notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@company.com
EMAIL_PASS=your_app_password
NOTIFICATION_RECIPIENTS=team@company.com,alerts@company.com

# Optional: Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Monitoring settings
CHECK_INTERVAL_HOURS=24
```

### 3. Add Places to Monitor

You can add places in several ways:

**Add individual places:**
```bash
npm start add "Joe's Coffee Shop" "NYC Food Guide" "Coffee Shops"
```

**Import from JSON file:**
```bash
npm start import data/example-places.json
```

**Example JSON format:**
```json
[
  {
    "name": "NYC Food Guide",
    "places": [
      {
        "name": "Joe's Pizza",
        "address": "7 Carmine St, New York, NY 10014",
        "section": "Classic NY Pizza"
      }
    ]
  }
]
```

### 4. Start Monitoring

```bash
npm start
```

## Command Line Usage

```bash
# Start the monitoring service
npm start

# Run immediate check
npm start check

# Add a new place
npm start add "Restaurant Name" "Guide Name" "Section"

# Import places from file
npm start import ./path/to/places.json

# Check system status
npm start status

# Generate daily report
npm start report

# Test specific place
npm start test <place_id>
```

## How It Works

### 1. Place Detection
The system uses Google Maps Places API to:
- Search for places by name and location
- Get detailed place information including `business_status`
- Monitor for status changes: `OPERATIONAL`, `CLOSED_TEMPORARILY`, `CLOSED_PERMANENTLY`

### 2. Status Monitoring
- Regularly checks all tracked places using batch API calls
- Detects status changes and maintains history
- Respects Google Maps API rate limits

### 3. Alert System
When a place closes:
- Creates detailed email alerts with place information
- Sends Slack notifications (if configured)
- Includes guide context and recommended actions
- Tracks alert history

### 4. Reporting
- Daily status reports with statistics
- Weekly summaries of changes
- Place status history tracking

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `CHECK_INTERVAL_HOURS` | How often to check places | 24 |
| `MAX_RETRIES` | API retry attempts | 3 |
| `TIMEOUT_MS` | API request timeout | 10000 |
| `LOG_LEVEL` | Logging verbosity | info |

## Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Places API
4. Create credentials (API Key)
5. Restrict the API key to Places API for security
6. Add the API key to your `.env` file

**Required API permissions:**
- Places API (Place Details, Find Place)

## Email Setup

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `EMAIL_PASS`

## Slack Setup

1. Create a Slack app
2. Add Incoming Webhooks
3. Copy webhook URL to `SLACK_WEBHOOK_URL`

## File Structure

```
├── src/
│   ├── config/           # Configuration management
│   ├── models/           # Data models (Place)
│   ├── services/         # Core services
│   │   ├── googleMaps.js # Google Maps API integration
│   │   ├── dataManager.js # Data persistence
│   │   ├── notificationService.js # Email/Slack alerts
│   │   ├── placeMonitor.js # Main monitoring logic
│   │   └── scheduler.js  # Cron job management
│   └── index.js          # Application entry point
├── data/                 # JSON data storage
├── logs/                 # Application logs
└── .env                  # Environment configuration
```

## Monitoring Best Practices

1. **Start Small**: Begin with a few important places to test the system
2. **API Quotas**: Monitor your Google Maps API usage and costs
3. **Check Intervals**: Daily checks are usually sufficient for most use cases
4. **Error Handling**: The system retries failed requests automatically
5. **Data Backup**: Regularly backup your `data/` directory

## Troubleshooting

**Common Issues:**

- **API Key Issues**: Ensure Places API is enabled and key is unrestricted
- **Email Problems**: Check SMTP settings and use App Passwords for Gmail
- **Place Not Found**: Try different search terms or add address information
- **Rate Limits**: Reduce check frequency or implement longer delays

**Logs:**
Check `logs/place-monitor.log` for detailed error information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.