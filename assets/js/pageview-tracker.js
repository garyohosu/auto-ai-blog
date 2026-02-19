/**
 * Pageview Tracker for auto-ai-blog
 * 
 * Uses garyo.sakura.ne.jp database API to record pageviews
 * API endpoint: https://www.garyo.sakura.ne.jp/cgi/api/db.cgi
 * 
 * Features:
 * - Record pageview with timestamp, page path, referrer
 * - Generate unique session ID (stored in sessionStorage)
 * - Debounced to prevent double-counting
 * - Works with GitHub Pages (CORS-enabled)
 */

(function() {
  'use strict';
  
  const API_ENDPOINT = 'https://www.garyo.sakura.ne.jp/cgi/api/db.cgi';
  const DATABASE_NAME = 'auto_ai_blog';
  const TABLE_NAME = 'pageviews';
  
  // Generate or retrieve session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('auto_ai_blog_session_id');
    
    if (!sessionId) {
      // Generate UUID v4-like ID
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
      sessionStorage.setItem('auto_ai_blog_session_id', sessionId);
    }
    
    return sessionId;
  }
  
  // Get visitor ID (stored in localStorage for cross-session tracking)
  function getVisitorId() {
    let visitorId = localStorage.getItem('auto_ai_blog_visitor_id');
    
    if (!visitorId) {
      visitorId = 'v' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('auto_ai_blog_visitor_id', visitorId);
    }
    
    return visitorId;
  }
  
  // Record pageview to database
  async function recordPageview() {
    try {
      const data = {
        action: 'query',
        database: DATABASE_NAME,
        operation: 'insert',
        table: TABLE_NAME,
        data: {
          page_path: window.location.pathname,
          page_title: document.title || '',
          referrer: document.referrer || '',
          session_id: getSessionId(),
          visitor_id: getVisitorId(),
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          timestamp: new Date().toISOString(),
          created_at: Math.floor(Date.now() / 1000)
        }
      };
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.ok) {
        console.log('[Pageview] Recorded:', result.data);
      } else {
        console.warn('[Pageview] Failed:', result.error);
      }
    } catch (error) {
      console.error('[Pageview] Error:', error);
    }
  }
  
  // Initialize table if needed (called once)
  async function initializeTable() {
    try {
      const data = {
        action: 'query',
        database: DATABASE_NAME,
        operation: 'create_table',
        table: TABLE_NAME,
        schema: {
          id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
          page_path: 'TEXT NOT NULL',
          page_title: 'TEXT',
          referrer: 'TEXT',
          session_id: 'TEXT NOT NULL',
          visitor_id: 'TEXT NOT NULL',
          user_agent: 'TEXT',
          screen_width: 'INTEGER',
          screen_height: 'INTEGER',
          timestamp: 'TEXT',
          created_at: 'INTEGER'
        }
      };
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.ok) {
        console.log('[Pageview] Table initialized');
      }
    } catch (error) {
      console.error('[Pageview] Init error:', error);
    }
  }
  
  // Debounce to prevent double-counting
  let recordingTimeout = null;
  
  function trackPageview() {
    if (recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
    
    recordingTimeout = setTimeout(() => {
      recordPageview();
    }, 500);
  }
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeTable().then(trackPageview);
    });
  } else {
    initializeTable().then(trackPageview);
  }
  
  // Track SPA navigation (if using Turbo/Turbolinks)
  window.addEventListener('popstate', trackPageview);
  
})();
