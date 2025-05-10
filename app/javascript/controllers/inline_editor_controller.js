import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="inline-editor"
export default class extends Controller {
  static targets = ["infoPanel", "editorContainer", "fileTitle", "fileStats", "filePath"];
  static values = {
    repositoryId: Number
  }
  
  connect() {
    console.log("Inline editor controller connected");
    console.log("Targets found:", {
      infoPanel: this.hasInfoPanelTarget,
      editorContainer: this.hasEditorContainerTarget,
      fileTitle: this.hasFileTitleTarget,
      fileStats: this.hasFileStatsTarget,
      filePath: this.hasFilePathTarget
    });
    
    // Initialize state
    this.currentFileId = null;
    this.lastViewedFileId = null;
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
    
    const fileLink = event.currentTarget;
    const fileId = fileLink.dataset.fileId;
    const filePath = fileLink.dataset.path || fileLink.textContent.trim();
    
    if (!fileId) return;
    
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
      
      // Show loading state and set to full height
      this.infoPanelTarget.style.display = 'none';
      this.editorContainerTarget.style.display = 'flex';
      this.editorContainerTarget.style.flexDirection = 'column';
      this.editorContainerTarget.style.height = '90vh';
      this.editorContainerTarget.style.overflow = 'hidden';
      this.editorContainerTarget.innerHTML = '<div class="loading">Loading file...</div>';
      
      // Fetch file content
      const response = await fetch(`/repository_files/${fileId}/content`);
      if (!response.ok) throw new Error('Failed to load file content');
      
      const fileData = await response.json();
      this.currentFileData = fileData;
      
      // Ensure header elements exist
      this.ensureHeaderElements();
      
      // Update file title
      if (this.hasFileTitleTarget) {
        // Extract the filename from the path for the title
        const fileName = fileData.path.split('/').pop();
        this.fileTitleTarget.textContent = fileName;
      } else {
        console.warn("Missing fileTitle target");
      }
      
      // Update file path
      if (this.hasFilePathTarget) {
        // Include the language in the path display
        const language = fileData.language || 'plaintext';
        const formattedLanguage = language.charAt(0).toUpperCase() + language.slice(1);
        const badgeClass = this.getLanguageBadgeClass(language);
        
        // Clear previous content
        this.filePathTarget.innerHTML = '';
        
        // Create path text element
        const pathText = document.createElement('span');
        pathText.className = 'path-text';
        pathText.textContent = fileData.path;
        this.filePathTarget.appendChild(pathText);
        
        // Create language badge separately
        const badge = document.createElement('span');
        badge.className = `language-badge ${badgeClass}`;
        badge.textContent = formattedLanguage;
        this.filePathTarget.appendChild(badge);
        
        // Add key concept file indication if this is a key file
        if (fileData.is_concept_key_file) {
          const keyBadge = document.createElement('span');
          keyBadge.className = 'language-badge key-file-badge';
          keyBadge.innerHTML = '<span class="key-file-star">★</span> Key File';
          this.filePathTarget.appendChild(keyBadge);
        }
      }
      
      if (this.hasFileStatsTarget) {
        this.updateFileStats(fileData.file_view);
      } else {
        console.warn("Missing fileStats target");
      }
      
      // Initialize Monaco editor if needed or update content
      this.initializeEditor(fileData.content, fileData.language);
      
      // Start tracking time
      this.startTime = new Date();
      
    } catch (error) {
      console.error('Error loading file:', error);
      if (this.hasEditorContainerTarget) {
        this.editorContainerTarget.innerHTML = `<div class="error">Error loading file: ${error.message}</div>`;
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
    // If editor already exists, just update content
    if (this.editor) {
      const monaco = window.monaco;
      const model = this.editor.getModel();
      
      model.setValue(content);
      monaco.editor.setModelLanguage(model, language);
      return;
    }
    
    // Otherwise initialize a new editor
    // Load Monaco editor from CDN if needed
    if (window.monaco) {
      // Ensure theme is applied before creating editor
      if (typeof window.applyPrimetaTheme === 'function') {
        window.applyPrimetaTheme();
      }
      this.createEditor(content, language);
    } else {
      // Add Monaco loader script
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
      script.async = true;
      script.onload = () => {
        window.require.config({
          paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
        });
        
        // Load the basic editor first
        window.require(['vs/editor/editor.main'], () => {
          // Apply theme after Monaco loads but before editor creation
          if (typeof window.applyPrimetaTheme === 'function') {
            window.applyPrimetaTheme();
          }
          this.createEditor(content, language);
        });
      };
      document.head.appendChild(script);
    }
  }
  
  // Create the Monaco editor instance with minimal features for maximum performance
  createEditor(content, language) {
    if (!this.hasEditorContainerTarget) {
      console.error("Cannot create editor: missing editorContainer target");
      return;
    }
    
    const monaco = window.monaco;
    
    // Ensure theme is applied right before creating the editor
    if (typeof window.applyPrimetaTheme === 'function') {
      window.applyPrimetaTheme();
    }
    
    // Simple language mapping
    const languageMap = {
      'rb': 'ruby',
      'js': 'javascript',
      'py': 'python',
      'html': 'html',
      'css': 'css'
    };
    
    // Normalize the language identifier
    const normalizedLanguage = languageMap[language] || language || 'plaintext';
    
    // Find the monaco container
    const editorContainer = this.editorContainerTarget.querySelector('#monaco-container');
    if (!editorContainer) {
      console.error("Monaco container not found");
      return;
    }
    
    // Set full width and optimize overflow
    editorContainer.style.width = '100%';
    editorContainer.style.overflow = 'hidden';
    
    // Create minimal editor with improved settings
    this.editor = monaco.editor.create(editorContainer, {
      value: content,
      language: normalizedLanguage,
      theme: 'primeta-dark',
      readOnly: true,
      automaticLayout: true, // Enable auto layout
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all', // Show current line highlight
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      renderIndentGuides: true, // Show indent guides
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
    
    // Minimal resize handler with very long debounce
    let resizeTimeout;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.editor) this.editor.layout();
      }, 500); // Very long debounce
    };
    
    // Only handle window resize events
    window.addEventListener('resize', handleResize);
    this.resizeHandler = handleResize;
    
    // Initial layout
    setTimeout(() => {
      if (this.editor) this.editor.layout();
    }, 100);
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
  
  // Show repository info instead of file
  showInfo() {
    // Record time for current file if needed
    if (this.currentFileId) {
      this.recordTimeSpent();
      
      // Store the last viewed file ID before resetting
      this.lastViewedFileId = this.currentFileId;
      this.currentFileId = null;
    }
    
    // Switch back to info panel
    if (this.hasEditorContainerTarget) {
      this.editorContainerTarget.style.display = 'none';
    }
    
    if (this.hasInfoPanelTarget) {
      this.infoPanelTarget.style.display = 'block';
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