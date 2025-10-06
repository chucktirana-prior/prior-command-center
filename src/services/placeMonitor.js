const GoogleMapsService = require('./googleMaps');
const DataManager = require('./dataManager');
const NotificationService = require('./notificationService');

class PlaceMonitorService {
  constructor(config) {
    this.config = config;
    this.googleMaps = new GoogleMapsService(config.googleMaps.apiKey);
    this.dataManager = new DataManager(config.data.directory);
    this.notificationService = new NotificationService(config.notifications);
  }

  async initialize() {
    await this.dataManager.initialize();
    console.log('Place Monitor Service initialized');
  }

  async runMonitoringCycle() {
    console.log('Starting monitoring cycle...');

    const allPlaces = this.dataManager.getAllPlaces();
    if (allPlaces.length === 0) {
      console.log('No places to monitor');
      return { checked: 0, alerts: 0 };
    }

    console.log(`Checking status of ${allPlaces.length} places...`);

    const placeIds = allPlaces.map(place => place.placeId);
    const results = await this.googleMaps.batchCheckPlaces(placeIds);

    let checkedCount = 0;
    let alertCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalPlace = allPlaces[i];

      if (result.error) {
        console.error(`Error checking ${originalPlace.name}: ${result.error}`);
        continue;
      }

      checkedCount++;

      // Update place status
      const updatedPlace = this.dataManager.updatePlaceStatus(
        result.placeId,
        result.isOpen,
        result.businessStatus,
        {
          website: result.details.website,
          phone: result.details.formatted_phone_number,
          types: result.details.types
        }
      );

      // Check if we need to send an alert
      if (updatedPlace && updatedPlace.hasStatusChanged() && updatedPlace.isClosed()) {
        console.log(`🚨 Place closed: ${updatedPlace.name} (${updatedPlace.businessStatus})`);

        const alert = this.dataManager.addAlert({
          type: 'place_closure',
          placeId: updatedPlace.placeId,
          placeName: updatedPlace.name,
          previousStatus: updatedPlace.statusHistory[updatedPlace.statusHistory.length - 1],
          currentStatus: {
            isOpen: updatedPlace.isOpen,
            businessStatus: updatedPlace.businessStatus
          },
          guide: updatedPlace.guide,
          section: updatedPlace.section
        });

        try {
          await this.notificationService.sendPlaceClosureAlert(updatedPlace);
          this.dataManager.markAlertSent(alert.id);
          alertCount++;
        } catch (error) {
          console.error(`Failed to send alert for ${updatedPlace.name}:`, error.message);
        }
      }
    }

    await this.dataManager.savePlaces();
    await this.dataManager.saveAlerts();

    console.log(`Monitoring cycle completed: ${checkedCount} places checked, ${alertCount} alerts sent`);

    return {
      checked: checkedCount,
      alerts: alertCount,
      errors: results.filter(r => r.error).length
    };
  }

  async addPlaceFromSearch(placeName, guideName = null, section = null, location = null) {
    console.log(`Searching for place: ${placeName}`);

    try {
      const searchResults = await this.googleMaps.searchPlace(placeName, location);

      if (searchResults.length === 0) {
        throw new Error(`No places found for "${placeName}"`);
      }

      const bestMatch = searchResults[0];
      const placeDetails = await this.googleMaps.getPlaceDetails(bestMatch.place_id);

      const placeData = {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        businessStatus: placeDetails.business_status || 'OPERATIONAL',
        isOpen: this.googleMaps.isPlaceOpen(placeDetails),
        guide: guideName,
        section: section,
        website: placeDetails.website,
        phone: placeDetails.formatted_phone_number,
        types: placeDetails.types || []
      };

      const place = this.dataManager.addPlace(placeData);
      await this.dataManager.savePlaces();

      console.log(`Added place: ${place.name} (${place.placeId})`);
      return place;
    } catch (error) {
      console.error(`Error adding place "${placeName}":`, error.message);
      throw error;
    }
  }

  async importPlacesFromFile(filePath) {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(filePath, 'utf8');
      const placesData = JSON.parse(data);

      const importedCount = await this.dataManager.importPlacesFromGuides(placesData);
      console.log(`Imported ${importedCount} new places from ${filePath}`);

      return importedCount;
    } catch (error) {
      console.error('Error importing places from file:', error.message);
      throw error;
    }
  }

  async generateDailyReport() {
    const statistics = this.dataManager.getStatistics();
    const recentlyClosedPlaces = this.dataManager.getAllPlaces()
      .filter(place => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return place.isClosed() && new Date(place.lastChecked) > dayAgo;
      });

    try {
      await this.notificationService.sendDailyReport(statistics, recentlyClosedPlaces);
      console.log('Daily report sent successfully');
    } catch (error) {
      console.error('Error sending daily report:', error.message);
    }

    return { statistics, recentlyClosedPlaces };
  }

  async generateWeeklySummary() {
    const statistics = this.dataManager.getStatistics();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyClosures = this.dataManager.getAllPlaces()
      .filter(place => {
        return place.statusHistory.some(status => {
          return new Date(status.timestamp) > weekAgo &&
                 (status.businessStatus === 'CLOSED_PERMANENTLY' ||
                  status.businessStatus === 'CLOSED_TEMPORARILY');
        });
      });

    console.log(`Weekly summary: ${weeklyClosures.length} places closed this week`);
    return { statistics, weeklyClosures };
  }

  getStatus() {
    const statistics = this.dataManager.getStatistics();
    const pendingAlerts = this.dataManager.getPendingAlerts();

    return {
      places: statistics,
      pendingAlerts: pendingAlerts.length,
      lastCheck: new Date().toISOString()
    };
  }

  async checkSinglePlace(placeId) {
    console.log(`Checking single place: ${placeId}`);

    try {
      const result = await this.googleMaps.checkPlaceStatus(placeId);

      if (result.error) {
        throw new Error(result.error);
      }

      const updatedPlace = this.dataManager.updatePlaceStatus(
        result.placeId,
        result.isOpen,
        result.businessStatus,
        {
          website: result.details.website,
          phone: result.details.formatted_phone_number,
          types: result.details.types
        }
      );

      await this.dataManager.savePlaces();

      return {
        place: updatedPlace,
        statusChanged: updatedPlace ? updatedPlace.hasStatusChanged() : false
      };
    } catch (error) {
      console.error(`Error checking single place ${placeId}:`, error.message);
      throw error;
    }
  }
}

module.exports = PlaceMonitorService;