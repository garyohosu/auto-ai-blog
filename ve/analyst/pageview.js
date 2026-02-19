#!/usr/bin/env node
/**
 * Pageview Data Fetcher for Analyst Agent
 * 
 * Fetches pageview statistics from garyo.sakura.ne.jp database
 * and formats them for metrics.md
 */

const https = require('https');

const API_ENDPOINT = 'https://www.garyo.sakura.ne.jp/cgi/api/db.cgi';
const DATABASE_NAME = 'auto_ai_blog';
const TABLE_NAME = 'pageviews';

/**
 * Make API request to sakura database
 */
function apiRequest(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(API_ENDPOINT);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseBody);
          if (result.ok) {
            resolve(result.data);
          } else {
            reject(new Error(result.error?.message || 'API error'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Get total pageviews
 */
async function getTotalPageviews() {
  const data = {
    action: 'query',
    database: DATABASE_NAME,
    operation: 'count',
    table: TABLE_NAME
  };
  
  const result = await apiRequest(data);
  return result.count || 0;
}

/**
 * Get unique visitors (by visitor_id)
 */
async function getUniqueVisitors() {
  // Note: SQLite doesn't support COUNT(DISTINCT) in our simplified API
  // We'll use a workaround: fetch all visitor_ids and count unique ones
  const data = {
    action: 'query',
    database: DATABASE_NAME,
    operation: 'select',
    table: TABLE_NAME,
    fields: ['visitor_id']
  };
  
  const result = await apiRequest(data);
  const uniqueVisitors = new Set(result.rows.map(r => r.visitor_id));
  return uniqueVisitors.size;
}

/**
 * Get top pages by pageview count
 */
async function getTopPages(limit = 10, days = 7) {
  const cutoffTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  // Fetch all pageviews from the last N days
  const data = {
    action: 'query',
    database: DATABASE_NAME,
    operation: 'select',
    table: TABLE_NAME,
    fields: ['page_path', 'page_title', 'created_at'],
    limit: 10000  // Fetch enough to aggregate locally
  };
  
  const result = await apiRequest(data);
  
  // Filter by time and aggregate
  const pageCounts = {};
  
  for (const row of result.rows) {
    if (row.created_at >= cutoffTime) {
      const path = row.page_path;
      if (!pageCounts[path]) {
        pageCounts[path] = {
          path,
          title: row.page_title,
          count: 0
        };
      }
      pageCounts[path].count++;
    }
  }
  
  // Sort by count and return top N
  return Object.values(pageCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get pageviews by day (last 7 days)
 */
async function getPageviewsByDay(days = 7) {
  const cutoffTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  const data = {
    action: 'query',
    database: DATABASE_NAME,
    operation: 'select',
    table: TABLE_NAME,
    fields: ['created_at'],
    limit: 10000
  };
  
  const result = await apiRequest(data);
  
  // Group by day
  const dayCounts = {};
  
  for (const row of result.rows) {
    if (row.created_at >= cutoffTime) {
      const date = new Date(row.created_at * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      
      dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
    }
  }
  
  // Convert to sorted array
  return Object.entries(dayCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Get referrer statistics
 */
async function getTopReferrers(limit = 10, days = 7) {
  const cutoffTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  const data = {
    action: 'query',
    database: DATABASE_NAME,
    operation: 'select',
    table: TABLE_NAME,
    fields: ['referrer', 'created_at'],
    limit: 10000
  };
  
  const result = await apiRequest(data);
  
  // Aggregate referrers
  const referrerCounts = {};
  
  for (const row of result.rows) {
    if (row.created_at >= cutoffTime && row.referrer) {
      const ref = row.referrer;
      referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
    }
  }
  
  // Sort and return top N
  return Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([referrer, count]) => ({ referrer, count }));
}

/**
 * Get complete pageview statistics
 */
async function getPageviewStats() {
  console.log('[Pageview Stats] Fetching data from sakura DB...');
  
  try {
    const [
      totalPageviews,
      uniqueVisitors,
      topPages,
      pageviewsByDay,
      topReferrers
    ] = await Promise.all([
      getTotalPageviews(),
      getUniqueVisitors(),
      getTopPages(10, 7),
      getPageviewsByDay(7),
      getTopReferrers(5, 7)
    ]);
    
    return {
      totalPageviews,
      uniqueVisitors,
      topPages,
      pageviewsByDay,
      topReferrers
    };
  } catch (error) {
    console.error('[Pageview Stats] Error:', error.message);
    return null;
  }
}

module.exports = { getPageviewStats };

// CLI usage
if (require.main === module) {
  getPageviewStats().then(stats => {
    if (stats) {
      console.log(JSON.stringify(stats, null, 2));
    }
  });
}
