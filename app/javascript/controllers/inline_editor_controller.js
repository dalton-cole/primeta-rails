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
      // console.log("editorContainer found:", this.editorContainerTarget);
    }
    
    // Log all targets for debugging
    // console.log("Targets found:", {
    //   infoPanel: this.hasInfoPanelTarget,
    //   editorContainer: this.hasEditorContainerTarget,
    //   fileTitle: this.hasFileTitleTarget,
    //   fileStats: this.hasFileStatsTarget,
    //   filePath: this.hasFilePathTarget
    // });
    
    // Check for Monaco
    if (window.monaco) {
      // console.log("Monaco is already available on page load");
    } else {
      // console.log("Monaco is not available on page load");
    }
    
    // Check repositories controller values
    if (this.hasRepositoryIdValue) {
      // console.log("Repository ID:", this.repositoryIdValue);
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
    // console.log("showFile method called");
    
    const fileLink = event.currentTarget;
    const fileId = fileLink.dataset.fileId;
    const filePath = fileLink.dataset.path || fileLink.textContent.trim();
    
    // console.log("File selected:", { fileId, filePath });
    
    if (!fileId) {
      console.error("No fileId found in the clicked element");
      return;
    }
    
    try {
      // Record time for previous file if needed
      if (this.currentFileId) {
        this.recordTimeSpent();
      }
      
      this.currentFileId = fileId;
      this.currentFilePath = filePath;
      
      // Dispatch AI assistant event
      document.dispatchEvent(new CustomEvent('monaco:file-selected', {
        detail: { fileId, filePath, repositoryId: this.repositoryIdValue }
      }));
      
      // Update UI for selected file link
      this.updateSelectedFileLinkUI(fileLink, fileId);
      
      // Ensure editor chrome structure exists *before* showing loading state
      this.ensureHeaderElements(); 

      // Show editor, hide info panel
      this.infoPanelTarget.classList.add('hidden');
      this.editorContainerTarget.classList.remove('hidden');
      this.editorContainerTarget.style.display = 'flex';

      // Show loading state within #monaco-container if it exists
      const monacoContainer = this.editorContainerTarget.querySelector('#monaco-container');
      if (monacoContainer) {
        monacoContainer.innerHTML = '<div class="loading" style="display: flex; justify-content: center; align-items: center; height: 100%;">Loading file...</div>';
      } else {
        // Fallback if monaco-container isn't there (shouldn't happen if ensureHeaderElements ran)
        this.editorContainerTarget.innerHTML = '<div class="loading">Loading file...</div>'; 
      }
      // Clear previous file title/path/stats from header/footer
      if (this.hasFileTitleTarget) this.fileTitleTarget.textContent = 'Loading...';
      if (this.hasFilePathTarget) this.filePathTarget.textContent = '...';
      if (this.hasFileStatsTarget) this.fileStatsTarget.innerHTML = '';

      console.log("Loading file content for ID:", fileId);
      const response = await fetch(`/repository_files/${fileId}/content`);
      if (!response.ok) throw new Error('Failed to load file content');
      const fileData = await response.json();
      
      // ensureHeaderElements() was already called, so chrome should be stable.
      // Update header/footer with actual file info
      if (this.hasFileTitleTarget) {
        this.fileTitleTarget.textContent = (this.currentFilePath?.split('/') || fileData.path?.split('/') || [`File ${fileId}`]).pop();
      }
      if (this.hasFilePathTarget) {
        this.filePathTarget.textContent = this.currentFilePath || fileData.path || `File ID: ${fileId}`;
      }
      if (this.hasFileStatsTarget && fileData.file_view) {
        this.updateFileStats(fileData.file_view);
      }
      
      this.startTime = new Date();
      this.initializeEditor(fileData.content, fileData.language);
      console.log("File display complete");
      
    } catch (error) {
      console.error("Error displaying file:", error);
      if (this.hasEditorContainerTarget) {
        this.editorContainerTarget.innerHTML = `<div class="error-box">
          <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="error-message">
            <h3>Error Loading File</h3>
            <p>${error.message}</p>
            <button class="btn btn-outline" onclick="window.location.reload()">Refresh Page</button>
          </div>
        </div>`;
      }
    }
  }
  
  // updateSelectedFileLinkUI (Helper function extracted from showFile)
  updateSelectedFileLinkUI(fileLink, fileId) {
    document.querySelectorAll('.current-file').forEach(el => el.classList.remove('current-file'));
    document.querySelectorAll('.selected-file-item').forEach(el => el.classList.remove('selected-file-item'));
    document.querySelectorAll('.selected-key-file').forEach(el => el.classList.remove('.selected-key-file'));

    if (fileLink.tagName === 'A' && fileLink.closest('.file-item')) {
      fileLink.classList.add('current-file', 'viewed-file');
      const fileItem = fileLink.closest('.file-item');
      if (fileItem) fileItem.classList.add('selected-file-item');
    }

    document.querySelectorAll(`a[data-file-id="${fileId}"]`).forEach(el => {
      if (el !== fileLink) el.classList.add('viewed-file');
    });

    document.querySelectorAll(`.key-file-item[data-file-id="${fileId}"]`).forEach(item => {
      item.classList.add('viewed', 'selected-key-file');
      if (item.dataset && item.dataset.turboFrame) {
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
    // Removed directory expansion and scrollIntoView from here, should be handled by file_explorer_controller
  }
  
  // Ensure editor header elements exist
  ensureHeaderElements() {
    if (!this.hasEditorContainerTarget) return;
    
    const existingHeader = this.editorContainerTarget.querySelector('.editor-header');
    const existingMonacoContainer = this.editorContainerTarget.querySelector('#monaco-container');
    const existingFooter = this.editorContainerTarget.querySelector('.file-footer');

    // console.log("INLINE_EDITOR: ensureHeaderElements check:", 
    //   { 
    //     hasEditorContainerTarget: this.hasEditorContainerTarget,
    //     editorContainerTargetChildren: this.editorContainerTarget.children.length,
    //     existingHeader: !!existingHeader, 
    //     existingMonacoContainer: !!existingMonacoContainer, 
    //     existingFooter: !!existingFooter 
    //   }
    // );

    if (existingHeader && existingMonacoContainer && existingFooter) {
      // console.log("INLINE_EDITOR: Editor chrome elements already exist. Skipping rebuild.");
      // console.log("Building editor interface elements");
      return; 
    }

    // console.log("INLINE_EDITOR: Rebuilding editor chrome elements because one was missing.");
    // console.log("Building editor interface elements");
    // Clear the container first only if we are rebuilding
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
      <div class="file-footer" style="flex-shrink: 0; margin-top: 10px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <div class="file-path" style="display: flex; align-items: center;">
          <span id="file-path-icon" class="file-icon" style="margin-right: 5px;"></span>
          <span data-inline-editor-target="filePath" class="file-path-container" style="word-break: break-all;"></span>
        </div>
        <div data-inline-editor-target="fileStats" class="file-stats" style="display: flex; gap: 15px;"></div>
      </div>
    `;
    
    // Add to DOM
    this.editorContainerTarget.innerHTML = editorHtml; // This is fine now as we cleared above only if rebuilding.
  }
  
  // Initialize or update the Monaco editor
  initializeEditor(content, language) {
    // console.log("Initializing editor with language:", language);
    
    // First dispose of any existing editor
    if (this.editor) {
      // console.log("Disposing existing editor");
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
    // console.log("Loading Monaco using global loader");
    
    // Add loading indicator
    this.editorContainerTarget.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #ccc;">
        <div style="text-align: center; margin-bottom: 15px;">Loading editor...</div>
        <div style="width: 40px; height: 40px; border: 3px solid rgba(99, 102, 241, 0.1); border-top-color: #6366F1; border-radius: 50%; animation: spin 1s infinite linear;"></div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </div>
    `;
    
    // If global loader exists, use it
    if (typeof window.loadMonacoEditor === 'function') {
      window.loadMonacoEditor(() => {
        // console.log("Monaco loaded via global loader");
        if (window.monaco) {
          this.createEditor(content, language);
        } else {
          console.error("Monaco still not available after global load");
          this.editorContainerTarget.innerHTML = `<div class="error">Failed to load Monaco editor. Please refresh the page.</div>`;
        }
      });
      return;
    }
    
    // Fallback to direct loading if global function is not available
    // console.log("Global loader not found, using direct loader");
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
    script.async = true;
    script.onload = () => {
      window.require.config({
        paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
      });
      
      window.require(['vs/editor/editor.main'], () => {
        // console.log("Monaco loaded from CDN");
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
    
    const monacoContainer = this.editorContainerTarget.querySelector('#monaco-container');
    if (!monacoContainer) {
      console.error("#monaco-container not found within editorContainerTarget! Editor cannot be created.");
      this.editorContainerTarget.innerHTML = '<div class="error">Error: Monaco editor UI container not found.</div>';
      return;
    }
    
    // Clear only the monacoContainer before creating a new editor instance in it
    monacoContainer.innerHTML = ''; 
    // console.log("INLINE_EDITOR: createEditor - monacoContainer.innerHTML = \'\' WAS COMMENTED OUT FOR TEST");

    // console.log("Creating Monaco editor with language:", language);
    
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
      
      // console.log("Monaco editor created successfully");
      
      // Update file path icon
      const iconElement = this.editorContainerTarget.querySelector('#file-path-icon'); // This is in the footer, a sibling to monacoContainer
      if (iconElement) {
        const iconClasses = this.getLanguageBadgeClass(language || 'plaintext');
        iconElement.className = `file-icon ${iconClasses}`;
      } else {
        // console.warn("Could not find #file-path-icon element to update.");
      }
      
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
    // console.log("Showing info panel, hiding editor");
    
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
    
    // Hide editor container and show info panel using CSS classes
    if (this.hasEditorContainerTarget) {
      this.editorContainerTarget.classList.add('hidden');
      // Optionally clear editor content to free memory, and remove explicit style.display if hidden handles it
      // this.editorContainerTarget.style.display = 'none'; 
      this.editorContainerTarget.innerHTML = '';
    }
    
    if (this.hasInfoPanelTarget) {
      this.infoPanelTarget.classList.remove('hidden');
      // Optionally remove explicit style.display if hidden handles it
      // this.infoPanelTarget.style.display = 'block'; 
      
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
    const normalizedLang = language ? language.toLowerCase() : 'plaintext';
    
    // Map Monaco language names to Font Awesome icon classes
    const iconMap = {
      'ruby': 'fas fa-gem',
      'javascript': 'fab fa-js',
      'typescript': 'fab fa-js-square',
      'python': 'fab fa-python',
      'html': 'fas fa-code',
      'css': 'fab fa-css3',
      'scss': 'fab fa-css3', // SCSS uses the same icon as CSS
      'json': 'fas fa-brackets-curly',
      'markdown': 'fas fa-file-alt',
      'go': 'fas fa-file-code',
      'c': 'fas fa-file-code',
      'cpp': 'fas fa-file-code',
      'objective-c': 'fas fa-file-code', // Assuming similar to C/C++
      'csharp': 'fas fa-file-code', // C# can use generic code or a more specific one if available
      'java': 'fab fa-java',
      'php': 'fab fa-php',
      'rust': 'fas fa-file-code',
      'yaml': 'fas fa-file-alt',
      'shell': 'fas fa-terminal',
      'sql': 'fas fa-database', // More specific than file-alt
      'xml': 'fas fa-code',
      // Add more mappings as needed based on Monaco language IDs and available FA icons
      'plaintext': 'fas fa-file' // Default for unknown or plain text
    };
    
    return iconMap[normalizedLang] || 'fas fa-file'; // Fallback to default file icon
  }
}