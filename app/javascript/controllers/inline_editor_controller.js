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
    this.editor = null;
    this.startTime = null;
    
    // Add event handler for beforeunload to track time
    window.addEventListener('beforeunload', this.recordTimeSpent.bind(this));
  }
  
  disconnect() {
    // Clean up when controller is disconnected
    if (this.editor) {
      this.recordTimeSpent();
      this.editor.dispose();
    }
    
    window.removeEventListener('beforeunload', this.recordTimeSpent.bind(this));
  }
  
  // Show the Monaco editor and load file content
  async showFile(event) {
    event.preventDefault();
    
    const fileLink = event.currentTarget;
    const fileId = fileLink.dataset.fileId;
    
    if (!fileId) return;
    
    try {
      // Record time for previous file if needed
      if (this.currentFileId) {
        this.recordTimeSpent();
      }
      
      // Update current file ID
      this.currentFileId = fileId;
      
      // Check if targets exist
      if (!this.hasInfoPanelTarget || !this.hasEditorContainerTarget) {
        console.error("Missing required targets: infoPanel or editorContainer");
        return;
      }
      
      // Show loading state
      this.infoPanelTarget.style.display = 'none';
      this.editorContainerTarget.style.display = 'block';
      this.editorContainerTarget.innerHTML = '<div class="loading">Loading file...</div>';
      
      // Fetch file content
      const response = await fetch(`/repository_files/${fileId}/content`);
      if (!response.ok) throw new Error('Failed to load file content');
      
      const fileData = await response.json();
      
      // Create or update header elements if missing
      this.ensureHeaderElements();
      
      // Update file title and stats
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
    
    // Build header structure
    const editorHtml = `
      <div class="editor-header">
        <div class="file-title-container">
          <button data-action="click->inline-editor#showInfo" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="back-icon">
              <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            <span>Back to Repository</span>
          </button>
          <h2 data-inline-editor-target="fileTitle" class="file-title"></h2>
        </div>
      </div>
      <div id="monaco-container"></div>
      <div class="file-footer">
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
          this.loadLanguageSupport(language).then(() => {
            this.createEditor(content, language);
          });
        });
      };
      document.head.appendChild(script);
    }
  }
  
  // Load language-specific syntax highlighting
  async loadLanguageSupport(language) {
    if (!window.monaco) return;
    
    // Map file extensions to Monaco language IDs if needed
    const languageMap = {
      'rb': 'ruby',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'xml': 'xml',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rs': 'rust',
      'swift': 'swift',
      'dart': 'dart',
      'vue': 'html'
    };
    
    // Normalize the language identifier
    const normalizedLanguage = languageMap[language] || language || 'plaintext';
    
    // Define additional language-specific theme customizations
    if (normalizedLanguage) {
      this.customizeLanguageTheme(normalizedLanguage);
    }
  }
  
  // Apply language-specific theme customizations
  customizeLanguageTheme(language) {
    if (!window.monaco) return;
    
    const monaco = window.monaco;
    const baseTheme = {
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
    };
    
    // Language-specific theme customizations
    const languageThemes = {
      ruby: {
        rules: [
          { token: 'keyword.control.ruby', foreground: 'C586C0' },
          { token: 'constant.language.ruby', foreground: '4EC9B0' },
          { token: 'variable.other.ruby', foreground: '9CDCFE' },
          { token: 'support.function.kernel.ruby', foreground: 'DCDCAA' },
          { token: 'constant.other.symbol.ruby', foreground: 'B5CEA8' }
        ]
      },
      javascript: {
        rules: [
          { token: 'variable.other.constant.js', foreground: '4FC1FF' },
          { token: 'entity.name.function.js', foreground: 'DCDCAA' },
          { token: 'keyword.operator.new.js', foreground: 'C586C0' },
          { token: 'variable.other.readwrite.js', foreground: '9CDCFE' }
        ]
      },
      python: {
        rules: [
          { token: 'keyword.control.flow.python', foreground: 'C586C0' },
          { token: 'support.function.builtin.python', foreground: '4EC9B0' },
          { token: 'support.type.python', foreground: '4FC1FF' }
        ]
      },
      // Add more language-specific customizations as needed
    };
    
    // Merge base theme with language-specific theme
    const themeRules = [...baseTheme.rules];
    const languageSpecificTheme = languageThemes[language];
    
    if (languageSpecificTheme && languageSpecificTheme.rules) {
      themeRules.push(...languageSpecificTheme.rules);
    }
    
    // Define the combined theme
    monaco.editor.defineTheme('primeta-dark', {
      ...baseTheme,
      rules: themeRules
    });
    
    // Set the theme
    monaco.editor.setTheme('primeta-dark');
  }
  
  // Create the Monaco editor instance
  createEditor(content, language) {
    if (!this.hasEditorContainerTarget) {
      console.error("Cannot create editor: missing editorContainer target");
      return;
    }
    
    const monaco = window.monaco;
    
    // Map file extensions to Monaco language IDs if needed
    const languageMap = {
      'rb': 'ruby',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'xml': 'xml',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rs': 'rust',
      'swift': 'swift',
      'dart': 'dart',
      'vue': 'html'
    };
    
    // Normalize the language identifier
    const normalizedLanguage = languageMap[language] || language || 'plaintext';
    
    // Apply language-specific theme customizations
    this.customizeLanguageTheme(normalizedLanguage);
    
    // Find the monaco container
    const editorContainer = this.editorContainerTarget.querySelector('#monaco-container');
    if (!editorContainer) {
      console.error("Monaco container not found");
      return;
    }
    
    // Ensure the editor container has proper size
    editorContainer.style.height = 'calc(100% - 120px)';
    editorContainer.style.width = '100%';
    
    // Create the editor
    this.editor = monaco.editor.create(editorContainer, {
      value: content,
      language: normalizedLanguage,
      theme: 'primeta-dark',
      readOnly: true,
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
      },
      // Enhanced syntax highlighting options
      tokenization: {
        maxTokenizationLineLength: 5000
      }
    });
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