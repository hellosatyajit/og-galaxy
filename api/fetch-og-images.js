import fetch from 'node-fetch';
import { parseString } from 'xml2js';
import { load } from 'cheerio';
import { promisify } from 'util';

const parseXml = promisify(parseString);

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

    // Limit to first 50 URLs to avoid timeout
    const limitedUrls = urls.slice(0, 50);
    const unprocessedUrls = urls.slice(50);

    // Fetch OG images in batches to avoid overwhelming servers
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < limitedUrls.length; i += batchSize) {
      const batch = limitedUrls.slice(i, i + batchSize);
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

    // Separate pages with and without OG images
    const pagesWithImages = results.filter(r => r.ogImage);
    const pagesWithoutImages = results.filter(r => !r.ogImage);

    res.status(200).json({
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
}
