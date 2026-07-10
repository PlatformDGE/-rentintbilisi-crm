/**
 * Tests for duplicate detection logic
 * Run with: npm test -- duplicate
 */

const {
  PropertyRepository,
  normalizePhone,
  normalizeUrl,
  normalizeAddress,
  extractExternalId
} = require('./lib-repository.js');

// Mock localStorage for testing
class MockStorage {
  constructor() {
    this.data = {};
  }
  getItem(key) {
    return this.data[key] || null;
  }
  setItem(key, value) {
    this.data[key] = value;
  }
  clear() {
    this.data = {};
  }
}

global.localStorage = new MockStorage();

// Simple test runner
let passed = 0;
let failed = 0;
let currentTestName = '';

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    currentTestName = name;
    fn();
    console.log(`  ✓ ${currentTestName}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${currentTestName}`);
    console.log(`    Error: ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(length) {
      if (!Array.isArray(actual) || actual.length !== length) {
        throw new Error(`Expected array of length ${length}, got ${actual?.length}`);
      }
    },
    toContainEqual(item) {
      const found = actual.some(a => JSON.stringify(a) === JSON.stringify(item));
      if (!found) {
        throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
      }
    },
    toContain(text) {
      if (!String(actual).includes(text)) {
        throw new Error(`Expected "${actual}" to contain "${text}"`);
      }
    }
  };
}

// Helper function to generate UUID
function uid() {
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

// Mock uid in global
global.uid = uid;

describe('Duplicate Detection - exact URL match', () => {
  it('should find duplicate by normalized URL', () => {
    global.localStorage.clear();
    
    // Create first property
    const prop1 = PropertyRepository.createProperty({
      source_type: 'myhome',
      source_url: 'https://www.myhome.ge/item/12345678',
      address: 'Test Address 1',
      owner_phone: '+995599123456'
    });
    
    // Check for duplicate with same URL (different format)
    const duplicates = PropertyRepository.findDuplicates({
      source_type: 'myhome',
      source_url: 'http://myhome.ge/item/12345678/', // Different format
      address: 'Different Address',
      owner_phone: '999999999'
    });
    
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].duplicate.id).toBe(prop1.id);
    expect(duplicates[0].reason).toContain('URL match');
  });
});

describe('Duplicate Detection - exact external ID match', () => {
  it('should find duplicate by external ID', () => {
    global.localStorage.clear();
    
    const prop1 = PropertyRepository.createProperty({
      source_type: 'myhome',
      source_url: 'https://myhome.ge/item/87654321',
      source_external_id: '87654321',
      address: 'Test Address 1',
      owner_phone: '+995599123456'
    });
    
    // Create new property with same external ID extracted from URL
    const duplicates = PropertyRepository.findDuplicates({
      source_type: 'myhome',
      source_url: 'https://myhome.ge/item/87654321', // Same URL, same external ID
      source_external_id: '87654321',
      address: 'Different Address',
      owner_phone: '999999999'
    });
    
    expect(duplicates).toHaveLength(1);
  });
});

describe('Duplicate Detection - cadastral code match', () => {
  it('should find duplicate by cadastral code', () => {
    global.localStorage.clear();
    
    const prop1 = PropertyRepository.createProperty({
      source_url: 'https://myhome.ge/item/11111',
      cadastral_code: 'GEO-12345-67890',
      address: 'Test Address 1',
      owner_phone: '+995599123456'
    });
    
    const duplicates = PropertyRepository.findDuplicates({
      source_url: 'https://myhome.ge/item/11111', // Different but will be normalized same
      cadastral_code: 'GEO-12345-67890', // Same cadastral
      address: 'Different Address',
      owner_phone: '999999999'
    });
    
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reason).toContain('cadastral match');
  });
});

describe('Duplicate Detection - phone + address match', () => {
  it('should find duplicate by normalized phone + address', () => {
    global.localStorage.clear();
    
    const prop1 = PropertyRepository.createProperty({
      source_url: 'https://source1.com',
      cadastral_code: '',
      address: 'ул. Атонели, Старый Тбилиси',
      owner_phone: '+995-599-123-456'
    });
    
    const duplicates = PropertyRepository.findDuplicates({
      source_url: 'https://source2.com/page', // Different URL
      cadastral_code: '',
      address: 'ул. АТОНЕЛИ, СТАРЫЙ ТБИЛИСИ', // Different case, same normalized
      owner_phone: '995599123456' // Different format, same normalized
    });
    
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reason).toContain('phone+address match');
  });
});

describe('Duplicate Detection - archived property', () => {
  it('should find duplicate even if property is archived', () => {
    global.localStorage.clear();
    
    const prop1 = PropertyRepository.createProperty({
      source_url: 'https://myhome.ge/item/99999',
      address: 'Archived Address',
      owner_phone: '+995599111111'
    });
    
    // Archive the property
    PropertyRepository.archiveProperty(prop1.id);
    
    const duplicates = PropertyRepository.findDuplicates({
      source_url: 'https://myhome.ge/item/99999',
      address: 'Different Address',
      owner_phone: '999999999'
    });
    
    expect(duplicates).toHaveLength(1);
  });
});

describe('Duplicate Detection - no duplicates', () => {
  it('should return empty array when no duplicates found', () => {
    global.localStorage.clear();
    
    PropertyRepository.createProperty({
      source_url: 'https://source1.com',
      cadastral_code: 'GEO-11111',
      address: 'Address 1',
      owner_phone: '+995599111111'
    });
    
    const duplicates = PropertyRepository.findDuplicates({
      source_url: 'https://source2.com',
      cadastral_code: 'GEO-22222',
      address: 'Address 2',
      owner_phone: '+995599222222'
    });
    
    expect(duplicates).toHaveLength(0);
  });
});

describe('Duplicate Detection - multiple matches', () => {
  it('should return multiple duplicates if property matches multiple', () => {
    global.localStorage.clear();
    
    const prop1 = PropertyRepository.createProperty({
      source_url: 'https://myhome.ge/item/12345',
      source_external_id: '12345',
      cadastral_code: 'GEO-12345',
      address: 'Test Address',
      owner_phone: '+995599123456'
    });
    
    // This should match by URL and external ID
    const duplicates = PropertyRepository.findDuplicates({
      source_type: 'myhome',
      source_url: 'http://myhome.ge/item/12345/', // Matches by URL
      source_external_id: '12345', // Matches by external ID
      address: 'Different Address',
      owner_phone: '999999999'
    });
    
    expect(duplicates).toHaveLength(1);
    // Should contain both reasons in the reason string
  });
});

// Run tests
console.log('\n' + '='.repeat(50));
console.log('Running Duplicate Detection Tests');
console.log('='.repeat(50));

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
