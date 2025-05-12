import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="inline-editor"
export default class extends Controller {
  static targets = ["infoPanel", "editorContainer", "fileTitle", "fileStats", "filePath"];
  static values = {
    repositoryId: Number
  }
  
  connect() {
    console.log("Inline editor controller connected");
    
    // Check if required targets are present
    if (!this.hasInfoPanelTarget) {
      console.error("Missing infoPanel target");
    }
    
    if (!this.hasEditorContainerTarget) {
      console.error("Missing editorContainer target");
    } else {
      console.log("editorContainer found:", this.editorContainerTarget);
    }
    
    // Log all targets for debugging
    console.log("Targets found:", {
      infoPanel: this.hasInfoPanelTarget,
      editorContainer: this.hasEditorContainerTarget,
      fileTitle: this.hasFileTitleTarget,
      fileStats: this.hasFileStatsTarget,
      filePath: this.hasFilePathTarget
    });
    
    // Check for Monaco
    if (window.monaco) {
      console.log("Monaco is already available on page load");
    } else {
      console.log("Monaco is not available on page load");
    }
    
    // Check repositories controller values
    if (this.hasRepositoryIdValue) {
      console.log("Repository ID:", this.repositoryIdValue);
    } else {
      console.warn("No repository ID value found");
    }
    
    // Initialize state
    this.currentFileId = null;
    this.currentFilePath = null;
    this.editor = null;
    this.startTime = null;
    
    // Add event handler for beforeunload to track time
    window.addEventListener('beforeunload', this.recordTimeSpent.bind(this));
    
    // Add a small delay to allow DOM to be fully rendered
    setTimeout(() => {
      // Check if we should highlight the last viewed file
      if (this.lastViewedFileId) {
        const fileLinks = document.querySelectorAll(`a[data-file-id="${this.lastViewedFileId}"]`);
        fileLinks.forEach(link => {
          link.classList.add('current-file');
        });
      }
    }, 100);
  }
  
  disconnect() {
    // Clean up when controller is disconnected
    if (this.editor) {
      this.recordTimeSpent();
      this.editor.dispose();
    }
    
    // Remove resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    window.removeEventListener('beforeunload', this.recordTimeSpent.bind(this));
  }
  
  // Show the Monaco editor and load file content
  async showFile(event) {
    event.preventDefault();
    console.log("showFile method called");
    
    const fileLink = event.currentTarget;
    const fileId = fileLink.dataset.fileId;
    const filePath = fileLink.dataset.path || fileLink.textContent.trim();
    
    console.log("File selected:", { fileId, filePath });
    
    if (!fileId) {
      console.error("No fileId found in the clicked element");
      return;
    }
    
    try {
      // Record time for previous file if needed
      if (this.currentFileId) {
        this.recordTimeSpent();
      }
      
      // Update current file ID and path
      this.currentFileId = fileId;
      this.currentFilePath = filePath;
      
      // Dispatch a custom event for the AI assistant to respond to
      document.dispatchEvent(new CustomEvent('monaco:file-selected', {
        detail: {
          fileId: fileId,
          filePath: filePath,
          repositoryId: this.repositoryIdValue
        }
      }));
      
      // Remove highlight from previously selected file and add to current
      document.querySelectorAll('.file-item a.current-file').forEach(el => {
        el.classList.remove('current-file');
      });
      
      // If it's a traditional file link in the file tree
      if (fileLink.tagName === 'A') {
      fileLink.classList.add('current-file');
      fileLink.classList.add('viewed-file'); // Also mark as viewed
      }
      
      // Handle key file items (both in key files tab and in concept files)
      const keyFileItems = document.querySelectorAll(`.key-file-item[data-file-id="${fileId}"]`);
      keyFileItems.forEach(item => {
        item.classList.add('viewed');
        
        // If this element has a Turbo frame, request an update to show viewed status
        if (item.dataset.turboFrame) {
          // Send a Turbo Stream update to mark this file as viewed
          fetch(`/repository_files/${fileId}/mark_viewed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/vnd.turbo-stream.html',
              'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            }
          });
        }
      });
      
      // Expand all parent directories of the selected file
      let parentElement = fileLink.closest('.dir-contents');
      while (parentElement) {
        const dirItem = parentElement.closest('.dir-item');
        if (dirItem) {
          dirItem.classList.add('expanded');
          parentElement = dirItem.parentElement.closest('.dir-contents');
        } else {
          break;
        }
      }
      
      // Safer scroll method - manually adjust scroll position without using scrollIntoView
      setTimeout(() => {
        const fileTree = document.querySelector('.file-tree');
        if (fileTree) {
          const fileLinkRect = fileLink.getBoundingClientRect();
          const fileTreeRect = fileTree.getBoundingClientRect();
          
          // Check if the file link is outside the visible area of the file tree
          if (fileLinkRect.top < fileTreeRect.top || fileLinkRect.bottom > fileTreeRect.bottom) {
            // Calculate how much to scroll to get the file link in view
            // We'll position it about 30% down from the top of the visible area
            const scrollTarget = fileLinkRect.top + fileTree.scrollTop - fileTreeRect.top - (fileTreeRect.height * 0.3);
            fileTree.scrollTo({
              top: scrollTarget,
              behavior: 'smooth'
            });
          }
        }
      }, 100);
      
      // Check if targets exist
      if (!this.hasInfoPanelTarget || !this.hasEditorContainerTarget) {
        console.error("Missing required targets: infoPanel or editorContainer");
        return;
      }
      
      // Hide info panel
      this.infoPanelTarget.style.display = 'none';
      
      // Make editor container visible
      this.editorContainerTarget.style.display = 'flex';
      this.editorContainerTarget.innerHTML = '<div class="loading">Loading file...</div>';
      
      console.log("Loading file content for ID:", fileId);
      
      // Fetch file content
      const response = await fetch(`/repository_files/${fileId}/content`);
      if (!response.ok) throw new Error('Failed to load file content');
      
      const fileData = await response.json();
      
      // Add header elements with file info
      this.ensureHeaderElements();
      
      // Set file info
      if (this.hasFileTitleTarget) {
        this.fileTitleTarget.textContent = this.currentFilePath.split('/').pop();
      }
      
      if (this.hasFilePathTarget) {
        this.filePathTarget.textContent = this.currentFilePath;
      }
      
      // Update stats if available
      if (this.hasFileStatsTarget && fileData.file_view) {
        this.updateFileStats(fileData.file_view);
      }
      
      // Record start time for this file view
      this.startTime = new Date();
      
      // Initialize Monaco editor
      this.initializeEditor(fileData.content, fileData.language);
      
      console.log("File display complete");
      
    } catch (error) {
      console.error("Error displaying file:", error);
      
      // Show error message
      if (this.hasEditorContainerTarget) {
        this.editorContainerTarget.innerHTML = `
          <div class="error-box">
            <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="error-message">
              <h3>Error Loading File</h3>
              <p>${error.message}</p>
              <button class="btn btn-outline" onclick="window.location.reload()">Refresh Page</button>
            </div>
          </div>
        `;
      }
    }
  }
  
  // Ensure editor header elements exist
  ensureHeaderElements() {
    if (!this.hasEditorContainerTarget) return;
    
    // Always rebuild the interface to ensure consistent structure
    console.log("Building editor interface elements");
    
    // Clear the container first
    this.editorContainerTarget.innerHTML = '';
    
    // Build header structure with improved layout
    let editorHtml = `
      <div class="editor-header" style="flex-shrink: 0; margin-bottom: 10px;">
        <div class="file-title-container">
          <button data-action="click->inline-editor#showInfo" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="back-icon">
              <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zm6 11.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm4.5-2.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0-2.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0-2.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-7-1a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/>
            </svg>
            <span>Overview Dashboard</span>
          </button>
          <h2 data-inline-editor-target="fileTitle" class="file-title"></h2>
        </div>
      </div>
      <div id="monaco-container" style="flex: 1 1 auto; min-height: 0; height: auto;"></div>
      <div class="file-footer" style="flex-shrink: 0; margin-top: 10px;">
        <div class="file-path">
          <span class="file-icon">📄</span>
          <span data-inline-editor-target="filePath" class="file-path-container"></span>
        </div>
        <div data-inline-editor-target="fileStats" class="file-stats"></div>
      </div>
    `;
    
    // Add to DOM
    this.editorContainerTarget.innerHTML = editorHtml;
    
    // Force Stimulus to reconnect to the new elements
    if (this.application) {
      this.application.controllers.forEach(controller => {
        if (controller.context.identifier === 'inline-editor') {
          controller.connect();
        }
      });
    }
  }
  
  // Initialize or update the Monaco editor
  initializeEditor(content, language) {
    console.log("Initializing editor with language:", language);
    
    // First dispose of any existing editor
    if (this.editor) {
      console.log("Disposing existing editor");
      this.editor.dispose();
      this.editor = null;
    }
    
    try {
      if (!window.monaco) {
        console.error("Monaco is not available!");
        this.loadMonaco(content, language);
        return;
      }
      
      // Create a new editor
      this.createEditor(content, language);
    } catch (error) {
      console.error("Error initializing editor:", error);
      this.editorContainerTarget.innerHTML = `<div class="error">Error creating editor: ${error.message}</div>`;
    }
  }
  
  loadMonaco(content, language) {
    console.log("Loading Monaco from CDN");
    // Add Monaco loader script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
    script.async = true;
    script.onload = () => {
      window.require.config({
        paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
      });
      
      window.require(['vs/editor/editor.main'], () => {
        console.log("Monaco loaded from CDN");
        // Ensure our theme is defined after Monaco loads but before editor creation
        if (typeof window.applyPrimetaTheme === 'function') {
          window.applyPrimetaTheme();
        }
        this.createEditor(content, language);
      });
    };
    document.head.appendChild(script);
  }
  
  // Create the Monaco editor instance with minimal features for maximum performance
  createEditor(content, language) {
    if (!window.monaco) {
      console.error("Monaco not available when trying to create editor");
      return;
    }
    
    // Find or create a container for Monaco
    let monacoContainer = this.editorContainerTarget.querySelector('#monaco-container');
    if (!monacoContainer) {
      console.log("Creating new Monaco container");
      monacoContainer = document.createElement('div');
      monacoContainer.id = 'monaco-container';
      
      // Clear editor container and add the Monaco container
      this.editorContainerTarget.innerHTML = '';
      this.editorContainerTarget.appendChild(monacoContainer);
    }
    
    console.log("Creating Monaco editor with language:", language);
    
    try {
      // Create the editor with minimal config for performance
      this.editor = window.monaco.editor.create(monacoContainer, {
        value: content,
        language: language || 'plaintext',
        theme: 'primeta-dark',
        readOnly: true, // Always read-only in this context
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontFamily: 'Fira Code, monospace',
        fontSize: 14,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        scrollbar: {
          useShadows: false,
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10
        }
      });
      
      console.log("Monaco editor created successfully");
      
      // Force a layout update immediately
      this.editor.layout();
      
      // Add resize handler
      const handleResize = () => {
        if (this.editor) {
          this.editor.layout();
        }
      };
      
      window.addEventListener('resize', handleResize);
      this.resizeHandler = handleResize;
      
      // Initial layout after a short delay to ensure everything is rendered
      setTimeout(handleResize, 100);
    } catch (error) {
      console.error("Error creating Monaco editor:", error);
      monacoContainer.innerHTML = `<div class="error">Error creating editor: ${error.message}</div>`;
    }
  }
  
  // Update file stats display
  updateFileStats(fileView) {
    if (!fileView || !this.hasFileStatsTarget) return;
    
    this.fileStatsTarget.innerHTML = `
      <div class="stat-item"><strong>Views:</strong> ${fileView.view_count}</div>
      <div class="stat-item"><strong>Time:</strong> ${fileView.formatted_time_spent}</div>
      <div class="stat-item"><strong>Last:</strong> ${fileView.last_viewed_at}</div>
    `;
  }
  
  // Show the repository info panel, hide the editor
  showInfo() {
    console.log("Showing info panel, hiding editor");
    
    // Record time for current file if needed
    if (this.currentFileId) {
      this.recordTimeSpent();
    }
    
    // Reset current file
    this.currentFileId = null;
    this.currentFilePath = null;
    
    // Remove highlight from current file
    document.querySelectorAll('.file-item a.current-file').forEach(el => {
      el.classList.remove('current-file');
    });
    
    // Dispose of the editor if it exists
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
    
    // Hide editor container first
    if (this.hasEditorContainerTarget) {
      this.editorContainerTarget.style.display = 'none';
      // Clear editor content to free memory
      this.editorContainerTarget.innerHTML = '';
    }
    
    // Then show the info panel
    if (this.hasInfoPanelTarget) {
      this.infoPanelTarget.style.display = 'block';
      
      // Force a layout refresh
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }
  
  // Record time spent on current file
  recordTimeSpent() {
    if (!this.currentFileId || !this.startTime) return;
    
    const endTime = new Date();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000);
    
    // Only record if time spent is meaningful (more than 0 seconds)
    if (timeSpent > 0) {
      console.log(`Recording time spent: ${timeSpent} seconds on file: ${this.currentFileId}`);
      
      const trackUrl = `/repository_files/${this.currentFileId}/track_time`;
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (csrfToken) {
        // Show tracking indicator in fileStats if available
        if (this.hasFileStatsTarget) {
          const timeElement = this.fileStatsTarget.querySelector('.stat-item:nth-child(2)');
          if (timeElement) {
            const originalText = timeElement.textContent;
            timeElement.innerHTML = `<strong>Time:</strong> <span class="updating">Updating...</span>`;
          }
        }
        
        fetch(trackUrl, {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: `time_spent=${timeSpent}`,
          keepalive: true
        })
        .then(response => {
          console.log(`Time tracking response status: ${response.status}`);
          
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          
          return response.json();
        })
        .then(data => {
          // Update with the returned file view data
          if (data && data.file_view && this.hasFileStatsTarget) {
            this.updateFileStats(data.file_view);
            console.log(`Time stats updated. New total: ${data.file_view.total_time_spent}s`);
            
            // Dispatch a custom event to notify other controllers that a file view was recorded
            const event = new CustomEvent('file-view-recorded', { 
              bubbles: true, 
              detail: { fileId: this.currentFileId } 
            });
            this.element.dispatchEvent(event);
          }
        })
        .catch(err => {
          console.error('Error tracking time:', err);
          
          // Restore original stats display
          if (this.hasFileStatsTarget) {
            const timeElement = this.fileStatsTarget.querySelector('.stat-item:nth-child(2) .updating');
            if (timeElement) {
              timeElement.textContent = 'Failed to update';
            }
          }
        });
      }
    }
    
    // Reset the start time
    this.startTime = new Date();
  }
  
  // Get appropriate CSS class for language badge
  getLanguageBadgeClass(language) {
    // Normalize the language by converting to lowercase
    const normalizedLang = language.toLowerCase();
    
    const languageMap = {
      // JavaScript ecosystem
      'javascript': 'lang-js',
      'typescript': 'lang-ts',
      'jsx': 'lang-js',
      'tsx': 'lang-ts',
      
      // Ruby
      'ruby': 'lang-ruby',
      
      // Python
      'python': 'lang-py',
      
      // Web technologies
      'html': 'lang-html',
      'css': 'lang-css',
      'scss': 'lang-css',
      'less': 'lang-css',
      'xml': 'lang-xml',
      'svg': 'lang-xml',
      
      // JVM languages
      'java': 'lang-java',
      'kotlin': 'lang-kotlin',
      'scala': 'lang-scala',
      'groovy': 'lang-groovy',
      
      // .NET languages
      'csharp': 'lang-csharp',
      'vb': 'lang-vb',
      'fsharp': 'lang-fs',
      
      // Other languages
      'go': 'lang-go',
      'rust': 'lang-rust',
      'php': 'lang-php',
      'swift': 'lang-swift',
      'c': 'lang-c',
      'cpp': 'lang-cpp',
      
      // Shell and scripts
      'shell': 'lang-shell',
      'bash': 'lang-shell',
      'powershell': 'lang-powershell',
      'bat': 'lang-bat',
      
      // Data formats
      'json': 'lang-json',
      'yaml': 'lang-yaml',
      'toml': 'lang-toml',
      'markdown': 'lang-md',
      'sql': 'lang-sql',
      
      // Special types
      'dockerfile': 'lang-docker',
      'makefile': 'lang-makefile',
      'git': 'lang-git',
      'plaintext': 'lang-default'
    };
    
    return languageMap[normalizedLang] || 'lang-default';
  }
} 