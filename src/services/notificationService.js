const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
  constructor(config) {
    this.emailConfig = config.email;
    this.slackConfig = config.slack;
    this.recipients = config.recipients || [];

    if (this.emailConfig && this.emailConfig.host) {
      this.emailTransporter = nodemailer.createTransport({
        host: this.emailConfig.host,
        port: this.emailConfig.port,
        secure: this.emailConfig.port === 465,
        auth: {
          user: this.emailConfig.user,
          pass: this.emailConfig.pass
        }
      });
    }
  }

  async sendPlaceClosureAlert(place, alertType = 'closure') {
    const subject = this.generateEmailSubject(place, alertType);
    const emailBody = this.generateEmailBody(place, alertType);
    const slackMessage = this.generateSlackMessage(place, alertType);

    const results = {
      email: null,
      slack: null
    };

    // Send email notification
    if (this.emailTransporter && this.recipients.length > 0) {
      try {
        results.email = await this.sendEmail(subject, emailBody);
        console.log(`Email alert sent for ${place.name}`);
      } catch (error) {
        console.error('Failed to send email alert:', error.message);
        results.email = { error: error.message };
      }
    }

    // Send Slack notification
    if (this.slackConfig && this.slackConfig.webhookUrl) {
      try {
        results.slack = await this.sendSlackMessage(slackMessage);
        console.log(`Slack alert sent for ${place.name}`);
      } catch (error) {
        console.error('Failed to send Slack alert:', error.message);
        results.slack = { error: error.message };
      }
    }

    return results;
  }

  async sendEmail(subject, body) {
    const mailOptions = {
      from: this.emailConfig.user,
      to: this.recipients.join(', '),
      subject: subject,
      html: body
    };

    return await this.emailTransporter.sendMail(mailOptions);
  }

  async sendSlackMessage(message) {
    const response = await axios.post(this.slackConfig.webhookUrl, {
      text: message.text,
      blocks: message.blocks
    });

    return response.data;
  }

  generateEmailSubject(place, alertType) {
    const statusText = place.isPermanentlyClosed() ? 'Permanently Closed' :
                      place.isTemporarilyClosed() ? 'Temporarily Closed' : 'Status Changed';

    return `🚨 Place Alert: ${place.name} - ${statusText}`;
  }

  generateEmailBody(place, alertType) {
    const statusText = place.isPermanentlyClosed() ? 'permanently closed' :
                      place.isTemporarilyClosed() ? 'temporarily closed' : 'changed status';

    const urgencyLevel = place.isPermanentlyClosed() ? 'high' : 'medium';
    const urgencyColor = urgencyLevel === 'high' ? '#ff4444' : '#ffaa00';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .alert-header { background-color: ${urgencyColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .place-details { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .guide-info { background-color: #e8f4fd; padding: 10px; margin: 10px 0; border-left: 4px solid #2196F3; }
          .action-required { background-color: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="alert-header">
          <h2>⚠️ Place Status Alert</h2>
          <p>A place mentioned in your city guides has ${statusText}</p>
        </div>

        <div class="content">
          <div class="place-details">
            <h3>${place.name}</h3>
            <p><strong>Address:</strong> ${place.address}</p>
            <p><strong>Status:</strong> ${place.businessStatus}</p>
            <p><strong>Last Checked:</strong> ${new Date(place.lastChecked).toLocaleString()}</p>
            ${place.website ? `<p><strong>Website:</strong> <a href="${place.website}">${place.website}</a></p>` : ''}
            ${place.phone ? `<p><strong>Phone:</strong> ${place.phone}</p>` : ''}
          </div>

          ${place.guide ? `
          <div class="guide-info">
            <h4>📖 Guide Information</h4>
            <p><strong>Guide:</strong> ${place.guide}</p>
            ${place.section ? `<p><strong>Section:</strong> ${place.section}</p>` : ''}
          </div>
          ` : ''}

          <div class="action-required">
            <h4>🔧 Action Required</h4>
            <ul>
              <li>Review and update the affected city guide content</li>
              <li>Consider removing or replacing this place recommendation</li>
              <li>Check for alternative nearby places if needed</li>
              ${place.isPermanentlyClosed() ? '<li><strong>Priority:</strong> High - Update guide immediately</li>' : '<li><strong>Priority:</strong> Medium - Monitor for reopening</li>'}
            </ul>
          </div>

          <p>You can view this place on Google Maps: <a href="https://maps.google.com/?q=place_id:${place.placeId}">Open in Google Maps</a></p>
        </div>

        <div class="footer">
          <p>This alert was generated automatically by the Place Monitor system.</p>
          <p>Alert ID: ${Date.now()}</p>
        </div>
      </body>
      </html>
    `;
  }

  generateSlackMessage(place, alertType) {
    const statusEmoji = place.isPermanentlyClosed() ? '🔴' :
                       place.isTemporarilyClosed() ? '🟡' : '⚠️';

    const statusText = place.isPermanentlyClosed() ? 'permanently closed' :
                      place.isTemporarilyClosed() ? 'temporarily closed' : 'changed status';

    return {
      text: `${statusEmoji} Place Alert: ${place.name} has ${statusText}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${statusEmoji} Place Status Alert`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Place:* ${place.name}`
            },
            {
              type: "mrkdwn",
              text: `*Status:* ${place.businessStatus}`
            },
            {
              type: "mrkdwn",
              text: `*Address:* ${place.address}`
            },
            {
              type: "mrkdwn",
              text: `*Guide:* ${place.guide || 'N/A'}`
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View on Google Maps"
              },
              url: `https://maps.google.com/?q=place_id:${place.placeId}`,
              style: "primary"
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Last checked: ${new Date(place.lastChecked).toLocaleString()}`
            }
          ]
        }
      ]
    };
  }

  async sendDailyReport(statistics, closedPlaces) {
    const subject = `📊 Daily Place Monitoring Report - ${new Date().toDateString()}`;
    const reportBody = this.generateDailyReportBody(statistics, closedPlaces);

    const results = {
      email: null,
      slack: null
    };

    if (this.emailTransporter && this.recipients.length > 0) {
      try {
        results.email = await this.sendEmail(subject, reportBody);
        console.log('Daily report email sent');
      } catch (error) {
        console.error('Failed to send daily report email:', error.message);
      }
    }

    return results;
  }

  generateDailyReportBody(statistics, closedPlaces) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat-box { background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; min-width: 100px; }
          .closed-places { margin: 20px 0; }
          .place-item { background-color: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>📊 Daily Place Monitoring Report</h2>
          <p>${new Date().toDateString()}</p>
        </div>

        <div class="stats">
          <div class="stat-box">
            <h3>${statistics.total}</h3>
            <p>Total Places</p>
          </div>
          <div class="stat-box">
            <h3>${statistics.open}</h3>
            <p>Open</p>
          </div>
          <div class="stat-box">
            <h3>${statistics.closed}</h3>
            <p>Closed</p>
          </div>
          <div class="stat-box">
            <h3>${statistics.permanentlyClosed}</h3>
            <p>Permanently Closed</p>
          </div>
        </div>

        ${closedPlaces.length > 0 ? `
        <div class="closed-places">
          <h3>Recently Closed Places:</h3>
          ${closedPlaces.map(place => `
            <div class="place-item">
              <strong>${place.name}</strong> - ${place.businessStatus}<br>
              <small>${place.address}</small>
            </div>
          `).join('')}
        </div>
        ` : '<p>✅ No recently closed places to report.</p>'}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>Generated at: ${new Date().toISOString()}</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = NotificationService;