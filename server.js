import express from 'express';
import fetch from 'node-fetch';
import { parseString } from 'xml2js';
import { load } from 'cheerio';
import cors from 'cors';
import { promisify } from 'util';

const app = express();
const PORT = process.env.PORT || 3000;
const parseXml = promisify(parseString);
const DEFAULT_PROCESS_LIMIT = 50;
const MAX_PROCESS_LIMIT = 200;
const PROCESS_BATCH_SIZE = 10;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

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

// Helper function to get sitemap URLs
async function getSitemapUrls(domain) {
  const sitemapUrls = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `http://${domain}/sitemap.xml`,
    `http://${domain}/sitemap_index.xml`
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OGGalaxyBot/1.0)'
        },
        timeout: 10000
      });

      if (response.ok) {
        const xml = await response.text();
        return await parseSitemap(xml, domain);
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error('No sitemap found');
}

// Parse sitemap XML
async function parseSitemap(xml, domain) {
  try {
    const result = await parseXml(xml);
    const urls = [];

    // Handle sitemap index (contains links to other sitemaps)
    if (result.sitemapindex) {
      const sitemaps = result.sitemapindex.sitemap || [];
      for (const sitemap of sitemaps) {
        const sitemapUrl = sitemap.loc[0];
        try {
          const response = await fetch(sitemapUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; OGGalaxyBot/1.0)'
            },
            timeout: 10000
          });
          const subXml = await response.text();
          const subUrls = await parseSitemap(subXml, domain);
          urls.push(...subUrls);
        } catch (error) {
          console.error(`Error fetching sub-sitemap ${sitemapUrl}:`, error.message);
        }
      }
    }

    // Handle regular sitemap
    if (result.urlset) {
      const urlEntries = result.urlset.url || [];
      for (const entry of urlEntries) {
        if (entry.loc && entry.loc[0]) {
          urls.push(entry.loc[0]);
        }
      }
    }

    return urls;
  } catch (error) {
    throw new Error('Failed to parse sitemap: ' + error.message);
  }
}

// API endpoint to fetch OG images
app.post('/api/fetch-og-images', async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Clean domain (remove protocol if present)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Get URLs from sitemap
    console.log(`Fetching sitemap for ${cleanDomain}...`);
    const urls = await getSitemapUrls(cleanDomain);
    console.log(`Found ${urls.length} URLs in sitemap`);

    // Limit to first N URLs to avoid timeout
    const limitedUrls = urls.slice(0, DEFAULT_PROCESS_LIMIT);
    const unprocessedUrls = urls.slice(DEFAULT_PROCESS_LIMIT);

    // Fetch OG images in batches to avoid overwhelming servers
    const results = await processUrls(limitedUrls);

    // Separate pages with and without OG images
    const pagesWithImages = results.filter(r => r.ogImage);
    const pagesWithoutImages = results.filter(r => !r.ogImage);

    res.json({
      domain: cleanDomain,
      total: urls.length,
      processed: limitedUrls.length,
      found: pagesWithImages.length,
      notFound: pagesWithoutImages.length,
      unprocessed: unprocessedUrls.length,
      pagesWithImages: pagesWithImages,
      pagesWithoutImages: pagesWithoutImages,
      unprocessedPages: unprocessedUrls
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch OG images'
    });
  }
});

// API endpoint to process additional unprocessed URLs in batches
app.post('/api/process-unprocessed', async (req, res) => {
  try {
    const { urls, limit } = req.body;
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

    res.json({
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
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
