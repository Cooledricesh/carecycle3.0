/**
 * Playwright Browser Helper
 * Manages browser lifecycle and prevents multiple tabs
 */

class BrowserHelper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isInitialized = false;
  }

  /**
   * Initialize browser with single context
   */
  async initialize(playwright, config = {}) {
    if (this.isInitialized) {
      console.log('Browser already initialized, reusing existing instance');
      return this.page;
    }

    try {
      // Load config
      const defaultConfig = require('./config');
      const mergedConfig = { ...defaultConfig, ...config };

      // Launch browser
      this.browser = await playwright.chromium.launch(mergedConfig.launchOptions);
      
      // Create single context
      this.context = await this.browser.newContext(mergedConfig.contextOptions);
      
      // Create single page
      this.page = await this.context.newPage();
      
      this.isInitialized = true;
      console.log('Browser initialized successfully');
      
      // Set up cleanup handlers
      this.setupCleanupHandlers(mergedConfig);
      
      return this.page;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Navigate to URL using existing page
   */
  async navigate(url) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    await this.page.goto(url, { waitUntil: 'networkidle' });
    return this.page;
  }

  /**
   * Get current page or create if needed
   */
  async getPage() {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    // Check if page is closed and recreate if needed
    if (this.page.isClosed()) {
      this.page = await this.context.newPage();
    }
    
    return this.page;
  }

  /**
   * Setup automatic cleanup handlers
   */
  setupCleanupHandlers(config) {
    // Cleanup on process exit
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    
    // Auto-cleanup after delay if configured
    if (config.behavior?.autoClose && config.cleanup?.cleanupDelay) {
      setTimeout(() => {
        console.log('Auto-cleanup triggered');
        this.cleanup();
      }, config.cleanup.cleanupDelay);
    }
  }

  /**
   * Close specific tab but keep browser open
   */
  async closeTab(page) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      
      if (this.context) {
        await this.context.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
      
      console.log('Browser cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Force cleanup
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if browser is running
   */
  isRunning() {
    return this.isInitialized && this.browser && this.browser.isConnected();
  }
}

// Export singleton instance
module.exports = new BrowserHelper();