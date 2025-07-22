/**
 * Jest setup file for CDK testing
 */

// Mock console.log to reduce noise in tests
const originalConsoleLog = console.log;
console.log = jest.fn();

// Mock console.warn to reduce noise in tests
const originalConsoleWarn = console.warn;
console.warn = jest.fn();

// Restore console methods after each test
afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
}); 