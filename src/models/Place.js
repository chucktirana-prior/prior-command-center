class Place {
  constructor(data) {
    this.placeId = data.placeId;
    this.name = data.name;
    this.address = data.address;
    this.businessStatus = data.businessStatus || 'UNKNOWN';
    this.isOpen = data.isOpen !== undefined ? data.isOpen : true;
    this.lastChecked = data.lastChecked || new Date().toISOString();
    this.firstSeen = data.firstSeen || new Date().toISOString();
    this.guide = data.guide || null;
    this.section = data.section || null;
    this.website = data.website || null;
    this.phone = data.phone || null;
    this.types = data.types || [];
    this.statusHistory = data.statusHistory || [];
  }

  updateStatus(newStatus, businessStatus) {
    const previousStatus = this.isOpen;
    const previousBusinessStatus = this.businessStatus;

    this.statusHistory.push({
      timestamp: this.lastChecked,
      isOpen: previousStatus,
      businessStatus: previousBusinessStatus
    });

    this.isOpen = newStatus;
    this.businessStatus = businessStatus;
    this.lastChecked = new Date().toISOString();
  }

  hasStatusChanged() {
    if (this.statusHistory.length === 0) return false;
    const lastStatus = this.statusHistory[this.statusHistory.length - 1];
    return lastStatus.isOpen !== this.isOpen || lastStatus.businessStatus !== this.businessStatus;
  }

  isClosed() {
    return !this.isOpen ||
           this.businessStatus === 'CLOSED_PERMANENTLY' ||
           this.businessStatus === 'CLOSED_TEMPORARILY';
  }

  isPermanentlyClosed() {
    return this.businessStatus === 'CLOSED_PERMANENTLY';
  }

  isTemporarilyClosed() {
    return this.businessStatus === 'CLOSED_TEMPORARILY';
  }

  toJSON() {
    return {
      placeId: this.placeId,
      name: this.name,
      address: this.address,
      businessStatus: this.businessStatus,
      isOpen: this.isOpen,
      lastChecked: this.lastChecked,
      firstSeen: this.firstSeen,
      guide: this.guide,
      section: this.section,
      website: this.website,
      phone: this.phone,
      types: this.types,
      statusHistory: this.statusHistory
    };
  }

  static fromJSON(data) {
    return new Place(data);
  }
}

module.exports = Place;