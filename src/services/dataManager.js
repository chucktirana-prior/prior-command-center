const fs = require('fs').promises;
const path = require('path');
const Place = require('../models/Place');

class DataManager {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.placesFile = path.join(dataDir, 'places.json');
    this.alertsFile = path.join(dataDir, 'alerts.json');
    this.places = new Map();
    this.alerts = [];
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.loadPlaces();
      await this.loadAlerts();
    } catch (error) {
      console.error('Error initializing data manager:', error);
    }
  }

  async loadPlaces() {
    try {
      const data = await fs.readFile(this.placesFile, 'utf8');
      const placesData = JSON.parse(data);

      this.places.clear();
      placesData.forEach(placeData => {
        const place = Place.fromJSON(placeData);
        this.places.set(place.placeId, place);
      });

      console.log(`Loaded ${this.places.size} places from storage`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading places:', error);
      }
    }
  }

  async savePlaces() {
    try {
      const placesArray = Array.from(this.places.values()).map(place => place.toJSON());
      await fs.writeFile(this.placesFile, JSON.stringify(placesArray, null, 2));
      console.log(`Saved ${placesArray.length} places to storage`);
    } catch (error) {
      console.error('Error saving places:', error);
    }
  }

  async loadAlerts() {
    try {
      const data = await fs.readFile(this.alertsFile, 'utf8');
      this.alerts = JSON.parse(data);
      console.log(`Loaded ${this.alerts.length} alerts from storage`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading alerts:', error);
      }
    }
  }

  async saveAlerts() {
    try {
      await fs.writeFile(this.alertsFile, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }

  addPlace(placeData) {
    const place = new Place(placeData);
    this.places.set(place.placeId, place);
    return place;
  }

  getPlace(placeId) {
    return this.places.get(placeId);
  }

  getAllPlaces() {
    return Array.from(this.places.values());
  }

  updatePlaceStatus(placeId, isOpen, businessStatus, details = {}) {
    const place = this.places.get(placeId);
    if (!place) {
      console.warn(`Place ${placeId} not found for status update`);
      return null;
    }

    place.updateStatus(isOpen, businessStatus);

    if (details.website) place.website = details.website;
    if (details.phone) place.phone = details.phone;
    if (details.types) place.types = details.types;

    return place;
  }

  getPlacesRequiringAlert() {
    return this.getAllPlaces().filter(place => {
      return place.hasStatusChanged() && place.isClosed();
    });
  }

  addAlert(alertData) {
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...alertData
    };
    this.alerts.push(alert);
    return alert;
  }

  markAlertSent(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.sent = true;
      alert.sentAt = new Date().toISOString();
    }
  }

  getPendingAlerts() {
    return this.alerts.filter(alert => !alert.sent);
  }

  async importPlacesFromGuides(guidesData) {
    let importedCount = 0;

    for (const guide of guidesData) {
      for (const place of guide.places) {
        if (!this.places.has(place.placeId)) {
          this.addPlace({
            ...place,
            guide: guide.name,
            section: place.section || null
          });
          importedCount++;
        }
      }
    }

    await this.savePlaces();
    return importedCount;
  }

  getStatistics() {
    const allPlaces = this.getAllPlaces();
    const openPlaces = allPlaces.filter(p => p.isOpen);
    const closedPlaces = allPlaces.filter(p => p.isClosed());
    const permanentlyClosed = allPlaces.filter(p => p.isPermanentlyClosed());
    const temporarilyClosed = allPlaces.filter(p => p.isTemporarilyClosed());

    return {
      total: allPlaces.length,
      open: openPlaces.length,
      closed: closedPlaces.length,
      permanentlyClosed: permanentlyClosed.length,
      temporarilyClosed: temporarilyClosed.length,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = DataManager;