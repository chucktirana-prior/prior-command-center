const cron = require('node-cron');

class SchedulerService {
  constructor(placeMonitor, config) {
    this.placeMonitor = placeMonitor;
    this.config = config;
    this.jobs = new Map();
  }

  start() {
    // Main monitoring job - runs every X hours as configured
    const monitoringCron = this.createCronExpression(this.config.monitoring.checkIntervalHours);

    const monitoringJob = cron.schedule(monitoringCron, async () => {
      console.log(`Starting scheduled place monitoring check at ${new Date().toISOString()}`);
      try {
        await this.placeMonitor.runMonitoringCycle();
        console.log('Scheduled monitoring check completed');
      } catch (error) {
        console.error('Error in scheduled monitoring check:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    this.jobs.set('monitoring', monitoringJob);

    // Daily report job - runs at 9 AM every day
    const reportJob = cron.schedule('0 9 * * *', async () => {
      console.log(`Generating daily report at ${new Date().toISOString()}`);
      try {
        await this.placeMonitor.generateDailyReport();
        console.log('Daily report generated and sent');
      } catch (error) {
        console.error('Error generating daily report:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    this.jobs.set('dailyReport', reportJob);

    // Weekly summary job - runs every Sunday at 10 AM
    const weeklySummaryJob = cron.schedule('0 10 * * 0', async () => {
      console.log(`Generating weekly summary at ${new Date().toISOString()}`);
      try {
        await this.placeMonitor.generateWeeklySummary();
        console.log('Weekly summary generated');
      } catch (error) {
        console.error('Error generating weekly summary:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    this.jobs.set('weeklySummary', weeklySummaryJob);

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`Started ${name} scheduled job`);
    });

    console.log(`Scheduler started with ${this.jobs.size} jobs`);
    console.log(`Main monitoring will run every ${this.config.monitoring.checkIntervalHours} hours`);
  }

  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped ${name} scheduled job`);
    });
    this.jobs.clear();
    console.log('All scheduled jobs stopped');
  }

  createCronExpression(hours) {
    // Convert hours to cron expression
    if (hours === 1) {
      return '0 * * * *'; // Every hour
    } else if (hours === 6) {
      return '0 */6 * * *'; // Every 6 hours
    } else if (hours === 12) {
      return '0 */12 * * *'; // Every 12 hours
    } else if (hours === 24) {
      return '0 0 * * *'; // Daily at midnight
    } else if (hours === 168) { // Weekly
      return '0 0 * * 0'; // Every Sunday at midnight
    } else {
      // For custom intervals, run every X hours starting from midnight
      return `0 */${hours} * * *`;
    }
  }

  async runImmediateCheck() {
    console.log('Running immediate monitoring check...');
    try {
      await this.placeMonitor.runMonitoringCycle();
      console.log('Immediate monitoring check completed');
      return true;
    } catch (error) {
      console.error('Error in immediate monitoring check:', error);
      return false;
    }
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        lastExecution: job.lastExecution,
        nextExecution: job.nextExecution
      };
    });
    return status;
  }

  rescheduleJob(jobName, newIntervalHours) {
    if (this.jobs.has(jobName)) {
      const job = this.jobs.get(jobName);
      job.stop();

      // Create new job with updated schedule
      const newCron = this.createCronExpression(newIntervalHours);
      const newJob = cron.schedule(newCron, job.task, { scheduled: true });

      this.jobs.set(jobName, newJob);
      console.log(`Rescheduled ${jobName} to run every ${newIntervalHours} hours`);
      return true;
    }
    return false;
  }
}

module.exports = SchedulerService;