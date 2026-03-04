import express from 'express';
import fetch from 'node-fetch';
import { parseString } from 'xml2js';
import { load } from 'cheerio';
import cors from 'cors';
import { promisify } from 'util';
import pLimit from 'p-limit';
import { body, query, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 3000;
const parseXml = promisify(parseString);
const DEFAULT_PROCESS_LIMIT = process.env.DEFAULT_PROCESS_LIMIT || 50;
const MAX_PROCESS_LIMIT = process.env.MAX_PROCESS_LIMIT || 200;
const PROCESS_BATCH_SIZE = process.env.PROCESS_BATCH_SIZE || 10;
const SITEMAP_PATH_CANDIDATES = ['/sitemap.xml', '/sitemap_index.xml'];
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const cache = new Map();
const USER_AGENT = 'Mozilla/5.0 (compatible; OGGalaxyBot/1.0; +https://og.satyajit.xyz)';


async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  cache.delete(key);
  return null;
}

function setInCache(key, value) {
  const expires = Date.now() + CACHE_TTL;
  cache.set(key, { value, expires });
}


app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Helper function to extract OG image from HTML
async function getOgImage(url) {
  const cached = getFromCache(`og:${url}`);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
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
    
    setInCache(`og:${url}`, ogImage || null);
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
  const limit = pLimit(PROCESS_BATCH_SIZE);
  const results = await Promise.all(
    urls.map(url => limit(() => getOgImage(url).then(ogImage => ({ url, ogImage }))))
  );
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
  const response = await fetchWithTimeout(sitemapUrl, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Sitemap request failed (${response.status})`);
  }

  return response.text();
}

// Helper function to get sitemap URLs
async function getSitemapUrls(input) {
  const cached = getFromCache(`sitemap:${input}`);
  if (cached) {
    return cached;
  }

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

      const result = {
        urls,
        cleanDomain: inputUrl.host || inputUrl.hostname,
        resolvedSitemapUrl: sitemapUrl
      };
      setInCache(`sitemap:${input}`, result);
      return result;
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
app.post('/api/fetch-og-images', 
  body('domain').notEmpty().isURL().trim().escape(),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
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
app.post('/api/process-unprocessed',
  body('urls').isArray(),
  body('urls.*').isURL(),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
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

// Helper function to get all metadata for a URL
async function getMetadata(url) {
  const cached = getFromCache(`meta:${url}`);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    }, 15000); // 15 seconds
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const $ = load(html);
    const metadata = {};
    $('meta').each((i, el) => {
      const property = $(el).attr('property') || $(el).attr('name');
      const content = $(el).attr('content');
      if (property && content) {
        metadata[property] = content;
      }
    });
    setInCache(`meta:${url}`, metadata);
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error.message);
    return null;
  }
}

app.get('/api/v1/metadata/og',
  query('url').isURL(),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { url } = req.query;
  try {
    const metadata = await getMetadata(url);
    if (!metadata) {
      return res.status(404).json({ error: 'Metadata not found' });
    }
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


