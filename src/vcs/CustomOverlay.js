// Daily.co VCS Custom Overlay Component
// This component creates a watermark with the Mentr logo and text

class CustomOverlay {
  constructor() {
    this.container = null;
    this.logo = null;
    this.text = null;
    this.isVisible = true;
  }

  // Initialize the overlay
  init() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.id = 'mentr-watermark';
    this.container.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 1000;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.9);
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      transition: opacity 0.3s ease;
    `;

    // Create the logo
    this.logo = document.createElement('div');
    this.logo.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#3b82f6"/>
        <path d="M8 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    this.logo.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create the text
    this.text = document.createElement('span');
    this.text.textContent = 'Mentr';
    this.text.style.cssText = `
      white-space: nowrap;
    `;

    // Assemble the components
    this.container.appendChild(this.logo);
    this.container.appendChild(this.text);

    // Add to the video container
    this.attachToVideoContainer();

    // Add hover effect
    this.addHoverEffect();

    console.log('Mentr watermark initialized');
  }

  // Attach the overlay to the video container
  attachToVideoContainer() {
    // Try to find the video container
    const videoContainer = document.querySelector('.daily-video-call') || 
                          document.querySelector('[data-testid="video-call"]') ||
                          document.querySelector('main') ||
                          document.body;

    if (videoContainer) {
      videoContainer.appendChild(this.container);
    } else {
      // Fallback: add to body
      document.body.appendChild(this.container);
    }
  }

  // Add hover effect to make it more interactive
  addHoverEffect() {
    this.container.addEventListener('mouseenter', () => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1.05)';
    });

    this.container.addEventListener('mouseleave', () => {
      this.container.style.opacity = '0.8';
      this.container.style.transform = 'scale(1)';
    });
  }

  // Toggle visibility
  toggle() {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'flex' : 'none';
  }

  // Show the overlay
  show() {
    this.isVisible = true;
    this.container.style.display = 'flex';
  }

  // Hide the overlay
  hide() {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  // Update text
  updateText(newText) {
    this.text.textContent = newText;
  }

  // Clean up
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = new CustomOverlay();
    overlay.init();
  });
} else {
  const overlay = new CustomOverlay();
  overlay.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomOverlay;
}
