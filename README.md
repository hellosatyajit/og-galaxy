# OG Galaxy

Explore Open Graph images across any website. Enter a domain and see all OG images from the site's pages displayed in a beautiful grid.

## Features

- 🔍 Automatically fetches and parses sitemaps
- 🖼️ Extracts Open Graph images from all pages
- 📊 Complete page status tracking:
  - ✅ Pages with OG images (image grid)
  - ⚠️ Pages without OG images (list)
  - ⏸️ Unprocessed pages (list)
- 📈 Real-time stats for all page categories
- ⚡ Fast concurrent processing with batching
- 🌙 Dark mode design

## How it Works

1. Fetches the sitemap.xml from the provided domain
2. Parses all URLs from the sitemap
3. Visits each page and extracts the `og:image` meta tag
4. Displays all found images in a responsive grid

## Installation

```bash
npm install
```

## Usage

### Local Development

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter a domain (e.g., `example.com`) and click "Explore"

### Deploy to Vercel

#### Option 1: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"

That's it! Vercel will automatically detect the configuration and deploy your app.

#### Option 3: Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hellosatyajit/og-galaxy)

## Technical Details

- **Backend**: Node.js + Express (local) / Vercel Serverless Functions (production)
- **Sitemap Parsing**: xml2js
- **HTML Parsing**: Cheerio
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Design**: Minimal, dark theme
- **Deployment**: Vercel-ready with serverless architecture

## API Endpoint

`POST /api/fetch-og-images`

Request body:
```json
{
  "domain": "example.com"
}
```

Response:
```json
{
  "domain": "example.com",
  "total": 150,
  "processed": 50,
  "found": 45,
  "notFound": 5,
  "unprocessed": 100,
  "pagesWithImages": [
    {
      "url": "https://example.com/page1",
      "ogImage": "https://example.com/images/og1.jpg"
    }
  ],
  "pagesWithoutImages": [
    {
      "url": "https://example.com/page2",
      "ogImage": null
    }
  ],
  "unprocessedPages": [
    "https://example.com/page51",
    "https://example.com/page52"
  ]
}
```

## Limitations

- Processes up to 50 URLs per request (to avoid timeouts)
- Requires valid sitemap.xml on the target domain
- 10-second timeout per page fetch
