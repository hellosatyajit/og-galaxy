# Changelog

All notable changes to OG Galaxy will be documented in this file.

## [1.1.0] - 2026-02-14

### Added - Complete Page Status Tracking 🎯

#### New Features
- **Three-section display** showing status of every page:
  - ✅ Pages with OG images (image grid)
  - ⚠️ Pages without OG images (list view)
  - ⏸️ Unprocessed pages (list view)

#### Enhanced Statistics
- **Four metrics** instead of three:
  - OG Images Found (green)
  - Not Found (yellow)
  - Unprocessed (blue)
  - Total URLs (purple)

#### UI Improvements
- Color-coded section headers with counts
- Scrollable lists for non-image pages (400px max height)
- Custom scrollbar styling
- Icon indicators for each page type
- Better visual hierarchy

#### API Updates
- New response fields:
  - `notFound` - Count of pages without OG images
  - `unprocessed` - Count of unprocessed pages
  - `pagesWithoutImages` - Array of pages without OG images
  - `unprocessedPages` - Array of URLs not processed

### Changed
- Stats layout now shows 4 cards instead of 3
- Response structure expanded for better transparency
- Mobile responsive design improved

### Benefits
- Complete visibility into all pages
- Easy to identify pages missing OG images
- Understand processing limits
- Better debugging and QA

---

## [1.0.0] - 2026-02-14

### Added - Initial Release 🚀

#### Core Features
- Domain input for any website
- Automatic sitemap.xml fetching
- Sitemap parsing (handles indexes and regular sitemaps)
- OG image extraction from pages
- Beautiful dark theme UI
- Responsive image grid
- Shimmer loading animations

#### Backend
- Express.js server for local development
- Vercel serverless functions for production
- Batch processing (10 pages at a time)
- 50-page processing limit
- CORS support

#### Deployment
- Vercel-ready configuration
- One-command deployment
- GitHub integration support
- Custom domain support

#### Documentation
- README.md - Full documentation
- DEPLOYMENT.md - Deployment guide
- QUICKSTART.md - Quick start guide
- PROJECT_SUMMARY.md - Project overview
- DEPLOY_NOW.md - Quick deploy instructions
- VERCEL_CHECKLIST.md - Pre-deployment checklist

---

## Version History

- **1.1.0** - Complete page status tracking
- **1.0.0** - Initial release with core features

---

## Upgrade Notes

### From 1.0.0 to 1.1.0

No breaking changes! The API is backward compatible. New fields are added, existing fields remain the same.

**Old response** (1.0.0):
```json
{
  "found": 45,
  "pages": [...]
}
```

**New response** (1.1.0):
```json
{
  "found": 45,
  "notFound": 5,
  "unprocessed": 100,
  "pagesWithImages": [...],
  "pagesWithoutImages": [...],
  "unprocessedPages": [...]
}
```

If you're using the API programmatically, you can safely ignore the new fields or start using them for enhanced features.

---

## Roadmap

Future enhancements being considered:
- [ ] Increase processing limit (100+ pages)
- [ ] Pagination for large sitemaps
- [ ] Download images as ZIP
- [ ] Export results as JSON/CSV
- [ ] Support for twitter:image meta tags
- [ ] Image dimension detection
- [ ] Duplicate image detection
- [ ] Filter/search functionality
- [ ] Dark/light theme toggle
- [ ] Save results for later viewing
- [ ] Compare multiple domains
- [ ] Scheduling/monitoring

---

## Contributors

- Built with ❤️ for the web community
- Powered by Cursor AI

---

## License

MIT License - feel free to use, modify, and distribute!
