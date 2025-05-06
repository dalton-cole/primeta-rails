import { Controller } from "@hotwired/stimulus"
// Remove the direct import that's causing the error
// import * as monaco from "monaco-editor"

// Connects to data-controller="monaco"
export default class extends Controller {
  static values = {
    language: String,
    content: String,
    readOnly: Boolean
  }
  
  connect() {
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
          this.initializeEditor();
        });
      };
      document.head.appendChild(script);
    }
    
    // Track view time
    this.startTime = new Date()
    
    window.addEventListener('resize', this.resizeEditor.bind(this))
    
    // Handle navigation away from page to record time spent
    window.addEventListener('beforeunload', this.recordTimeSpent.bind(this))
  }
  
  initializeEditor() {
    const monaco = window.monaco;
    const theme = 'vs-dark';
    
    // Define theme colors
    monaco.editor.defineTheme('primeta-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' }
      ],
      colors: {
        'editor.background': '#0A0A23', // Brand dark navy
        'editor.foreground': '#F5F7FA', // Brand light gray
        'editorCursor.foreground': '#2979FF', // Brand electric blue
        'editor.lineHighlightBackground': '#1E1E3F',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#2979FF', // Brand electric blue
        'editor.selectionBackground': '#2979FF33', // Transparent electric blue
        'editorIndentGuide.background': '#2F2F55'
      }
    });
    
    // Set default theme
    monaco.editor.setTheme('primeta-dark');
    
    // Ensure content has proper line breaks
    const processedContent = this.ensureProperLineBreaks(this.contentValue || '');
    
    this.editor = monaco.editor.create(this.element, {
      value: processedContent,
      language: this.languageValue || 'plaintext',
      theme: 'primeta-dark',
      readOnly: this.readOnlyValue || false,
      automaticLayout: true,
      minimap: {
        enabled: true
      },
      wordWrap: 'on',
      wrappingIndent: 'same',
      wrappingStrategy: 'advanced',
      scrollBeyondLastLine: false,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineNumbers: "on",
      renderIndentGuides: true,
      scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    })
  }
  
  // Helper method to ensure content has proper line breaks
  ensureProperLineBreaks(content) {
    if (!content) return '';
    
    // If the content doesn't have line breaks, try to detect and add them
    if (!content.includes('\n')) {
      // For common programming languages, try to add breaks after semicolons, braces
      return content
        .replace(/;\s*/g, ';\n')
        .replace(/{\s*/g, '{\n')
        .replace(/}\s*/g, '}\n')
        .replace(/>\s*</g, '>\n<');
    }
    
    return content;
  }
  
  disconnect() {
    if (this.editor) {
      this.recordTimeSpent()
      this.editor.dispose()
    }
    
    window.removeEventListener('resize', this.resizeEditor.bind(this))
    window.removeEventListener('beforeunload', this.recordTimeSpent.bind(this))
  }
  
  resizeEditor() {
    if (this.editor) {
      this.editor.layout()
    }
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
