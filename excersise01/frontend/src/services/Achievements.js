/**
 * Defines achievement rules and calculates which achievements have been unlocked
 */

// Achievement Categories
export const ACHIEVEMENT_CATEGORIES = {
  DISTANCE: 'distance',
  DURATION: 'duration',
  WORKOUTS: 'workouts',
  HEART_RATE: 'heart_rate',
  CONSISTENCY: 'consistency',
  VARIETY: 'variety'
};



// Achievement Definitions
// Each achievement has: id, title, description, category, icon, target, unit, criteria, progress
export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'half_marathon',
    title: 'Half Marathon Finisher',
    description: 'Complete 21km in one run.',
    category: ACHIEVEMENT_CATEGORIES.DISTANCE,
    icon: '⚡',
    target: 21097, // in meters
    unit: 'm',
    //ckeck if the achievement unlocked is
     checkCriteria: (activities) => {
      for (const activity of activities){
        const distance = activity.distanceMeters || 0;
        if (distance >= 21097){
          return true;
        }
      }
      return false;
    },
    //how close am i to unlocking it?
    getProgress: (activities) => {
      let longestDistance = 0;
      for (const activity of activities) {
        const distance = activity.distanceMeters || 0;
        if (distance > longestDistance) {
          longestDistance = distance;
        }
      } 
      return Math.min(longestDistance, 21097);
    }

  },



  {
    id: 'first_five',
    title: 'First Five',
    description: 'Complete 5 workouts.',
    category: ACHIEVEMENT_CATEGORIES.WORKOUTS,
    icon: '🔥',
    target: 5,
    unit: 'workouts',
    checkCriteria: (activities) => {
      if(activities.length>=5){
        return true;
      }
      return false;
    },
    getProgress: (activities) => {
      return Math.min(activities.length, 5);
    }
  },




  {
    id: 'multi_sport',
    title: 'Multi-Sport Athlete',
    description: 'Complete Running, Cycling, and Swimming activities.',
    category: ACHIEVEMENT_CATEGORIES.VARIETY,
    icon: '🏆',
    target: 3,
    unit: 'types',
    checkCriteria: (activities) => {
      let hasRunning = false;
      let hasCycling = false;
      let hasSwimming = false;

      for (const activity of activities) {
        if (activity.type){
          const type = activity.type.toLowerCase();

          if (type === 'running'){
            hasRunning = true;
          } else if (type === 'cycling'){
            hasCycling = true;
          } else if (type === 'swimming'){
            hasSwimming = true;
          }
        }
      }
      return hasRunning && hasCycling && hasSwimming;
    },

    getProgress: (activities) => {
      const typesSeen = new Set();
      for (const activity of activities){
        if (activity.type){ 
          typesSeen.add(activity.type.toLowerCase());
        }
      }

      let count = 0;
      if (typesSeen.has('running')){ 
        count++
      };
      if (typesSeen.has('cycling')){
        count++
      };
      if (typesSeen.has('swimming')){
        count++
      };
      return count; 
    }
  },



 {
  id: '100km_month',
  title: '100km Month',
  description: '100km in one month.',
  category: ACHIEVEMENT_CATEGORIES.DISTANCE,
  icon: '💯',
  target: 100000, // ✅ 100km in meters
  unit: 'km',

  checkCriteria: (activities) => {
    const distancePerMonth = {};

    for (const activity of activities) {
      const distance = activity.distanceMeters || 0;
      const date = new Date(activity.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; 
      const monthKey = `${year}-${month}`;

      if (!distancePerMonth[monthKey]){
        distancePerMonth[monthKey] = 0;
      }
      distancePerMonth[monthKey] += distance;
    }
    
    for (const monthKey in distancePerMonth) {
      if (distancePerMonth[monthKey] >= 100000) { // ✅ 100km = 100,000 meters
        return true;
      }
    }
    return false;
  },

  getProgress: (activities) => {
    const distancePerMonth = {};

    for (const activity of activities) {
      const distance = activity.distanceMeters || 0;
      const date = new Date(activity.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month}`;

      if (!distancePerMonth[monthKey]){
        distancePerMonth[monthKey] = 0;
      }
      distancePerMonth[monthKey] += distance;
    }
    
    let highestMonthlyDistance = 0;
    for (const monthKey in distancePerMonth){
      if (distancePerMonth[monthKey] > highestMonthlyDistance){
        highestMonthlyDistance = distancePerMonth[monthKey];
      }
    }
    // Return in meters, will be converted to km for display
    return Math.min(highestMonthlyDistance, 100000);
  }
},


  {
    id: 'marathon_finisher',
    title: 'Marathon Finisher',
    description: 'Complete a full marathon (42.2km).',
    category: ACHIEVEMENT_CATEGORIES.DISTANCE,
    icon: '🏅',
    target: 42195, 
    unit: 'm',
    checkCriteria: (activities) => {
      for (const activity of activities){
        const distance = activity.distanceMeters || 0;
        if (distance >= 42195){
          return true;
        }
      }
      return false;
    },
    getProgress: (activities) => {
      let longestDistance = 0;
      for (const activity of activities){
        const distance = activity.distanceMeters || 0;
        if (distance > longestDistance){
          longestDistance = distance;
        }
      }
      return Math.min(longestDistance, 42195);
    }

  }
];




/**
 * Calculate total distance from activities
 * @param {Array} activities - Array of activity objects
 * @returns {number} Total distance in meters
 */
export function calculateTotalDistance(activities) {
  let totalDistance = 0;
  for (const activity of activities){
    const distance = activity.distanceMeters || 0;
    totalDistance += distance;
  }
  return totalDistance;
}


/**
 * Calculate total duration from activities
 * @param {Array} activities - Array of activity objects
 * @returns {number} Total duration in seconds
 */
export function calculateTotalDuration(activities) {
  let totalDuration = 0;
  for (const activity of activities){
    const duration = activity.durationSeconds || 0;
    totalDuration += duration;
  }
  return totalDuration;
}





/**
 * Filter activities by a specific year
 * @param {Array} activities - Array of activity objects
 * @param {number} year - Year 
 * @returns {Array} Filtered activities
 */
export function filterActivitiesByMonth(activities, year, month) {
  const filteredActivities = [];
  for (const activity of activities){
    const activityDate = new Date(activity.createdAt);
    const activityYear = activityDate.getFullYear();
    const activityMonth = activityDate.getMonth() + 1;
    if (activityYear === year && activityMonth === month){
      filteredActivities.push(activity);
    }
  }
  
  return filteredActivities;
}




/**
 * Calculate which achievements have been unlocked based on activities
 * @param {Array} activities - Array of activity objects
 * @returns {Array} Array of unlocked achievement objects with unlock date
 */
export function calculateUnlockedAchievements(activities) {
  const unlocked = [];
  for (const achievement of ACHIEVEMENT_DEFINITIONS){
    const isUnlocked = achievement.checkCriteria(activities);
    if (!isUnlocked) {
      continue;
    }
    const unlockedAt = findUnlockDate(achievement, activities);
    unlocked.push({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      target: achievement.target,
      unit: achievement.unit,
      checkCriteria: achievement.checkCriteria,
      getProgress: achievement.getProgress,
      unlockedAt: unlockedAt
    });
  }
  return unlocked;
}




/**
 * Find when an achievement was first unlocked
 * @param {Object} achievement - Achievement definition
 * @param {Array} activities - Array of activity objects sorted by date
 * @returns {string} Date string when achievement was unlocked
 */
function findUnlockDate(achievement, activities) {
  const sortedActivities = [];
  for (const activity of activities){
    sortedActivities.push(activity);
  }

  // Sort activities from oldest to newest
  sortedActivities.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateA - dateB;
  });

  const activitiesSoFar = [];
  for (const activity of sortedActivities){
    activitiesSoFar.push(activity);
    if (achievement.checkCriteria(activitiesSoFar)){
      return activity.createdAt;
    }
  }
  return null;
}

