#!/usr/bin/env node

const { config, validateConfig } = require('./config/config');
const PlaceMonitorService = require('./services/placeMonitor');
const SchedulerService = require('./services/scheduler');

class PlaceMonitorApp {
  constructor() {
    this.placeMonitor = null;
    this.scheduler = null;
    this.isRunning = false;
  }

  async start() {
    try {
      console.log('🚀 Starting Place Monitor Alert System...');

      // Validate configuration
      validateConfig();
      console.log('✅ Configuration validated');

      // Initialize services
      this.placeMonitor = new PlaceMonitorService(config);
      await this.placeMonitor.initialize();

      this.scheduler = new SchedulerService(this.placeMonitor, config);

      // Handle command line arguments
      const args = process.argv.slice(2);
      if (args.length > 0) {
        await this.handleCommand(args);
        return;
      }

      // Start scheduler for automated monitoring
      this.scheduler.start();
      this.isRunning = true;

      console.log('✅ Place Monitor Alert System started successfully');
      console.log(`📊 Monitoring ${this.placeMonitor.dataManager.getAllPlaces().length} places`);
      console.log(`⏰ Checks scheduled every ${config.monitoring.checkIntervalHours} hours`);
      console.log('📧 Notifications configured for:', config.notifications.recipients.join(', '));

      // Keep the process running
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start Place Monitor Alert System:', error.message);
      process.exit(1);
    }
  }

  async handleCommand(args) {
    const command = args[0];

    switch (command) {
      case 'check':
        await this.runImmediateCheck();
        break;

      case 'add':
        if (args.length < 2) {
          console.error('Usage: npm start add "<place name>" [guide name] [section]');
          process.exit(1);
        }
        await this.addPlace(args[1], args[2], args[3]);
        break;

      case 'import':
        if (args.length < 2) {
          console.error('Usage: npm start import <file path>');
          process.exit(1);
        }
        await this.importPlaces(args[1]);
        break;

      case 'status':
        this.showStatus();
        break;

      case 'report':
        await this.generateReport();
        break;

      case 'test':
        if (args.length < 2) {
          console.error('Usage: npm start test <place id>');
          process.exit(1);
        }
        await this.testPlace(args[1]);
        break;

      default:
        this.showHelp();
        break;
    }

    process.exit(0);
  }

  async runImmediateCheck() {
    console.log('🔍 Running immediate monitoring check...');
    const results = await this.placeMonitor.runMonitoringCycle();
    console.log('📊 Results:', results);
  }

  async addPlace(placeName, guideName, section) {
    console.log(`➕ Adding place: ${placeName}`);
    try {
      const place = await this.placeMonitor.addPlaceFromSearch(placeName, guideName, section);
      console.log('✅ Place added successfully:', place.name);
    } catch (error) {
      console.error('❌ Failed to add place:', error.message);
    }
  }

  async importPlaces(filePath) {
    console.log(`📁 Importing places from: ${filePath}`);
    try {
      const count = await this.placeMonitor.importPlacesFromFile(filePath);
      console.log(`✅ Imported ${count} places successfully`);
    } catch (error) {
      console.error('❌ Failed to import places:', error.message);
    }
  }

  showStatus() {
    const status = this.placeMonitor.getStatus();
    console.log('\n📊 Place Monitor Status:');
    console.log('='.repeat(40));
    console.log(`Total Places: ${status.places.total}`);
    console.log(`Open: ${status.places.open}`);
    console.log(`Closed: ${status.places.closed}`);
    console.log(`Permanently Closed: ${status.places.permanentlyClosed}`);
    console.log(`Temporarily Closed: ${status.places.temporarilyClosed}`);
    console.log(`Pending Alerts: ${status.pendingAlerts}`);
    console.log(`Last Check: ${status.lastCheck}`);
    console.log('='.repeat(40));
  }

  async generateReport() {
    console.log('📋 Generating daily report...');
    try {
      const report = await this.placeMonitor.generateDailyReport();
      console.log('✅ Daily report generated and sent');
    } catch (error) {
      console.error('❌ Failed to generate report:', error.message);
    }
  }

  async testPlace(placeId) {
    console.log(`🧪 Testing place: ${placeId}`);
    try {
      const result = await this.placeMonitor.checkSinglePlace(placeId);
      console.log('📊 Place status:', result);
    } catch (error) {
      console.error('❌ Failed to test place:', error.message);
    }
  }

  showHelp() {
    console.log(`
🏢 Place Monitor Alert System

Usage:
  npm start                          Start the monitoring service
  npm start check                    Run immediate monitoring check
  npm start add "<name>" [guide]     Add a new place to monitor
  npm start import <file>            Import places from JSON file
  npm start status                   Show current monitoring status
  npm start report                   Generate and send daily report
  npm start test <place_id>          Test a specific place

Examples:
  npm start add "Joe's Coffee Shop" "NYC Food Guide" "Coffee Shops"
  npm start import ./guides/nyc-restaurants.json
  npm start test ChIJN1t_tDeuEmsRUsoyG83frY4

Configuration:
  Copy .env.example to .env and configure your API keys and settings.
    `);
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

      if (this.scheduler) {
        this.scheduler.stop();
      }

      this.isRunning = false;
      console.log('✅ Place Monitor Alert System stopped');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Keep process alive
    const keepAlive = () => {
      if (this.isRunning) {
        setTimeout(keepAlive, 1000);
      }
    };
    keepAlive();
  }
}

// Start the application
if (require.main === module) {
  const app = new PlaceMonitorApp();
  app.start().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = PlaceMonitorApp;