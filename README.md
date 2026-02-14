# OG Galaxy

Explore Open Graph images across any website. Enter a domain and see all OG images from the site's pages displayed in a beautiful grid.

## Features

- 🔍 Automatically fetches and parses sitemaps
- 🖼️ Extracts Open Graph images from all pages
- 📊 Clean, minimal interface with image grid
- ⚡ Fast concurrent processing
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

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter a domain (e.g., `example.com`) and click "Explore"

## Technical Details

- **Backend**: Node.js + Express
- **Sitemap Parsing**: xml2js
- **HTML Parsing**: Cheerio
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Design**: Minimal, dark theme

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
  "pages": [
    {
      "url": "https://example.com/page1",
      "ogImage": "https://example.com/images/og1.jpg"
    }
  ]
}
```

## Limitations

- Processes up to 50 URLs per request (to avoid timeouts)
- Requires valid sitemap.xml on the target domain
- 10-second timeout per page fetch
