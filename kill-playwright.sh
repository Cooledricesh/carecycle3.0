#!/bin/bash

# Kill Playwright - 자동 Playwright 프로세스 종료 스크립트
# 이 스크립트는 Playwright/Chrome 좀비 프로세스를 자동으로 감지하고 종료합니다.

echo "🔍 Checking for Playwright/Chrome zombie processes..."

# Count processes before killing
BEFORE_COUNT=$(ps aux | grep -i "playwright\|chrome.*mcp" | grep -v "Google Chrome" | grep -v grep | wc -l)

if [ "$BEFORE_COUNT" -gt 0 ]; then
    echo "⚠️  Found $BEFORE_COUNT Playwright/Chrome processes"
    
    # Kill all Playwright related processes
    pkill -9 -f "chrome.*playwright" 2>/dev/null
    pkill -9 -f "ms-playwright" 2>/dev/null
    pkill -9 -f "Chrome.*mcp" 2>/dev/null
    
    # Kill Chrome processes that are not the main Google Chrome
    ps aux | grep -i "chrome" | grep -v "Google Chrome" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    
    # Clean up cache
    rm -rf ~/Library/Caches/ms-playwright/ 2>/dev/null
    
    # Count processes after killing
    AFTER_COUNT=$(ps aux | grep -i "playwright\|chrome.*mcp" | grep -v "Google Chrome" | grep -v grep | wc -l)
    
    echo "✅ Killed $(($BEFORE_COUNT - $AFTER_COUNT)) processes"
    echo "📊 Remaining processes: $AFTER_COUNT"
    
    # Log the cleanup
    echo "[$(date)] Cleaned up $((BEFORE_COUNT - AFTER_COUNT)) Playwright processes" >> ~/playwright-cleanup.log
else
    echo "✨ No Playwright zombie processes found"
fi

echo "🧹 Cleanup complete!"