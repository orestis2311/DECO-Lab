import React, { useState, useEffect, useMemo } from 'react';
import './Achievements.css';
import { listActivitiesFromIndex } from '../../services/Activities';
import {
  ACHIEVEMENT_DEFINITIONS,
  calculateUnlockedAchievements,
  filterActivitiesByMonth,
  calculateTotalDistance,
  calculateTotalDuration
} from '../../services/Achievements';
import {
  updateAchievements,
} from '../../services/AchievementsStorage';
import { showAchievementNotification } from '../../services/NotificationService';

export default function Achievements({ podUrl, solidFetch, refreshKey, webId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Month filter state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filterByMonth, setFilterByMonth] = useState(false);

  // Load activities and achievements
  useEffect(() => {
    if (!podUrl || !solidFetch) {
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // Load activities from index
        const activitiesList = await listActivitiesFromIndex({
          fetch: solidFetch,
          podUrl: podUrl
        });

        setActivities(activitiesList);

        // Update achievements and detect newly unlocked ones
        const userId = podUrl.replace(/\/$/, '') + '/profile/card#me';
        const result = await updateAchievements(
          podUrl,
          userId,
          activitiesList,
          calculateUnlockedAchievements,
          solidFetch
        );

        // Show notifications for newly unlocked achievements
        if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
          // Show notifications with a delay between each
          result.newlyUnlocked.forEach((achievement, index) => {
            setTimeout(() => {
              showAchievementNotification(achievement);
            }, index * 500); // 500ms delay between notifications
          });
        }
      } catch (err) {
        console.error('Error loading achievements:', err);
        setError(err.message || 'Failed to load achievements');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [podUrl, solidFetch, refreshKey, webId]);

  // Filter activities by month 
  const filteredActivities = useMemo(() => {
    if (filterByMonth) {
      return filterActivitiesByMonth(activities, selectedYear, selectedMonth);
    }
    return activities;
  }, [activities, filterByMonth, selectedYear, selectedMonth]);

  // Calculate total distance and duration for the filtered time 
  const totals = useMemo(() => {
    const totalDistance = calculateTotalDistance(filteredActivities);
    const totalDuration = calculateTotalDuration(filteredActivities);

    return {
      distance: (totalDistance / 1000).toFixed(2), 
      duration: (totalDuration / 3600).toFixed(2) 
    };
  }, [filteredActivities]);

  // Calculate achievements with progress (based on all activities)
  const achievementsWithProgress = useMemo(() => {
    const unlockedAchievements = calculateUnlockedAchievements(activities);

    const unlockedById = new Map();
    for (const unlocked of unlockedAchievements) {
      unlockedById.set(unlocked.id, unlocked);
    }

    const result = [];

    for (const achievement of ACHIEVEMENT_DEFINITIONS) {
      const isUnlocked = achievement.checkCriteria(activities);
      const progress = achievement.getProgress(activities);

      const unlockedInfo = unlockedById.get(achievement.id);
      const unlockedAt = unlockedInfo ? unlockedInfo.unlockedAt : null;

      let progressPercentage = 0;
      if (achievement.target > 0) {
        progressPercentage = (progress / achievement.target) * 100;
        if (progressPercentage > 100) {
          progressPercentage = 100;
        }
      }

      result.push({
        ...achievement,
        unlocked: isUnlocked,
        unlockedAt: unlockedAt,
        progress: progress,
        progressPercentage: progressPercentage
      });
    }

    return result;
  }, [activities]);

  // Get available years 
  const availableYears = useMemo(() => {
    const startYear = 2016;
    const currentYear = new Date().getFullYear();

    const years = [];
    for (let year = currentYear; year >= startYear; year--) {
      years.push(year);
    }

    return years;
  }, []);

  if (loading) {
    return <div className="achievements-container">Loading achievements...</div>;
  }

  if (error) {
    return (
      <div className="achievements-container">
        <div className="error-message">Error loading achievements: {error}</div>
      </div>
    );
  }

  return (
    <div className="achievements-container">
      {/* Header */}
      <div className="achievements-header">
        <h1> Your Progress </h1>
        <p>Milestones you've reached and goals ahead</p>
      </div>

      {/* Month Filter */}
      <div className="filter-section">
        <h3>Monthly Statistics</h3>
        <div className="filter-controls">
          <label>
            <input
              type="checkbox"
              checked={filterByMonth}
              onChange={(e) => setFilterByMonth(e.target.checked)}
            />
            View stats for a specific month
          </label>

          {filterByMonth && (
            <>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </>
          )}
        </div>

        {/* Total Distance and Duration from Index */}
        {filterByMonth && (
          <div className="totals-display">
            <p><strong>Total Distance:</strong> {totals.distance} km</p>
            <p><strong>Total Duration:</strong> {totals.duration} hours</p>
          </div>
        )}
      </div>

      {/* Achievement Collection */}
      <div className="collection-section">
        <h2 className="section-title">ACHIEVEMENT COLLECTION</h2>

        <div className="achievements-grid">
          {achievementsWithProgress.map(achievement => (
            <div
              key={achievement.id}
              className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
            >
              <div className="achievement-icon-large">{achievement.icon}</div>
              <div className="achievement-details">
                <h3 className="achievement-title">{achievement.title}</h3>
                <p className="achievement-desc">{achievement.description}</p>
                <p className="achievement-category">Category: {achievement.category}</p>

                {achievement.unlocked && achievement.unlockedAt ? (
                  <span className="unlocked-badge">
                    UNLOCKED: {new Date(achievement.unlockedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric'
                    }).toUpperCase()}
                  </span>
                ) : (
                  <div className="progress-info">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${achievement.progressPercentage}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">
                      Progress: {achievement.progress.toFixed(0)} / {achievement.target} {achievement.unit}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}