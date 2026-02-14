# Quick Start Guide

## Getting Started in 30 Seconds

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm start
   ```

3. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Enter a domain (try `github.com`, `stripe.com`, or `vercel.com`)
   - Click "Explore"

## Example Domains to Try

- `github.com` - GitHub's blog and marketing pages
- `stripe.com` - Stripe's product pages
- `vercel.com` - Vercel's documentation
- `dev.to` - Developer articles
- `medium.com` - Medium articles

## What You'll See

The app will:
1. Fetch the sitemap.xml
2. Extract up to 50 URLs
3. Visit each page and grab the Open Graph image
4. Display them in a beautiful grid

## Troubleshooting

### "No sitemap found"
- Some sites don't have a sitemap.xml
- Try a different domain

### "Failed to fetch OG images"
- The site might be blocking requests
- Check your internet connection
- Try a different domain

### Images showing "Image unavailable"
- The OG image URL might be broken
- The site might be blocking image hotlinking
- This is normal for some images

## How It Works

```
User enters domain
    ↓
Fetch sitemap.xml
    ↓
Parse URLs from sitemap
    ↓
For each URL:
  - Fetch the page
  - Extract <meta property="og:image">
    ↓
Display in grid
```

Enjoy exploring OG images! 🚀
