import fetch from 'node-fetch';
import { load } from 'cheerio';

const DEFAULT_PROCESS_LIMIT = 50;
const MAX_PROCESS_LIMIT = 200;
const PROCESS_BATCH_SIZE = 10;

// Helper function to extract OG image from HTML
async function getOgImage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OGGalaxyBot/1.0)'
      },
      timeout: 10000
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Try to find og:image meta tag
    const ogImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[property="og:image:url"]').attr('content') ||
                    $('meta[name="og:image"]').attr('content');

    return ogImage || null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

function sanitizeUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  return urls
    .filter(url => typeof url === 'string' && url.trim())
    .map(url => url.trim());
}

function getBatchLimit(limit, defaultLimit = DEFAULT_PROCESS_LIMIT) {
  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isFinite(parsedLimit)) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsedLimit, MAX_PROCESS_LIMIT));
}

async function processUrls(urls) {
  const results = [];

  for (let i = 0; i < urls.length; i += PROCESS_BATCH_SIZE) {
    const batch = urls.slice(i, i + PROCESS_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const ogImage = await getOgImage(url);
        return {
          url,
          ogImage
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

// Serverless function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { urls, limit } = req.body || {};
    const sanitizedUrls = sanitizeUrls(urls);

    if (sanitizedUrls.length === 0) {
      return res.status(400).json({ error: 'URLs are required' });
    }

    const batchLimit = getBatchLimit(limit);
    const urlsToProcess = sanitizedUrls.slice(0, batchLimit);
    const remainingUrls = sanitizedUrls.slice(batchLimit);
    const results = await processUrls(urlsToProcess);

    const pagesWithImages = results.filter(result => result.ogImage);
    const pagesWithoutImages = results.filter(result => !result.ogImage);

    res.status(200).json({
      processed: urlsToProcess.length,
      found: pagesWithImages.length,
      notFound: pagesWithoutImages.length,
      unprocessed: remainingUrls.length,
      pagesWithImages,
      pagesWithoutImages,
      unprocessedPages: remainingUrls
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process unprocessed pages'
    });
  }
}
