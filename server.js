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
const SITEMAP_PATH_CANDIDATES = ['/sitemap.xml', '/sitemap_index.xml'];

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

function normalizeInput(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function parseInputUrl(input) {
  const normalizedInput = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(input)
    ? input
    : `https://${input}`;

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedInput);
  } catch (error) {
    throw new Error('Please enter a valid domain or sitemap URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Please use an HTTP(S) domain or sitemap URL');
  }

  return parsedUrl;
}

function isLikelySitemapPath(pathname = '') {
  if (!pathname || pathname === '/') {
    return false;
  }

  const lowerPath = pathname.toLowerCase();
  return (
    lowerPath.includes('sitemap') ||
    lowerPath.endsWith('.xml') ||
    lowerPath.endsWith('.xml.gz')
  );
}

function getProtocolCandidates(protocol) {
  if (protocol === 'http:') {
    return ['http:', 'https:'];
  }

  if (protocol === 'https:') {
    return ['https:', 'http:'];
  }

  return ['https:', 'http:'];
}

function buildSitemapCandidateUrls(inputUrl) {
  const candidates = [];
  const seen = new Set();
  const protocols = getProtocolCandidates(inputUrl.protocol);
  const addCandidate = (candidateUrl) => {
    if (!seen.has(candidateUrl)) {
      seen.add(candidateUrl);
      candidates.push(candidateUrl);
    }
  };

  if (isLikelySitemapPath(inputUrl.pathname)) {
    addCandidate(inputUrl.toString());

    for (const protocol of protocols) {
      const protocolVariant = new URL(inputUrl.toString());
      protocolVariant.protocol = protocol;
      addCandidate(protocolVariant.toString());
    }
  }

  for (const protocol of protocols) {
    for (const sitemapPath of SITEMAP_PATH_CANDIDATES) {
      const sitemapUrl = new URL(sitemapPath, `${protocol}//${inputUrl.host}`).toString();
      addCandidate(sitemapUrl);
    }
  }

  return candidates;
}

async function fetchSitemapDocument(sitemapUrl) {
  const response = await fetch(sitemapUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OGGalaxyBot/1.0)'
    },
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`Sitemap request failed (${response.status})`);
  }

  return response.text();
}

// Helper function to get sitemap URLs
async function getSitemapUrls(input) {
  const normalizedInput = normalizeInput(input);

  if (!normalizedInput) {
    throw new Error('Domain or sitemap URL is required');
  }

  const inputUrl = parseInputUrl(normalizedInput);
  const sitemapCandidateUrls = buildSitemapCandidateUrls(inputUrl);
  let lastError = new Error('No sitemap found');

  for (const sitemapUrl of sitemapCandidateUrls) {
    try {
      const xml = await fetchSitemapDocument(sitemapUrl);
      const urls = await parseSitemap(xml, new Set([sitemapUrl]));

      return {
        urls,
        cleanDomain: inputUrl.host || inputUrl.hostname,
        resolvedSitemapUrl: sitemapUrl
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`No sitemap found (${lastError.message})`);
}

// Parse sitemap XML
async function parseSitemap(xml, visitedSitemaps = new Set()) {
  try {
    const result = await parseXml(xml);
    const urls = new Set();
    const hasSitemapIndex = Boolean(result.sitemapindex);
    const hasUrlset = Boolean(result.urlset);

    if (!hasSitemapIndex && !hasUrlset) {
      throw new Error('Invalid sitemap format');
    }

    // Handle sitemap index (contains links to other sitemaps)
    if (hasSitemapIndex) {
      const sitemaps = result.sitemapindex.sitemap || [];
      for (const sitemap of sitemaps) {
        const sitemapUrl = typeof sitemap?.loc?.[0] === 'string'
          ? sitemap.loc[0].trim()
          : '';

        if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) {
          continue;
        }

        visitedSitemaps.add(sitemapUrl);

        try {
          const subXml = await fetchSitemapDocument(sitemapUrl);
          const subUrls = await parseSitemap(subXml, visitedSitemaps);
          subUrls.forEach((url) => urls.add(url));
        } catch (error) {
          console.error(`Error fetching sub-sitemap ${sitemapUrl}:`, error.message);
        }
      }
    }

    // Handle regular sitemap
    if (hasUrlset) {
      const urlEntries = result.urlset.url || [];
      for (const entry of urlEntries) {
        const pageUrl = typeof entry?.loc?.[0] === 'string'
          ? entry.loc[0].trim()
          : '';

        if (pageUrl) {
          urls.add(pageUrl);
        }
      }
    }

    return Array.from(urls);
  } catch (error) {
    throw new Error('Failed to parse sitemap: ' + error.message);
  }
}

// API endpoint to fetch OG images
app.post('/api/fetch-og-images', async (req, res) => {
  try {
    const { domain, input } = req.body || {};
    const submittedInput = normalizeInput(domain || input);

    if (!submittedInput) {
      return res.status(400).json({ error: 'Domain or sitemap URL is required' });
    }

    // Get URLs from sitemap
    console.log(`Fetching sitemap for ${submittedInput}...`);
    const { urls, cleanDomain, resolvedSitemapUrl } = await getSitemapUrls(submittedInput);
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
      sitemapUrl: resolvedSitemapUrl,
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
