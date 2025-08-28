/**
 * Playwright MCP Configuration
 * Prevents multiple browser tabs from opening during tests
 */

module.exports = {
  // Browser launch options
  launchOptions: {
    headless: false, // Set to true for background execution
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process', // Run in single process mode
    ],
  },

  // Context options
  contextOptions: {
    // Reuse single context
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  // Test behavior
  behavior: {
    autoClose: true, // Automatically close tabs after test
    reuseContext: true, // Reuse browser context between tests
    maxTabs: 1, // Maximum number of tabs to keep open
    cleanupDelay: 1000, // Delay before cleanup (ms)
  },

  // Cleanup settings
  cleanup: {
    onError: true, // Clean up on error
    onComplete: true, // Clean up on completion
    forceClose: true, // Force close hanging browsers
  },
};