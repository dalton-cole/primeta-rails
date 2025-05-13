import { Controller } from "@hotwired/stimulus"
// Remove these imports that are causing the error
// import { defineMonacoTheme } from "../monaco"
// import * as monaco from "monaco-editor"

// Connects to data-controller="monaco"
export default class extends Controller {
  static values = {
    language: String,
    content: String,
    readOnly: Boolean,
    fileId: Number
  }
  
  // Throttling utility to limit function calls
  throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Debounce utility - only triggers after delay
  debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  connect() {
    this.editorInitialized = false;
    
    // Track view time
    this.startTime = new Date();
    
    // Throttled time tracking to reduce server load
    this.throttledTimeTracking = this.throttle(this.trackTimeSpent.bind(this), 30000); // 30 seconds
    
    // Setup periodic time tracking
    this.trackingInterval = setInterval(() => {
      this.throttledTimeTracking();
    }, 60000); // Every minute
    
    // Handle navigation away from page to record time spent
    this.boundRecordTimeSpent = this.recordTimeSpent.bind(this);
    window.addEventListener('beforeunload', this.boundRecordTimeSpent);
    
    // Use requestIdleCallback if available to initialize editor during browser idle time
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => this.loadMonaco());
    } else {
      // Fallback to setTimeout for browsers that don't support requestIdleCallback
      setTimeout(() => this.loadMonaco(), 50);
    }
  }
  
  loadMonaco() {
    // Load Monaco editor from CDN
    if (window.monaco) {
      this.initializeEditor();
    } else {
      // Check if another instance is already loading Monaco
      if (!window.monacoLoading) {
        window.monacoLoading = true;
        
        // Show loading indicator
        this.showLoadingIndicator();
        
        // Add Monaco loader script
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
        script.async = true;
        script.onload = () => {
          window.require.config({
            paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
          });
          
          window.require(['vs/editor/editor.main'], () => {
            window.monacoLoading = false;
            
            // Ensure our theme is defined after Monaco loads but before editor creation
            if (typeof window.applyPrimetaTheme === 'function') {
              window.applyPrimetaTheme();
            }
            
            this.hideLoadingIndicator();
            this.initializeEditor();
          });
        };
        document.head.appendChild(script);
      } else {
        // Another instance is loading Monaco, wait for it
        this.showLoadingIndicator();
        const checkInterval = setInterval(() => {
          if (window.monaco) {
            clearInterval(checkInterval);
            this.hideLoadingIndicator();
            this.initializeEditor();
          }
        }, 100);
      }
    }
  }
  
  showLoadingIndicator() {
    // Create a simple loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'monaco-loading';
    loadingEl.textContent = 'Loading editor...';
    loadingEl.style.padding = '1rem';
    loadingEl.style.textAlign = 'center';
    loadingEl.style.color = '#ccc';
    
    this.element.appendChild(loadingEl);
    this.loadingElement = loadingEl;
  }
  
  hideLoadingIndicator() {
    if (this.loadingElement && this.loadingElement.parentNode) {
      this.loadingElement.parentNode.removeChild(this.loadingElement);
      this.loadingElement = null;
    }
  }
  
  initializeEditor() {
    if (!window.monaco || this.editorInitialized) return;
    this.editorInitialized = true;
    
    // Actively ensure theme is applied
    if (typeof window.applyPrimetaTheme === 'function') {
      window.applyPrimetaTheme();
    }
    
    // Use viewport height units to fill the screen and full width
    this.element.style.height = '85vh'; // 85% of viewport height
    this.element.style.width = '100%';
    this.element.style.maxWidth = '100%';
    this.element.style.overflow = 'hidden';
    
    // Lazily compute the model - only create it when needed
    const getOrCreateModel = () => {
      const uri = `file:///${this.fileIdValue || 'anonymous'}.${this.languageValue || 'txt'}`;
      let model = window.monaco.editor.getModel(window.monaco.Uri.parse(uri));
      
      if (!model) {
        model = window.monaco.editor.createModel(
          this.contentValue || '',
          this.languageValue || 'plaintext',
          window.monaco.Uri.parse(uri)
        );
      }
      
      return model;
    };
    
    // Absolute minimal editor config for best performance
    this.editor = window.monaco.editor.create(this.element, {
      model: getOrCreateModel(),
      theme: 'primeta-dark',
      readOnly: this.readOnlyValue || false,
      automaticLayout: false, // We'll handle layout ourselves for better performance
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all', // Show current line highlight
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      renderIndentGuides: true, // Show indent guides for better readability
      contextmenu: false,
      folding: true, // Enable code folding
      glyphMargin: false,
      lineDecorationsWidth: 0,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      renderWhitespace: 'none',
      smoothScrolling: true, // Enable smooth scrolling
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never'
      }
    });
    
    // Use ResizeObserver for more efficient resize handling if available
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(
        this.debounce(() => {
          if (this.editor) this.editor.layout();
        }, 100)
      );
      this.resizeObserver.observe(this.element);
    } else {
      // Minimal resize handler with long debounce as fallback
      this.resizeHandler = this.debounce(() => {
        if (this.editor) this.editor.layout();
      }, 200);
      
      // Only resize on explicit window resize
      window.addEventListener('resize', this.resizeHandler);
    }
    
    // Initial layout
    setTimeout(() => {
      if (this.editor) this.editor.layout();
    }, 100);
  }
  
  // Periodic time tracking during active use
  trackTimeSpent() {
    if (this.startTime && !this.isDisconnecting) {
      const now = new Date();
      const timeSpent = Math.floor((now - this.startTime) / 1000); // in seconds
      
      if (timeSpent > 5) { // Only track if more than 5 seconds
        this.sendTimeTrackingRequest(timeSpent);
        // Reset start time for incremental tracking
        this.startTime = now;
      }
    }
  }
  
  disconnect() {
    this.isDisconnecting = true;
    
    // Clear tracking interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    
    // Final time recording
    if (this.editor) {
      this.recordTimeSpent();
      
      // Dispose the editor
      setTimeout(() => {
        if (this.editor) {
          this.editor.dispose();
          this.editor = null;
        }
      }, 0);
    }
    
    // Clean up resize handling
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    window.removeEventListener('beforeunload', this.boundRecordTimeSpent);
  }
  
  recordTimeSpent() {
    if (this.startTime) {
      const endTime = new Date();
      const timeSpent = Math.floor((endTime - this.startTime) / 1000); // in seconds
      
      // Only record if time spent is meaningful (more than 1 second)
      if (timeSpent > 1) {
        this.sendTimeTrackingRequest(timeSpent);
      }
    }
  }
  
  sendTimeTrackingRequest(timeSpent) {
    // Get the current path and determine if we're on a repository or repository file page
    const path = window.location.pathname;
    console.log(`Recording time spent: ${timeSpent} seconds on path: ${path}`);
    
    // Extract the resource type and ID
    let trackUrl = null;
    
    if (path.match(/^\/repositories\/\d+$/)) {
      // Repository page - /repositories/:id
      const repoId = path.split('/').pop();
      trackUrl = `/repositories/${repoId}/track_time`;
    } else if (path.match(/^\/repository_files\/\d+$/)) {
      // Repository file page - /repository_files/:id
      const fileId = path.split('/').pop();
      trackUrl = `/repository_files/${fileId}/track_time`;
    }
    
    // Only send the beacon if we have a valid track URL
    if (trackUrl) {
      console.log(`Sending time tracking request to: ${trackUrl}`);
      
      // Get the CSRF token from meta tag
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      // Use fetch with proper CSRF token instead of sendBeacon
      if (csrfToken) {
        fetch(trackUrl, {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `time_spent=${timeSpent}`,
          keepalive: true // Similar to sendBeacon, allows request to complete after page unload
        })
        .catch(err => console.error('Error tracking time:', err));
      }
    }
  }
}
