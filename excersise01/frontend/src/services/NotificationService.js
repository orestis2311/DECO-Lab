/**
 * NotificationService.js
 * Service for displaying achievement notifications
 */

/**
 * Show a notification for a newly unlocked achievement
 * @param {Object} achievement - The achievement that was unlocked
 * @param {Function} onClose - Optional callback when notification closes
 */
export function showAchievementNotification(achievement, onClose) {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-notification-content">
      <div class="achievement-notification-icon">${achievement.icon}</div>
      <div class="achievement-notification-text">
        <div class="achievement-notification-title">Achievement Unlocked!</div>
        <div class="achievement-notification-name">${achievement.title}</div>
        <div class="achievement-notification-desc">${achievement.description}</div>
      </div>
      <button class="achievement-notification-close" aria-label="Close">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Auto-dismiss after 5 seconds
  const dismissTimeout = setTimeout(() => {
    dismissNotification(notification, onClose);
  }, 5000);

  // Manual close button
  const closeBtn = notification.querySelector('.achievement-notification-close');
  closeBtn.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    dismissNotification(notification, onClose);
  });
}

/**
 * Dismiss a notification with animation
 * @param {HTMLElement} notification - The notification element
 * @param {Function} onClose - Optional callback when notification closes
 */
function dismissNotification(notification, onClose) {
  notification.classList.remove('show');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
    if (onClose) onClose();
  }, 300);
}

/**
 * Compare two achievement arrays and return newly unlocked achievements
 * @param {Array} previousAchievements - Previously unlocked achievements
 * @param {Array} currentAchievements - Currently unlocked achievements
 * @returns {Array} Newly unlocked achievements
 */
export function detectNewlyUnlockedAchievements(previousAchievements, currentAchievements) {
  const previousIds = new Set(previousAchievements.map(a => a.id));
  const newlyUnlocked = [];

  for (const achievement of currentAchievements) {
    if (!previousIds.has(achievement.id)) {
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}