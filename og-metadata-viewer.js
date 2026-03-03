class OGMetadataViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderRoot();
  }

  renderRoot() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --bg-overlay: rgba(0, 0, 0, 0.6);
          --bg-modal: #ffffff;
          --text-color: #333;
          --border-color: #e5e5e5;
          --primary-color: #111;
          --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1000;
          display: none;
          font-family: var(--font-family);
          color: var(--text-color);
        }

        :host(.open) {
          display: flex;
          animation: fadeIn 0.2s ease-out;
        }

        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--bg-overlay);
          backdrop-filter: blur(4px);
        }

        .modal {
          position: relative;
          background: var(--bg-modal);
          width: 90%;
          max-width: 800px;
          height: auto;
          max-height: 85vh;
          margin: auto;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          z-index: 10;
        }

        .header h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #111;
        }

        .close-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        }

        .close-btn:hover {
          background: #f0f0f0;
          color: #000;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        /* Mobile Drawer Styles */
        @media (max-width: 768px) {
          :host {
            align-items: flex-end;
          }

          .modal {
            width: 100%;
            max-width: 100%;
            margin: 0;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            height: 85vh;
            max-height: 85vh;
            border-radius: 20px 20px 0 0;
            animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes slideUpMobile {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Content Styling */
        .preview-section {
          margin-bottom: 32px;
        }

        .preview-card {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        }

        .preview-image-container {
          width: 100%;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          overflow: hidden;
        }

        .preview-image {
          width: 100%;
          height: auto;
          display: block;
          max-height: 400px;
          object-fit: cover;
        }
        
        .preview-image.contain {
           object-fit: contain;
           padding: 20px;
        }

        .preview-meta {
          padding: 20px;
        }

        .preview-title {
          font-weight: 700;
          font-size: 1.2rem;
          margin-bottom: 8px;
          color: #111;
          line-height: 1.3;
        }

        .preview-desc {
          font-size: 0.95rem;
          color: #555;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .preview-url {
          font-size: 0.8rem;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metadata-grid {
          display: grid;
          gap: 24px;
        }

        .metadata-group {
          background: #f9f9f9;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color);
        }

        .group-title {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 16px;
          letter-spacing: 1px;
        }

        .meta-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 16px;
          margin-bottom: 12px;
          font-size: 0.9rem;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding-bottom: 12px;
        }

        .meta-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .meta-key {
          font-weight: 600;
          color: #444;
          word-break: break-word;
          font-family: monospace;
          font-size: 0.85rem;
        }

        .meta-value {
          color: #222;
          word-break: break-all;
          line-height: 1.5;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #666;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #eee;
          border-top-color: #111;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          color: #d32f2f;
          text-align: center;
          padding: 30px;
          background: #fff5f5;
          border-radius: 12px;
          border: 1px solid #ffcdd2;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
      </style>
      
      <div class="overlay"></div>
      <div class="modal">
        <div class="header">
          <h2>Open Graph Explorer</h2>
          <button class="close-btn" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="content" id="content"></div>
      </div>
    `;

    this.overlay = this.shadowRoot.querySelector('.overlay');
    this.closeBtn = this.shadowRoot.querySelector('.close-btn');
    this.content = this.shadowRoot.querySelector('#content');
    this.modal = this.shadowRoot.querySelector('.modal');

    const closeHandler = () => this.close();
    this.overlay.addEventListener('click', closeHandler);
    this.closeBtn.addEventListener('click', closeHandler);
    
    // Handle ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open')) {
        this.close();
      }
    });
  }

  async open(url) {
    this.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    this.content.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <span>Fetching metadata...</span>
      </div>
    `;

    try {
      const response = await fetch(`/api/v1/metadata/og?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata (${response.status})`);
      }
      const data = await response.json();
      this.render(data, url);
    } catch (error) {
      this.content.innerHTML = `
        <div class="error-message">
          <h3>Unable to load metadata</h3>
          <p>${error.message}</p>
          <p>Please check the URL and try again.</p>
        </div>
      `;
    }
  }

  close() {
    this.classList.remove('open');
    document.body.style.overflow = '';
  }

  render(data, originalUrl) {
    if (!data || Object.keys(data).length === 0) {
      this.content.innerHTML = '<div class="empty-state">No Open Graph data found for this URL.</div>';
      return;
    }

    // Extract key fields for preview
    // Prioritize og:image, then twitter:image, then og:image:url
    const image = data['og:image'] || data['og:image:url'] || data['twitter:image'] || '';
    const title = data['og:title'] || data['twitter:title'] || 'No Title';
    const description = data['og:description'] || data['twitter:description'] || '';
    const url = data['og:url'] || originalUrl;
    const siteName = data['og:site_name'] || '';
    
    // Group remaining properties
    const groups = {
      'Basic Info': {},
      'Images': {},
      'Twitter Card': {},
      'Article': {},
      'Other': {}
    };

    // Helper to categorize keys
    Object.entries(data).forEach(([key, value]) => {
      // Skip main display items if redundant, but sometimes good to show in list too
      // Let's keep everything in the list for completeness, but maybe group them nicely.
      
      if (key.startsWith('og:image')) {
          groups['Images'][key] = value;
      } else if (key.startsWith('twitter:')) {
          groups['Twitter Card'][key] = value;
      } else if (key.startsWith('article:')) {
          groups['Article'][key] = value;
      } else if (key.startsWith('og:')) {
          groups['Basic Info'][key] = value;
      } else {
          groups['Other'][key] = value;
      }
    });

    // Build HTML
    let html = `
      <div class="preview-section">
        <div class="preview-card">
          ${image ? `
            <div class="preview-image-container">
                <img src="${image}" alt="OG Preview" class="preview-image" onerror="this.style.display='none'">
            </div>
          ` : ''}
          <div class="preview-meta">
            ${siteName ? `<div style="font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">${siteName}</div>` : ''}
            <div class="preview-title">${title}</div>
            ${description ? `<div class="preview-desc">${description}</div>` : ''}
            <div class="preview-url">${url}</div>
          </div>
        </div>
      </div>
      <div class="metadata-grid">
    `;

    // Render groups
    const renderGroup = (title, items) => {
        if (Object.keys(items).length === 0) return '';
        return `
            <div class="metadata-group">
                <div class="group-title">${title}</div>
                ${Object.entries(items).map(([k, v]) => `
                    <div class="meta-row">
                        <div class="meta-key">${k}</div>
                        <div class="meta-value">${v}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Order of groups
    html += renderGroup('Basic Info', groups['Basic Info']);
    html += renderGroup('Images Details', groups['Images']);
    html += renderGroup('Twitter Card', groups['Twitter Card']);
    html += renderGroup('Article Data', groups['Article']);
    html += renderGroup('Other Metadata', groups['Other']);

    html += '</div>'; // End grid
    this.content.innerHTML = html;
  }
}

customElements.define('og-metadata-viewer', OGMetadataViewer);
