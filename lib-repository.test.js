/**
 * Unit tests for normalization and duplicate detection
 * Run with: npm test
 */

const {
  normalizePhone,
  normalizeUrl,
  normalizeAddress,
  extractExternalId
} = require('./lib-repository.js');

// Simple test runner
const tests = [];
let passed = 0;
let failed = 0;
let currentTestName = '';

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  tests.push({ name, fn });
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual === expected) {
        console.log(`  ✓ ${currentTestName}`);
        passed++;
      } else {
        console.log(`  ✗ ${currentTestName}`);
        console.log(`    Expected: ${expected}`);
        console.log(`    Actual: ${actual}`);
        failed++;
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`  ✓ ${currentTestName}`);
        passed++;
      } else {
        console.log(`  ✗ ${currentTestName}`);
        console.log(`    Expected: ${JSON.stringify(expected)}`);
        console.log(`    Actual: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toThrow() {
      try {
        actual();
        console.log(`  ✗ ${currentTestName}`);
        console.log(`    Expected to throw, but did not`);
        failed++;
      } catch {
        console.log(`  ✓ ${currentTestName}`);
        passed++;
      }
    }
  };
}

// Tests
describe('normalizePhone', () => {
  it('should remove all non-digit characters', () => {
    const result = normalizePhone('+995-599-123456');
    expect(result).toBe('995599123456');
  });

  it('should handle empty string', () => {
    const result = normalizePhone('');
    expect(result).toBe('');
  });

  it('should handle null', () => {
    const result = normalizePhone(null);
    expect(result).toBe('');
  });

  it('should keep only digits from mixed input', () => {
    const result = normalizePhone('(+995) 599-123-456');
    expect(result).toBe('995599123456');
  });
});

describe('normalizeUrl', () => {
  it('should remove http:// prefix', () => {
    const result = normalizeUrl('http://example.com/page');
    expect(result).toBe('example.com/page');
  });

  it('should remove https:// prefix', () => {
    const result = normalizeUrl('https://example.com/page');
    expect(result).toBe('example.com/page');
  });

  it('should remove www. prefix', () => {
    const result = normalizeUrl('https://www.example.com/page');
    expect(result).toBe('example.com/page');
  });

  it('should convert to lowercase', () => {
    const result = normalizeUrl('https://EXAMPLE.COM/Page');
    expect(result).toBe('example.com/page');
  });

  it('should remove trailing slash', () => {
    const result = normalizeUrl('https://example.com/page/');
    expect(result).toBe('example.com/page');
  });

  it('should handle empty string', () => {
    const result = normalizeUrl('');
    expect(result).toBe('');
  });

  it('should handle null', () => {
    const result = normalizeUrl(null);
    expect(result).toBe('');
  });
});

describe('normalizeAddress', () => {
  it('should lowercase address', () => {
    const result = normalizeAddress('Ул. АТОНЕЛИ, СТАРЫЙ ТБИЛИСИ');
    expect(result).toBe('ул атонели старый тбилиси');
  });

  it('should remove extra spaces', () => {
    const result = normalizeAddress('Ул.  Атонели   ,  Тбилиси');
    expect(result).toBe('ул атонели тбилиси');
  });

  it('should normalize punctuation', () => {
    const result = normalizeAddress('ул. Атонели, г. Тбилиси - центр');
    expect(result).toBe('ул атонели г тбилиси центр');
  });

  it('should handle empty string', () => {
    const result = normalizeAddress('');
    expect(result).toBe('');
  });

  it('should handle null', () => {
    const result = normalizeAddress(null);
    expect(result).toBe('');
  });
});

describe('extractExternalId', () => {
  it('should extract MyHome ID from URL', () => {
    const result = extractExternalId('https://myhome.ge/item/12345678', 'myhome');
    expect(result).toBe('12345678');
  });

  it('should extract SS.ge ID from URL', () => {
    const result = extractExternalId('https://ss.ge/en/ads/detail/987654321', 'ss');
    expect(result).toBe('987654321');
  });

  it('should return empty for unknown source type', () => {
    const result = extractExternalId('https://example.com/item/123', 'unknown');
    expect(result).toBe('');
  });

  it('should handle empty URL', () => {
    const result = extractExternalId('', 'myhome');
    expect(result).toBe('');
  });

  it('should handle null URL', () => {
    const result = extractExternalId(null, 'myhome');
    expect(result).toBe('');
  });

  it('should handle MyHome URL with trailing slash', () => {
    const result = extractExternalId('https://myhome.ge/item/12345678/', 'myhome');
    expect(result).toBe('12345678');
  });
});

// Run tests
console.log('\n' + '='.repeat(50));
console.log('Running Normalization Tests');
console.log('='.repeat(50));

tests.forEach(test => {
  try {
    currentTestName = test.name;
    test.fn();
  } catch (e) {
    console.error(`Error in test "${test.name}": ${e.message}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
