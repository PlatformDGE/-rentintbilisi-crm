/**
 * Repository abstraction layer for Property management
 * Wraps localStorage and provides interface for duplicate checking, assignment, and action logging
 */

const storeKeyProperties = 'rit_properties';
const storeKeyActionLog = 'rit_action_log';

/**
 * Normalize phone number for comparison
 * Remove all non-digit characters, keep only numbers
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Normalize URL for comparison
 * Lowercase, remove trailing slash, remove http(s)://, remove www.
 */
function normalizeUrl(url) {
  if (!url) return '';
  return String(url)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '');
}

/**
 * Normalize address for comparison
 * Lowercase, remove extra spaces, remove punctuation
 */
function normalizeAddress(address) {
  if (!address) return '';
  return String(address)
    .toLowerCase()
    .trim()
    .replace(/[\s,.\-—–]+/g, ' ')
    .trim();
}

/**
 * Extract external ID from URL
 * MyHome: /item/{id}
 * SS: /en/ads/detail/{id}
 */
function extractExternalId(url, sourceType) {
  if (!url) return '';
  const urlStr = String(url);
  
  if (sourceType === 'myhome') {
    const match = urlStr.match(/\/item\/(\d+)/i);
    return match ? match[1] : '';
  }
  
  if (sourceType === 'ss') {
    const match = urlStr.match(/\/ads\/detail\/(\d+)/i);
    return match ? match[1] : '';
  }
  
  return '';
}

/**
 * Repository for properties and related operations
 */
const PropertyRepository = {
  /**
   * Get all stored properties
   */
  listProperties() {
    try {
      const data = JSON.parse(localStorage.getItem(storeKeyProperties) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * Get single property by ID
   */
  getProperty(id) {
    const properties = this.listProperties();
    return properties.find(p => p.id === id) || null;
  },

  /**
   * Create new property
   * Validates and stores, returns created property with ID
   */
  createProperty(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid property data');
    }
    
    const property = {
      id: data.id || uid(),
      source_type: data.source_type || 'direct',
      source_url: data.source_url || '',
      source_external_id: data.source_external_id || '',
      status: 'NEW',
      address: data.address || '',
      district: data.district || '',
      cadastral_code: data.cadastral_code || '',
      price: Number(data.price) || 0,
      currency: data.currency || '$',
      rooms: Number(data.rooms) || 0,
      area: Number(data.area) || 0,
      bedrooms: Number(data.bedrooms) || 0,
      floor: Number(data.floor) || 0,
      total_floors: Number(data.total_floors) || 0,
      description: data.description || '',
      owner_name: data.owner_name || '',
      owner_phone: data.owner_phone || '',
      assigned_agent_id: data.assigned_agent_id || '',
      assigned_agent_name: data.assigned_agent_name || '',
      notes: data.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null
    };
    
    const properties = this.listProperties();
    properties.push(property);
    localStorage.setItem(storeKeyProperties, JSON.stringify(properties));
    
    return property;
  },

  /**
   * Update existing property
   */
  updateProperty(id, updates) {
    const properties = this.listProperties();
    const index = properties.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error('Property not found');
    }
    
    properties[index] = {
      ...properties[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    localStorage.setItem(storeKeyProperties, JSON.stringify(properties));
    return properties[index];
  },

  /**
   * Archive property (soft delete)
   */
  archiveProperty(id) {
    return this.updateProperty(id, {
      archived_at: new Date().toISOString()
    });
  },

  /**
   * Find duplicate properties
   * Check exact matches for:
   * 1. normalized source_url
   * 2. source_external_id
   * 3. cadastral_code
   * 4. normalized phone + normalized address
   * Includes archived properties in search
   */
  findDuplicates(property) {
    const properties = this.listProperties();
    const results = [];
    
    const normalizedPhone = normalizePhone(property.owner_phone || property.phone);
    const normalizedAddress = normalizeAddress(property.address);
    const normalizedUrl = normalizeUrl(property.source_url);
    const externalId = extractExternalId(property.source_url, property.source_type);
    
    properties.forEach(p => {
      // Skip self-comparison
      if (p.id === property.id) return;
      
      let reason = '';
      let match = false;
      
      // Check normalized URL match
      if (normalizedUrl && normalizeUrl(p.source_url) === normalizedUrl) {
        match = true;
        reason = 'URL match';
      }
      
      // Check external ID match
      if (externalId && p.source_external_id === externalId) {
        match = true;
        reason = reason ? reason + ', external_id match' : 'external_id match';
      }
      
      // Check cadastral code match
      if (property.cadastral_code && p.cadastral_code === property.cadastral_code) {
        match = true;
        reason = reason ? reason + ', cadastral match' : 'cadastral match';
      }
      
      // Check phone + address match
      if (normalizedPhone && normalizedAddress) {
        const pPhone = normalizePhone(p.owner_phone || p.phone);
        const pAddress = normalizeAddress(p.address);
        if (pPhone === normalizedPhone && pAddress === normalizedAddress) {
          match = true;
          reason = reason ? reason + ', phone+address match' : 'phone+address match';
        }
      }
      
      if (match) {
        results.push({
          property_id: p.id,
          matched_property_id: property.id || 'new',
          duplicate: p,
          reason: reason,
          created_at: p.created_at,
          assigned_agent_name: p.assigned_agent_name
        });
      }
    });
    
    return results;
  },

  /**
   * Assign property to agent
   */
  assignProperty(propertyId, agentId, agentName) {
    return this.updateProperty(propertyId, {
      assigned_agent_id: agentId,
      assigned_agent_name: agentName,
      status: 'ASSIGNED'
    });
  },

  /**
   * List properties assigned to agent
   */
  listAgentProperties(agentId) {
    const properties = this.listProperties();
    return properties.filter(p => p.assigned_agent_id === agentId);
  },

  /**
   * Create task (e.g., MAKE_PHOTO)
   */
  createTask(propertyId, agentId, taskType) {
    const taskData = {
      id: uid(),
      property_id: propertyId,
      agent_id: agentId,
      type: taskType,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      due_at: null
    };
    
    // Store tasks separately
    try {
      const tasks = JSON.parse(localStorage.getItem('rit_tasks') || '[]');
      tasks.push(taskData);
      localStorage.setItem('rit_tasks', JSON.stringify(tasks));
    } catch {
      // Fallback if storage fails
    }
    
    return taskData;
  },

  /**
   * Append action to log
   */
  appendActionLog(action) {
    const logEntry = {
      id: uid(),
      actor_id: action.actor_id || 'system',
      entity_type: action.entity_type || 'property',
      entity_id: action.entity_id,
      action: action.action,
      before_json: action.before || null,
      after_json: action.after || null,
      created_at: new Date().toISOString()
    };
    
    try {
      const log = JSON.parse(localStorage.getItem(storeKeyActionLog) || '[]');
      log.push(logEntry);
      localStorage.setItem(storeKeyActionLog, JSON.stringify(log));
    } catch {
      // Fallback if storage fails
    }
    
    return logEntry;
  },

  /**
   * Get action log for entity
   */
  getActionLog(entityId) {
    try {
      const log = JSON.parse(localStorage.getItem(storeKeyActionLog) || '[]');
      return log.filter(l => l.entity_id === entityId);
    } catch {
      return [];
    }
  }
};

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PropertyRepository,
    normalizePhone,
    normalizeUrl,
    normalizeAddress,
    extractExternalId
  };
}
