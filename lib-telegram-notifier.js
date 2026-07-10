/**
 * Telegram Notifier - Mock implementation for MVP
 * Will be replaced with real Telegram Bot API in next iteration
 */

const TelegramNotifier = {
  /**
   * Send notification about new property
   */
  notifyPropertyCreated(property) {
    const message = `New property created:
Property: ${property.address}
District: ${property.district}
Price: ${property.price}
Assigned to: ${property.assigned_agent_name || 'Unassigned'}
Source: ${property.source_type}`;
    
    console.log('[TELEGRAM NOTIFICATION]', message);
    this._logNotification('property_created', property.id, message);
    return true;
  },

  /**
   * Send notification about duplicate detected
   */
  notifyDuplicateDetected(newProperty, existingProperty) {
    const message = `Duplicate detected:
New: ${newProperty.address}
Existing: ${existingProperty.address}
Assigned to: ${existingProperty.assigned_agent_name || 'Unassigned'}`;
    
    console.log('[TELEGRAM NOTIFICATION]', message);
    this._logNotification('duplicate_detected', existingProperty.id, message);
    return true;
  },

  /**
   * Send notification about task created
   */
  notifyTaskCreated(task, property) {
    const message = `Task created: ${task.type}
Property: ${property.address}
Agent: ${property.assigned_agent_name || 'Unassigned'}`;
    
    console.log('[TELEGRAM NOTIFICATION]', message);
    this._logNotification('task_created', task.id, message);
    return true;
  },

  /**
   * Log notification internally
   */
  _logNotification(type, entityId, message) {
    try {
      const notifications = JSON.parse(localStorage.getItem('rit_notifications') || '[]');
      notifications.push({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        type: type,
        entity_id: entityId,
        message: message,
        created_at: new Date().toISOString(),
        sent: true, // Mock always succeeds
        error: null
      });
      localStorage.setItem('rit_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error('Failed to log notification', e);
    }
  }
};

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TelegramNotifier;
}
