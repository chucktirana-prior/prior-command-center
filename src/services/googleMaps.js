const { Client } = require('@googlemaps/google-maps-services-js');

class GoogleMapsService {
  constructor(apiKey) {
    this.client = new Client({});
    this.apiKey = apiKey;
  }

  async searchPlace(placeName, location = null) {
    try {
      const params = {
        key: this.apiKey,
        input: placeName,
        inputtype: 'textquery',
        fields: 'place_id,name,formatted_address,business_status,geometry'
      };

      if (location) {
        params.locationbias = `circle:50000@${location}`;
      }

      const response = await this.client.findPlaceFromText({
        params,
        timeout: 10000
      });

      return response.data.candidates;
    } catch (error) {
      console.error('Error searching for place:', error.message);
      throw error;
    }
  }

  async getPlaceDetails(placeId) {
    try {
      const response = await this.client.placeDetails({
        params: {
          key: this.apiKey,
          place_id: placeId,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'business_status',
            'opening_hours',
            'permanently_closed',
            'geometry',
            'types',
            'website',
            'formatted_phone_number'
          ]
        },
        timeout: 10000
      });

      return response.data.result;
    } catch (error) {
      console.error('Error getting place details:', error.message);
      throw error;
    }
  }

  async checkPlaceStatus(placeId) {
    try {
      const placeDetails = await this.getPlaceDetails(placeId);

      return {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        businessStatus: placeDetails.business_status || 'UNKNOWN',
        isOpen: this.isPlaceOpen(placeDetails),
        lastChecked: new Date().toISOString(),
        details: placeDetails
      };
    } catch (error) {
      console.error(`Error checking status for place ${placeId}:`, error.message);
      return {
        placeId,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  isPlaceOpen(placeDetails) {
    if (placeDetails.business_status === 'CLOSED_PERMANENTLY') {
      return false;
    }

    if (placeDetails.business_status === 'CLOSED_TEMPORARILY') {
      return false;
    }

    if (placeDetails.permanently_closed === true) {
      return false;
    }

    return placeDetails.business_status === 'OPERATIONAL';
  }

  async batchCheckPlaces(placeIds) {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, i + batchSize);
      const batchPromises = batch.map(placeId => this.checkPlaceStatus(placeId));

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(result =>
          result.status === 'fulfilled' ? result.value : { error: result.reason.message }
        ));

        // Add delay between batches to respect API rate limits
        if (i + batchSize < placeIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error in batch processing:', error);
      }
    }

    return results;
  }
}

module.exports = GoogleMapsService;