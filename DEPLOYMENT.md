# Deployment Guide

## Vercel Deployment (Recommended)

This project is optimized for Vercel and uses serverless functions for the backend.

### Quick Deploy

#### Method 1: Vercel CLI (Fastest)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel (first time only)
vercel login

# Deploy to production
vercel --prod
```

Your app will be live in seconds! Vercel will give you a URL like `https://og-galaxy.vercel.app`

#### Method 2: GitHub Integration (Recommended for Teams)

1. **Push to GitHub**
   ```bash
   git push origin cursor/open-graph-image-grid-0110
   ```

2. **Connect to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Project"
   - Select your GitHub repository
   - Click "Import"

3. **Deploy**
   - Vercel auto-detects the configuration
   - Click "Deploy"
   - Done! 🎉

4. **Auto-Deployments**
   - Every push to your main branch = automatic deployment
   - Pull requests get preview deployments

#### Method 3: Deploy Button

Click this button to deploy your own copy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hellosatyajit/og-galaxy)

### Configuration

The project includes:
- ✅ `vercel.json` - Vercel configuration
- ✅ `api/fetch-og-images.js` - Serverless function
- ✅ `.vercelignore` - Files to exclude from deployment

No additional configuration needed!

### Environment Variables

This project doesn't require any environment variables, but if you want to add any:

1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add your variables
4. Redeploy

### Custom Domain

1. Go to your Vercel project
2. Settings → Domains
3. Add your custom domain
4. Follow DNS instructions
5. Done!

### Local Testing of Production Build

```bash
# Install Vercel CLI
npm install -g vercel

# Run locally with serverless functions
vercel dev
```

This simulates the Vercel production environment locally.

---

## Other Deployment Options

### Heroku

1. Create `Procfile`:
   ```
   web: node server.js
   ```

2. Deploy:
   ```bash
   heroku create og-galaxy
   heroku git:remote -a og-galaxy
   git push heroku main
   ```

### Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects Node.js and deploys

### Render

1. Go to [render.com](https://render.com)
2. Click "New Web Service"
3. Connect your repository
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Deploy

### DigitalOcean App Platform

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Create → App
3. Connect your repository
4. DigitalOcean auto-configures
5. Deploy

---

## Troubleshooting

### "Function execution timeout"
- Vercel free tier has a 10-second timeout
- The app limits to 50 URLs to prevent this
- Consider upgrading to Pro for 60-second timeout

### "Module not found"
- Make sure all dependencies are in `package.json`
- Run `npm install` locally to verify

### CORS errors
- The serverless function includes CORS headers
- Should work out of the box

### Images not loading
- Some sites block hotlinking
- This is expected behavior
- The app shows "Image unavailable" placeholder

---

## Monitoring

### Vercel Analytics

Enable analytics in Vercel dashboard to track:
- Page views
- Performance metrics
- Error rates

### Logs

View function logs:
```bash
vercel logs
```

Or in the Vercel dashboard → Deployments → Click deployment → Logs

---

## Cost

- **Vercel Free Tier**: Perfect for this project
  - 100 GB bandwidth/month
  - Serverless function execution
  - Automatic HTTPS
  - Global CDN

For most personal use cases, this will stay free!

Happy deploying! 🚀
