/**
 * AchievementsStorage Service (Updated)
 * Storing and retrieving achievements from Solid Pod with notification support
 */

import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  setThing,
  buildThing,
  createThing,
  getThing,
  getUrlAll,
  getStringNoLocale,
  getDatetime,
  getBoolean,
} from '@inrupt/solid-client';
import { DCTERMS, RDF } from '@inrupt/vocab-common-rdf';

const FITNESS_VOCAB = 'http://example.org/fitness#';

/**
 * Save unlocked achievements to the pod
 * @param {string} podUrl - The users pod url
 * @param {string} webId - The users Webid
 * @param {Array} unlockedAchievements - Array of unlocked achievement objects
 * @param {Function} fetch - Authenticated fetch function
 * @returns {Promise<void>}
 */
export async function saveAchievements(podUrl, webId, unlockedAchievements, fetch) {
    const achievementsUrl = `${podUrl}/public/achievements.ttl`;
    
    let dataset = createSolidDataset();

    let collectionThing = buildThing(createThing({ name: '' }))
      .addUrl(RDF.type, `${FITNESS_VOCAB}AchievementCollection`)
      .addStringNoLocale(DCTERMS.title, 'User Achievements')
      .addUrl(DCTERMS.creator, webId)
      .addDatetime(DCTERMS.modified, new Date())
      .build();

    dataset = setThing(dataset, collectionThing);

    for (let i = 0; i < unlockedAchievements.length; i++) {
      const achievement = unlockedAchievements[i];
      const achievementName = `achievement${i + 1}`;
      const achievementUrl = `${achievementsUrl}#${achievementName}`;
      const achievementType = `${FITNESS_VOCAB}Achievement`;

      const achievementThing = buildThing(createThing({ name: achievementName }))
        .addUrl(RDF.type, achievementType)
        .addStringNoLocale(`${FITNESS_VOCAB}achievementId`, achievement.id)
        .addStringNoLocale(`${FITNESS_VOCAB}achievementTitle`, achievement.title)
        .addStringNoLocale(`${FITNESS_VOCAB}achievementDescription`, achievement.description)
        .addStringNoLocale(`${FITNESS_VOCAB}achievementCategory`, achievement.category)
        .addStringNoLocale(`${FITNESS_VOCAB}achievementIcon`, achievement.icon)
        .addDatetime(`${FITNESS_VOCAB}unlockedAt`, new Date(achievement.unlockedAt))
        .addBoolean(`${FITNESS_VOCAB}isUnlocked`, true)
        .addUrl(`${FITNESS_VOCAB}earnedBy`, webId)
        .build();

      dataset = setThing(dataset, achievementThing);

      collectionThing = buildThing(collectionThing)
        .addUrl(`${FITNESS_VOCAB}hasAchievement`, achievementUrl)
        .build();
    }
    
    dataset = setThing(dataset, collectionThing);
    await saveSolidDatasetAt(achievementsUrl, dataset, { fetch });
} 

/**
 * Load achievements from the pod
 * @param {string} podUrl - The users pod url
 * @param {Function} fetch - Authenticated fetch function
 * @returns {Promise<Array>} Array of achievement objects
 */
export async function loadAchievements(podUrl, fetch) {
  // CHANGE: Added try-catch to handle when achievements file doesn't exist yet
  // This prevents errors on first-time users who haven't unlocked anything
  try {
    const achievementsUrl = `${podUrl}/public/achievements.ttl`;
    const dataset = await getSolidDataset(achievementsUrl, { fetch });
    const achievements = [];

    const collectionThing = getThing(dataset, `${achievementsUrl}#`);

    if (!collectionThing) {
      return achievements;
    }

    const achievementUrls = getUrlAll(collectionThing, `${FITNESS_VOCAB}hasAchievement`);

    for (let i = 0; i < achievementUrls.length; i++) {
      const achievementThing = getThing(dataset, achievementUrls[i]);
      if (!achievementThing) {
        continue;
      }
      const unlockedAtDate = getDatetime(achievementThing, `${FITNESS_VOCAB}unlockedAt`);

      achievements.push({
        id: getStringNoLocale(achievementThing, `${FITNESS_VOCAB}achievementId`),
        title: getStringNoLocale(achievementThing, `${FITNESS_VOCAB}achievementTitle`),
        description: getStringNoLocale(achievementThing, `${FITNESS_VOCAB}achievementDescription`),
        category: getStringNoLocale(achievementThing, `${FITNESS_VOCAB}achievementCategory`),
        icon: getStringNoLocale(achievementThing, `${FITNESS_VOCAB}achievementIcon`),
        unlockedAt: unlockedAtDate ? unlockedAtDate.toISOString() : undefined,
        unlocked: getBoolean(achievementThing, `${FITNESS_VOCAB}isUnlocked`) || false
      });
    }
    return achievements;
  } catch (error) {
    // CHANGE: If the file doesn't exist (404 error), return empty array instead of throwing error
    // This is normal for new users - they simply haven't unlocked any achievements yet
    if (error.statusCode === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Update achievements based on current activities
 * Detects newly unlocked achievements and returns them
 * @param {string} podUrl - The users pod url
 * @param {string} webId - The users Webid
 * @param {Array} activities - Array of activity objects
 * @param {Function} calculateUnlockedAchievements - Function to calculate achievements
 * @param {Function} fetch - Authenticated fetch function
 * @returns {Promise<Object>} Object with all unlocked achievements and newly unlocked ones
 */
export async function updateAchievements(podUrl, webId, activities, calculateUnlockedAchievements, fetch) {
    // CHANGE: Load previously saved achievements from the pod
    // This lets us compare what was unlocked before vs. what's unlocked now
    const previousAchievements = await loadAchievements(podUrl, fetch);
    
    // CHANGE: Calculate which achievements should be unlocked based on current activities
    // This runs all the achievement criteria checks (5 workouts, 21km run, etc.)
    const currentUnlockedAchievements = calculateUnlockedAchievements(activities);
    
    // CHANGE: Detect newly unlocked achievements by comparing previous vs. current
    // Create a Set of previously unlocked achievement IDs for fast lookup
    const previousIds = new Set(previousAchievements.map(a => a.id));
    const newlyUnlocked = [];
    
    // CHANGE: Loop through current unlocked achievements
    // If an achievement ID wasn't in the previous set, it's newly unlocked!
    for (const achievement of currentUnlockedAchievements) {
      if (!previousIds.has(achievement.id)) {
        newlyUnlocked.push(achievement);
      }
    }
    
    // CHANGE: Save the updated list of achievements back to the pod
    // This ensures next time we load, these won't be "new" anymore
    await saveAchievements(podUrl, webId, currentUnlockedAchievements, fetch);
    
    // CHANGE: Return BOTH all unlocked achievements AND the newly unlocked ones
    // The component needs both: allUnlocked for display, newlyUnlocked for notifications
    return {
      allUnlocked: currentUnlockedAchievements,
      newlyUnlocked: newlyUnlocked
    };
}