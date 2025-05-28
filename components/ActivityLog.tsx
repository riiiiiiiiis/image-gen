'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: 'info' | 'success' | 'error' | 'loading';
  message: string;
  details?: string;
  timestamp: Date;
  operationKey?: string; // To track related operations
}

interface ActivityLogProps {
  maxItems?: number;
}

// Global activity manager
class ActivityManager {
  private listeners: ((items: ActivityItem[]) => void)[] = [];
  private items: ActivityItem[] = [];
  private maxItems: number = 10;

  subscribe(listener: (items: ActivityItem[]) => void) {
    this.listeners.push(listener);
    listener(this.items);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  addActivity(type: ActivityItem['type'], message: string, details?: string, operationKey?: string) {
    const newItem: ActivityItem = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      details,
      timestamp: new Date(),
      operationKey,
    };

    // If this is an error/success for an operation, remove any loading messages for the same operation
    if ((type === 'error' || type === 'success') && operationKey) {
      this.items = this.items.filter(item => 
        !(item.type === 'loading' && item.operationKey === operationKey)
      );
    }

    this.items = [newItem, ...this.items].slice(0, this.maxItems);
    this.notifyListeners();

    // Auto-remove success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        this.removeActivity(newItem.id);
      }, 5000);
    }
  }

  removeActivity(id: string) {
    this.items = this.items.filter(item => item.id !== id);
    this.notifyListeners();
  }

  clearAll() {
    this.items = [];
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.items));
  }
}

export const activityManager = new ActivityManager();

export default function ActivityLog({ maxItems = 5 }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = activityManager.subscribe(setActivities);
    return unsubscribe;
  }, []);

  const visibleActivities = isExpanded ? activities : activities.slice(0, maxItems);
  const hasMore = activities.length > maxItems;

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getBackgroundColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-900/20 border-red-800';
      case 'success':
        return 'bg-green-900/20 border-green-800';
      case 'loading':
        return 'bg-blue-900/20 border-blue-800';
      default:
        return 'bg-gray-800 border-gray-700';
    }
  };

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 space-y-2">
      {visibleActivities.map((activity) => (
        <div
          key={activity.id}
          className={`rounded-lg border p-3 shadow-sm transition-all duration-300 ${getBackgroundColor(activity.type)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{getIcon(activity.type)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100">{activity.message}</p>
              {activity.details && (
                <p className="mt-1 text-xs text-gray-400 break-words">{activity.details}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {activity.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => activityManager.removeActivity(activity.id)}
              className="flex-shrink-0 p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded transition-colors"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
      
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          {isExpanded ? 'Show less' : `Show ${activities.length - maxItems} more`}
        </button>
      )}
      
      {activities.length > 1 && (
        <button
          onClick={() => activityManager.clearAll()}
          className="w-full text-center py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}