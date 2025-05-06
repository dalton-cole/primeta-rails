import { Controller } from "@hotwired/stimulus"
// Remove these imports that are causing the error
// import { defineMonacoTheme } from "../monaco"
// import * as monaco from "monaco-editor"

// Connects to data-controller="monaco"
export default class extends Controller {
  static values = {
    language: String,
    content: String,
    readOnly: Boolean
  }
  
  connect() {
    // Track view time
    this.startTime = new Date()
    
    // Handle navigation away from page to record time spent
    window.addEventListener('beforeunload', this.recordTimeSpent.bind(this))
    
    // Load Monaco editor from CDN
    if (window.monaco) {
      this.initializeEditor();
    } else {
      // Add Monaco loader script
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
      script.async = true;
      script.onload = () => {
        window.require.config({
          paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
        });
        
        window.require(['vs/editor/editor.main'], () => {
          // Ensure our theme is defined after Monaco loads but before editor creation
          if (typeof window.applyPrimetaTheme === 'function') {
            window.applyPrimetaTheme();
          }
          this.initializeEditor();
        });
      };
      document.head.appendChild(script);
    }
  }
  
  initializeEditor() {
    if (!window.monaco) return;
    
    // Actively ensure theme is applied
    if (typeof window.applyPrimetaTheme === 'function') {
      window.applyPrimetaTheme();
    }
    
    // Use viewport height units to fill the screen and full width
    this.element.style.height = '85vh'; // 85% of viewport height
    this.element.style.width = '100%';
    this.element.style.maxWidth = '100%';
    this.element.style.overflow = 'hidden';
    
    // Absolute minimal editor config for best performance
    this.editor = window.monaco.editor.create(this.element, {
      value: this.contentValue || '',
      language: this.languageValue || 'plaintext',
      theme: 'primeta-dark',
      readOnly: this.readOnlyValue || false,
      automaticLayout: true, // Enable auto layout to better handle resizing
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
    
    // Minimal resize handler with long debounce
    let resizeTimeout;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.editor) this.editor.layout();
      }, 500); // Very long debounce
    };
    
    // Only resize on explicit window resize
    window.addEventListener('resize', handleResize);
    this.resizeHandler = handleResize;
    
    // Initial layout
    setTimeout(() => {
      if (this.editor) this.editor.layout();
    }, 100);
  }
  
  disconnect() {
    if (this.editor) {
      this.recordTimeSpent();
      this.editor.dispose();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    window.removeEventListener('beforeunload', this.recordTimeSpent.bind(this));
  }
  
  recordTimeSpent() {
    if (this.startTime) {
      const endTime = new Date()
      const timeSpent = Math.floor((endTime - this.startTime) / 1000) // in seconds
      
      // Only record if time spent is meaningful (more than 1 second)
      if (timeSpent > 1) {
        // Get the current path and determine if we're on a repository or repository file page
        const path = window.location.pathname
        console.log(`Recording time spent: ${timeSpent} seconds on path: ${path}`)
        
        // Extract the resource type and ID
        let trackUrl = null
        
        if (path.match(/^\/repositories\/\d+$/)) {
          // Repository page - /repositories/:id
          const repoId = path.split('/').pop()
          trackUrl = `/repositories/${repoId}/track_time`
          console.log(`Tracking repository time: ${repoId}`)
        } else if (path.match(/^\/repository_files\/\d+$/)) {
          // Repository file page - /repository_files/:id
          const fileId = path.split('/').pop()
          trackUrl = `/repository_files/${fileId}/track_time`
          console.log(`Tracking repository file time: ${fileId}`)
        }
        
        // Only send the beacon if we have a valid track URL
        if (trackUrl) {
          console.log(`Sending time tracking request to: ${trackUrl}`)
          
          // Get the CSRF token from meta tag
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          console.log(`CSRF Token found: ${csrfToken ? 'Yes' : 'No'}`)
          
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
            .then(response => {
              console.log(`Time tracking response status: ${response.status}`)
              if (!response.ok) {
                console.error(`Time tracking failed with status: ${response.status}`)
              } else {
                console.log(`Successfully tracked ${timeSpent} seconds`)
                // If we're on a file page, reload to show updated time
                if (path.match(/^\/repository_files\/\d+$/)) {
                  window.location.reload()
                }
              }
            })
            .catch(err => console.error('Error tracking time:', err))
          }
        }
      }
    }
  }
}
