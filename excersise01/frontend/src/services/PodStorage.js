import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  setThing,
  buildThing,
  createThing,
  getSourceUrl,
  getStringNoLocale,
  getThing,
  getUrlAll,
  getDecimal,
  getInteger,
  getDatetime,
  saveFileInContainer,
  getFile,
  deleteFile,
  getContainedResourceUrlAll,
  createContainerAt
} from '@inrupt/solid-client';
import { DCTERMS, RDF, LDP, XSD } from '@inrupt/vocab-common-rdf';

const FITNESS_VOCAB = 'http://example.org/fitness#';
const FOAF = 'http://xmlns.com/foaf/0.1/';

class PodStorageService {
  constructor() {
    this.fitnessPath = '/public/fitness/';
    this.indexPath = '/public/fitness/index.ttl';
  }

  /**
   * Normalize URL to remove trailing slashes
   */
  normalizeUrl(url) {
    return url.replace(/\/+$/, '');
  }

  /**
   * Get the base URL of the user's Pod from their WebID
   */
  async getPodUrl(webId, fetch) {
    try {
      const profileDataset = await getSolidDataset(webId, { fetch });
      const profileThing = getThing(profileDataset, webId);

      // Try to get storage location
      const storage = getUrlAll(profileThing, 'http://www.w3.org/ns/pim/space#storage');
      if (storage && storage.length > 0) {
        return this.normalizeUrl(storage[0]);
      }

      // Fallback: extract from WebID
      const url = new URL(webId);
      return this.normalizeUrl(`${url.protocol}//${url.host}`);
    } catch (error) {
      console.error('Error getting Pod URL:', error);
      // Fallback: extract from WebID
      const url = new URL(webId);
      return this.normalizeUrl(`${url.protocol}//${url.host}`);
    }
  }

  /**
   * Ensure a container exists at the given URL
   */
  async ensureContainer(containerUrl, fetch) {
    try {
      await getSolidDataset(containerUrl, { fetch });
      console.log('Container exists:', containerUrl);
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('Creating container:', containerUrl);
        try {
          await createContainerAt(containerUrl, { fetch });
          console.log('Container created successfully:', containerUrl);
          return true;
        } catch (createError) {
          console.error('Error creating container:', createError);
          return false;
        }
      } else {
        console.error('Error checking container:', error);
        return false;
      }
    }
  }

  /**
   * Ensure the fitness directory exists
   */
  async ensureFitnessDirectory(podUrl, fetch) {
  // Ensure /public/fitness/ exists
  const publicUrl = `${podUrl}/public/`;
  await this.ensureContainer(publicUrl, fetch);

  const fitnessUrl = `${podUrl}${this.fitnessPath}`;
  await this.ensureContainer(fitnessUrl, fetch);

  console.log('Fitness PUBLIC directory ready:', fitnessUrl);
}



  /**
   * Generate filename for activity with counter
   * Format: activitytype-YYYY-MM-DD-count.ttl
   * Example: run-2025-04-29-1.ttl
   */

  async generateFilename(activityType, timestamp, podUrl, fetch) {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const type = activityType.toLowerCase().replace(/\s+/g, '');
    const basePattern = `${type}-${dateStr}`;

    // Get existing files to determine the next count
    try {
      const containerUrl = `${podUrl}${this.fitnessPath}`;
      const dataset = await getSolidDataset(containerUrl, { fetch });
      const containedUrls = getContainedResourceUrlAll(dataset);
 

      // Filter files matching this activity type and date
      const matchingFiles = containedUrls.filter(url => {
        const filename = url.split('/').pop();
        return filename.startsWith(basePattern) && filename.endsWith('.ttl');
      });

 

      // Extract counts and find the maximum
      const counts = matchingFiles.map(url => {
        const filename = url.split('/').pop();
        const match = filename.match(new RegExp(`${basePattern}-(\\d+)\\.ttl$`));
        return match ? parseInt(match[1], 10) : 0;
      });


      const nextCount = counts.length > 0 ? Math.max(...counts) + 1 : 1;
      return `${basePattern}-${nextCount}.ttl`;
    } catch (error) {
      // If container doesn't exist or error accessing it, start with count 1
      console.log('Using default count (1) due to:', error.message);
      return `${basePattern}-1.ttl`;
    }
  
  }

  /**
   * Upload TTL file to Pod with metadata
   */
  async uploadActivity(podUrl, webId, ttlContent, activityMetadata, fetch) {
    try {
      console.log('Starting Pod upload...');
      console.log('Pod URL:', podUrl);
      console.log('WebID:', webId);

      await this.ensureFitnessDirectory(podUrl, fetch);

      const filename = await this.generateFilename(
        activityMetadata.type || 'activity',
        activityMetadata.timestamp || new Date().toISOString(),
        podUrl,
        fetch
      );

      console.log('Generated filename:', filename);

      // Add metadata to TTL content
      const enrichedTtl = this.addMetadataToTtl(ttlContent, activityMetadata, webId);

      // Upload the file to the container
      const containerUrl = `${podUrl}${this.fitnessPath}`;
      console.log('Container URL:', containerUrl);

      const file = new Blob([enrichedTtl], { type: 'text/turtle' });

      const savedFile = await saveFileInContainer(
        containerUrl,
        file,
        {
          slug: filename.replace('.ttl', ''),
          contentType: 'text/turtle',
          fetch
        }
      );

      const fileUrl = getSourceUrl(savedFile);
      console.log('Activity uploaded successfully to:', fileUrl);

      // Update the index
      await this.updateIndex(podUrl, webId, filename, activityMetadata, fetch);

      return { url: fileUrl, filename };
    } catch (error) {
      console.error('Error uploading activity:', error);
      console.error('Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        response: error.response
      });
      throw error;
    }
  }

  /**
   * Add metadata to TTL content
   */
  addMetadataToTtl(ttlContent, metadata, webId) {
    // Add document-level metadata at the beginning
    const docMetadata = `
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<#> dcterms:creator <${webId}> ;
    dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
    dcterms:title "${metadata.title || 'Fitness Activity'}" .

`;

    return docMetadata + ttlContent;
  }

  /**
   * Update or create the index.ttl file
   */
  async updateIndex(podUrl, webId, activityFilename, activityMetadata, fetch) {
      const indexUrl = `${podUrl}${this.indexPath}`;

      try {
        let indexDataset;
        let containerThing;

        // Try to load existing index
        try {
          indexDataset = await getSolidDataset(indexUrl, { fetch });
          containerThing = getThing(indexDataset, `${indexUrl}#`);
        } catch (error) {
          // Create new index if it doesn't exist
          console.log('Creating new index file');
          indexDataset = createSolidDataset();
          containerThing = null;
        }

        // -------- Container (#) description --------
        let containerBuilder = containerThing
          ? buildThing(containerThing)
          : buildThing(createThing({ name: '' }))
              .addUrl(RDF.type, LDP.BasicContainer)
              .addStringNoLocale(DCTERMS.title, 'Fitness Activity Data')
              .addUrl(DCTERMS.creator, webId)
              .addDatetime(DCTERMS.created, new Date());

        // URL of the activity file – we use this both in ldp:contains
        // and as the subject for the metadata triples
        const activityFileUrl = `${podUrl}${this.fitnessPath}${activityFilename}`;

        // Add reference to the new activity file
        containerBuilder = containerBuilder.addUrl(LDP.contains, activityFileUrl);

        containerThing = containerBuilder.build();
        indexDataset = setThing(indexDataset, containerThing);

        // -------- Activity metadata: use the file URL as subject --------
        let activityBuilder = buildThing(createThing({ url: activityFileUrl }));

        const activityTypeUrl = `${FITNESS_VOCAB}${activityMetadata.type || 'Activity'}`;
        activityBuilder = activityBuilder.addUrl(RDF.type, activityTypeUrl);

        // dct:title (e.g. "Running - 14/04/2024")
        if (activityMetadata.title) {
          activityBuilder = activityBuilder.addStringNoLocale(
            DCTERMS.title,
            activityMetadata.title
          );
        }

        // dct:created = workout timestamp if we have it
        if (activityMetadata.timestamp) {
          activityBuilder = activityBuilder.addDatetime(
            DCTERMS.created,
            new Date(activityMetadata.timestamp)
          );
        }

        // dct:modified = "now"
        activityBuilder = activityBuilder.addDatetime(DCTERMS.modified, new Date());

        // dct:creator = the user’s WebID (semantically same as "c:me")
        activityBuilder = activityBuilder.addUrl(DCTERMS.creator, webId);

        // fit:duration as ISO 8601 string (PT1H47M32S)
        if (activityMetadata.duration) {
          activityBuilder = activityBuilder.addStringNoLocale(
            `${FITNESS_VOCAB}duration`,
            activityMetadata.duration
          );
        }

        // fit:totalDistance as string literal
        if (activityMetadata.totalDistance != null) {
          activityBuilder = activityBuilder.addStringNoLocale(
            `${FITNESS_VOCAB}totalDistance`,
            String(activityMetadata.totalDistance)
          );
        }

        // fit:averageHeartRate as string literal
        if (activityMetadata.averageHeartRate != null) {
          activityBuilder = activityBuilder.addStringNoLocale(
            `${FITNESS_VOCAB}averageHeartRate`,
            String(activityMetadata.averageHeartRate)
          );
        }

        // Optional: keep max HR & total power if you like
        if (activityMetadata.maxHeartRate != null) {
          activityBuilder = activityBuilder.addInteger(
            `${FITNESS_VOCAB}maxHeartRate`,
            activityMetadata.maxHeartRate
          );
        }

        if (activityMetadata.totalPowerOutput != null) {
          activityBuilder = activityBuilder.addStringNoLocale(
            `${FITNESS_VOCAB}totalPowerOutput`,
            String(activityMetadata.totalPowerOutput)
          );
        }

        // IMPORTANT: do NOT add fit:activityFile any more

        const activityThing = activityBuilder.build();
        indexDataset = setThing(indexDataset, activityThing);

        await saveSolidDatasetAt(indexUrl, indexDataset, { fetch });
        console.log('Index updated successfully');
      } catch (error) {
        console.error('Error updating index:', error);
        throw error;
      }
    }

  /**
   * Get list of activities from the index
   */
  async getActivities(podUrl, fetch) {
    const indexUrl = `${podUrl}${this.indexPath}`;

    try {
      const indexDataset = await getSolidDataset(indexUrl, { fetch });
      const containerThing = getThing(indexDataset, `${indexUrl}#`);

      if (!containerThing) {
        return [];
      }

      // Get all contained resources
      const containedUrls = getUrlAll(containerThing, LDP.contains);

      // Build activity list
      const activities = [];

      for (const fileUrl of containedUrls) {
        const filename = fileUrl.split('/').pop();
        const thingName = filename.replace('.ttl', '');
        const activityThingUrl = `${indexUrl}#${thingName}`;
        const activityThing = getThing(indexDataset, activityThingUrl);

        if (activityThing) {
          const activity = {
            url: fileUrl,
            filename: filename,
            title: getStringNoLocale(activityThing, DCTERMS.title) || filename,
            created: getDatetime(activityThing, DCTERMS.created),
            type: this.extractTypeFromThing(activityThing),
            duration: getStringNoLocale(activityThing, `${FITNESS_VOCAB}duration`),
            totalDistance: getDecimal(activityThing, `${FITNESS_VOCAB}totalDistance`),
            averageHeartRate: getDecimal(activityThing, `${FITNESS_VOCAB}averageHeartRate`),
            maxHeartRate: getInteger(activityThing, `${FITNESS_VOCAB}maxHeartRate`),
            totalPowerOutput: getDecimal(activityThing, `${FITNESS_VOCAB}totalPowerOutput`)
          };

          activities.push(activity);
        }
      }

      // Sort by date, newest first
      activities.sort((a, b) => {
        const dateA = a.created ? new Date(a.created) : new Date(0);
        const dateB = b.created ? new Date(b.created) : new Date(0);
        return dateB - dateA;
      });

      return activities;
    } catch (error) {
      console.error('Error getting activities:', error);
      if (error.statusCode === 404) {
        // Index doesn't exist yet
        return [];
      }
      throw error;
    }
  }

  /**
   * Extract activity type from RDF thing
   */
  extractTypeFromThing(thing) {
    const types = getUrlAll(thing, RDF.type);
    for (const type of types) {
      if (type.startsWith(FITNESS_VOCAB)) {
        return type.replace(FITNESS_VOCAB, '');
      }
    }
    return 'Activity';
  }

  /**
   * Get activity file content
   */
  async getActivityContent(activityUrl, fetch) {
    try {
      const file = await getFile(activityUrl, { fetch });
      const content = await file.text();
      return content;
    } catch (error) {
      console.error('Error getting activity content:', error);
      throw error;
    }
  }

  /**
   * Calculate summary statistics from activities
   */
  calculateSummaryStats(activities) {
    const stats = {
      total: activities.length,
      byType: {},
      thisWeek: 0,
      thisMonth: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalHours: 0,
      averageHeartRate: 0,
      types: new Set()
    };

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalHrCount = 0;
    let totalHrSum = 0;

    activities.forEach(activity => {
      // Count by type
      const type = activity.type || 'Unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.types.add(type);

      // Count by time period
      const activityDate = activity.created ? new Date(activity.created) : null;
      if (activityDate) {
        if (activityDate >= oneWeekAgo) {
          stats.thisWeek++;
        }
        if (activityDate >= oneMonthAgo) {
          stats.thisMonth++;
        }
      }

      // Sum distances
      if (activity.totalDistance) {
        stats.totalDistance += activity.totalDistance;
      }

      // Sum duration
      if (activity.duration) {
        const seconds = this.durationToSeconds(activity.duration);
        stats.totalDuration += seconds;
      }

      // Average heart rate
      if (activity.averageHeartRate) {
        totalHrSum += activity.averageHeartRate;
        totalHrCount++;
      }
    });

    // Convert total distance to km
    stats.totalDistanceKm = (stats.totalDistance / 1000).toFixed(2);

    // Convert total duration to hours
    stats.totalHours = (stats.totalDuration / 3600).toFixed(2);

    // Calculate average HR
    if (totalHrCount > 0) {
      stats.averageHeartRate = (totalHrSum / totalHrCount).toFixed(1);
    }

    return stats;
  }

  /**
   * Convert ISO 8601 duration to seconds
   */
  durationToSeconds(duration) {
    if (!duration) return 0;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseFloat(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }
}

export default new PodStorageService();