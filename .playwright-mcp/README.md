# Playwright MCP Configuration

This directory contains configuration and helper files to prevent Playwright MCP from opening multiple browser tabs.

## Problem Solved

- Prevents multiple `about:blank` tabs from accumulating
- Reuses browser context between tests
- Automatically cleans up browser resources
- Provides better browser lifecycle management

## Files

- `config.js` - Main configuration file for Playwright behavior
- `browser-helper.js` - Singleton helper for managing browser instance
- `README.md` - This documentation file

## Usage with Playwright MCP

When using Playwright MCP tools, the browser will now:
1. Reuse existing browser context when possible
2. Automatically close tabs after operations
3. Clean up resources on process exit

## Manual Browser Management

If you still see multiple tabs, you can manually clean up:

```bash
# Kill all Playwright Chrome processes
pkill -f "chrome.*playwright"

# Or use the MCP close command
mcp__playwright__browser_close
```

## Configuration Options

Edit `config.js` to adjust:
- `headless`: Run browser in background (true) or visible (false)
- `maxTabs`: Maximum number of tabs to keep open
- `autoClose`: Automatically close tabs after operations
- `cleanupDelay`: Delay before automatic cleanup

## Troubleshooting

If you still experience issues:

1. **Check for zombie processes**:
   ```bash
   ps aux | grep -i playwright
   ```

2. **Clear Playwright cache**:
   ```bash
   rm -rf ~/Library/Caches/ms-playwright/
   ```

3. **Restart Claude Desktop** to reset MCP connections

## Best Practices

1. Always close browser after test sequences
2. Use a single test context for related operations
3. Implement proper error handling to ensure cleanup
4. Monitor browser process usage during tests