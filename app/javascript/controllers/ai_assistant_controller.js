import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "content", "contextContent", "challengesContent", "patternsContent", "visualizationsContent", "loadingIndicator", "errorMessage"]
  static values = {
    repositoryId: Number,
    filePath: String,
    currentRepository: Boolean
  }
  
  connect() {
    console.log("🔍 AI Assistant: Controller connected");
    console.log("🔍 Has repositoryId:", this.hasRepositoryIdValue, "Value:", this.repositoryIdValue);
    console.log("🔍 Has filePath:", this.hasFilePathValue, "Value:", this.filePathValue);
    console.log("🔍 Is current repository:", this.hasCurrentRepositoryValue);
    console.log("🔍 Has contextContent:", this.hasContextContentTarget);
    console.log("🔍 Has panel:", this.hasPanelTarget);
    console.log("🔍 Has content:", this.hasContentTarget);
    
    // Initialize in collapsed state
    this.collapsed = true
    this.updateVisibility()
    
    // Don't try to load context if we don't have both repository ID and file path
    this.contextLoaded = false
    
    // Listen for page changes (for Turbo navigation)
    document.addEventListener('turbo:load', this.checkForFileData.bind(this))
    document.addEventListener('turbo:frame-load', this.checkForFileData.bind(this))
    
    // Automatically fetch file context if we have a repository file
    if (this.hasRepositoryIdValue && this.hasFilePathValue) {
      console.log("🔍 AI Assistant: Auto-fetching file context for:", this.filePathValue);
      this.fetchFileContext();
    }
    
    // If we're on a repository page, listen for file selection events
    if (this.hasCurrentRepositoryValue && this.hasRepositoryIdValue) {
      console.log("🔍 AI Assistant: On repository page, will listen for file selection");
      this.setupFileSelectionListener();
    }
  }
  
  disconnect() {
    // Clean up event listeners
    document.removeEventListener('turbo:load', this.checkForFileData.bind(this))
    document.removeEventListener('turbo:frame-load', this.checkForFileData.bind(this))
    
    // Remove file selection event listener if it exists
    if (this.fileSelectedHandler) {
      document.removeEventListener('monaco:file-selected', this.fileSelectedHandler);
      this.fileSelectedHandler = null;
    }
    
    // Disconnect any active mutation observer
    if (this.fileObserver) {
      console.log("🔍 AI Assistant: Disconnecting file observer");
      this.fileObserver.disconnect();
      this.fileObserver = null;
    }
  }
  
  checkForFileData() {
    console.log("🔍 AI Assistant: Checking for file data after page load");
    console.log("🔍 Has repositoryId:", this.hasRepositoryIdValue, "Value:", this.repositoryIdValue);
    console.log("🔍 Has filePath:", this.hasFilePathValue, "Value:", this.filePathValue);
    
    if (this.hasRepositoryIdValue && this.hasFilePathValue) {
      console.log("🔍 AI Assistant: File data is available");
      // Reset context loaded flag when new file is loaded
      this.contextLoaded = false
      
      // Automatically fetch context for the new file
      this.fetchFileContext();
      
      // Auto-open the panel when a file is loaded
      if (this.collapsed) {
        this.collapsed = false;
        this.updateVisibility();
      }
    }
  }
  
  toggle(event) {
    console.log("🔍 AI Assistant: Toggle called");
    
    // Prevent the default action if this was triggered by a button click
    if (event) {
      event.preventDefault();
    }
    
    this.collapsed = !this.collapsed
    console.log("🔍 AI Assistant: Collapsed state is now:", this.collapsed);
    
    this.updateVisibility()
    
    // Load context if panel is opened
    if (!this.collapsed && this.hasRepositoryIdValue && this.hasFilePathValue) {
      this.loadContextIfNeeded()
    }
  }
  
  updateVisibility() {
    console.log("🔍 AI Assistant: Update visibility called, collapsed:", this.collapsed);
    console.log("🔍 Has panel target:", this.hasPanelTarget);
    
    if (this.hasPanelTarget) {
      if (this.collapsed) {
        this.panelTarget.classList.add("hidden")
      } else {
        this.panelTarget.classList.remove("hidden")
      }
    } else {
      console.error("🔍 AI Assistant: Panel target is missing!");
    }
  }
  
  // File context methods
  loadContextIfNeeded() {
    console.log("🔍 AI Assistant: loadContextIfNeeded called");
    if (this.hasRepositoryIdValue && this.hasFilePathValue && this.hasContextContentTarget) {
      console.log("🔍 AI Assistant - Repository ID:", this.repositoryIdValue);
      console.log("🔍 AI Assistant - File Path:", this.filePathValue);
      
      // Always show loading indicator first
      if (this.hasLoadingIndicatorTarget) {
        console.log("🔍 AI Assistant - Showing loading indicator");
        this.showLoadingIndicator();
        
        // Clear any previous content to make the loading more visible
        if (this.hasContextContentTarget) {
          this.contextContentTarget.innerHTML = "";
        }
      } else {
        console.warn("🔍 AI Assistant - Loading indicator target not found");
      }
      
      if (!this.contextLoaded) {
        console.log("🔍 AI Assistant - Loading context...");
        this.fetchFileContext();
      } else {
        console.log("🔍 AI Assistant - Context already loaded");
        // Hide loading indicator if content already loaded
        if (this.hasLoadingIndicatorTarget) {
          this.hideLoadingIndicator();
        }
      }
    } else {
      console.log("🔍 AI Assistant - Missing required values:", {
        hasRepositoryId: this.hasRepositoryIdValue,
        hasFilePath: this.hasFilePathValue,
        hasContextContent: this.hasContextContentTarget
      });
      
      // Show a user-friendly error message
      if (this.hasContextContentTarget) {
        this.contextContentTarget.innerHTML = "<p class='error'>Please select a file first to get context.</p>";
      }
      
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
    }
  }
  
  fetchFileContext() {
    console.log("🔍 AI Assistant - Fetching context from API");
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasContextContentTarget) {
        this.contextContentTarget.innerHTML = "<p class='error'>Please select a file first to get context.</p>";
      }
      
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      return;
    }
    
    // Always make sure loading indicator is visible first
    if (this.hasLoadingIndicatorTarget) {
      this.showLoadingIndicator();
    }
    
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add('hidden');
    }
    
    if (this.hasContextContentTarget) {
      // Clear existing content to make loading more obvious
      this.contextContentTarget.innerHTML = "";
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const url = `/api/file_context?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}`;
      console.log("🔍 AI Assistant - Request URL:", url);
      
      fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        }
      })
      .then(response => {
        console.log("🔍 AI Assistant - Response status:", response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch file context: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("🔍 AI Assistant - Received data:", data);
        // Add refresh button
        const refreshButton = `<div class="refresh-button"><button data-action="click->ai-assistant#refreshContext">Refresh</button></div>`;
        this.contextContentTarget.innerHTML = this.formatExplanation(data.explanation) + refreshButton;
        this.contextLoaded = true;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
      })
      .catch(error => {
        console.error('Error fetching file context:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load context. Please try again.';
        }
        
        this.hideLoadingIndicator();
      });
    }, 100); // Small delay to ensure UI updates
  }
  
  // Helper method to completely hide the loading indicator
  hideLoadingIndicator() {
    if (!this.hasLoadingIndicatorTarget) return;
    
    console.log("🔍 AI Assistant - Hiding loading indicator");
    
    // Add the hidden class
    this.loadingIndicatorTarget.classList.add('hidden');
    
    // Also set display: none directly
    this.loadingIndicatorTarget.style.display = 'none';
    
    // Add a specific CSS class for extra certainty
    this.loadingIndicatorTarget.classList.add('ai-loading-hidden');
  }
  
  // Helper method to show the loading indicator
  showLoadingIndicator() {
    if (!this.hasLoadingIndicatorTarget) return;
    
    console.log("🔍 AI Assistant - Showing loading indicator");
    
    // Remove the hidden class
    this.loadingIndicatorTarget.classList.remove('hidden');
    
    // Also set display to flex directly
    this.loadingIndicatorTarget.style.display = 'flex';
    
    // Remove the specific CSS class
    this.loadingIndicatorTarget.classList.remove('ai-loading-hidden');
  }
  
  refreshContext() {
    console.log("🔍 AI Assistant - Refreshing context");
    this.contextLoaded = false;
    this.loadContextIfNeeded();
  }
  
  formatExplanation(text) {
    // Enhanced markdown-like formatting
    return text
      .replace(/\n\n/g, '<br><br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="ai-italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="ai-code">$1</code>')
      .replace(/^#\s+(.*?)$/gm, '<h3 class="ai-heading">$1</h3>')
      .replace(/^##\s+(.*?)$/gm, '<h4 class="ai-subheading">$1</h4>')
      .replace(/^-\s+(.*?)$/gm, '<li class="ai-list-item">$1</li>')
      .replace(/<li class="ai-list-item">(.*?)<\/li>/gs, '<ul class="ai-list">$&</ul>')
      .replace(/<ul class="ai-list">(<ul class="ai-list">.*?<\/ul>)<\/ul>/gs, '$1');
  }
  
  // Value change observers
  repositoryIdValueChanged() {
    console.log("🔍 AI Assistant - Repository ID changed:", this.repositoryIdValue);
    this.contextLoaded = false;
  }
  
  filePathValueChanged() {
    console.log("🔍 AI Assistant - File path changed:", this.filePathValue);
    this.contextLoaded = false;
    this.challengesLoaded = false;
    this.patternsLoaded = false;
    this.visualizationsLoaded = false;
  }
  
  // Listen for custom events when a file is selected in the Monaco editor
  setupFileSelectionListener() {
    console.log("🔍 AI Assistant: Setting up file selection listener");
    
    // Helper function to attach click listeners to file links
    const attachFileListeners = (elements) => {
      elements.forEach(link => {
        // Only attach if not already attached
        if (!link.hasAttribute('data-ai-listener')) {
          link.setAttribute('data-ai-listener', 'true');
          link.addEventListener('click', (event) => {
            const filePath = link.dataset.path || link.textContent.trim();
            if (filePath) {
              console.log("🔍 AI Assistant: Direct file click detected:", filePath);
              
              // Add a small delay to let the other controller do its work first
              setTimeout(() => {
                this.filePathValue = filePath;
                this.contextLoaded = false;
                this.fetchFileContext();
                
                if (this.collapsed) {
                  this.collapsed = false;
                  this.updateVisibility();
                }
              }, 300);
            }
          });
        }
      });
    };
    
    // Store event handlers for proper cleanup
    this.fileSelectedHandler = (event) => {
      console.log("🔍 AI Assistant: File selected in Monaco editor", event.detail);
      if (event.detail && event.detail.filePath) {
        // Update the file path value
        this.filePathValue = event.detail.filePath;
        console.log("🔍 AI Assistant: Updated file path to", this.filePathValue);
        
        // Load context for the selected file
        this.contextLoaded = false;
        this.fetchFileContext();
        
        // Auto-open the panel
        if (this.collapsed) {
          this.collapsed = false;
          this.updateVisibility();
        }
      }
    };
    
    // Listen for custom events from the inline editor controller
    document.addEventListener('monaco:file-selected', this.fileSelectedHandler);
    
    // Initial attachment to existing file items
    attachFileListeners(document.querySelectorAll('.file-item a'));
    
    // Use MutationObserver to catch dynamically added file links
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Look for newly added file-item links
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if node itself is a file-item or contains file-items
              const fileLinks = [
                ...(node.classList?.contains('file-item') ? [node.querySelector('a')] : []),
                ...node.querySelectorAll('.file-item a')
              ].filter(Boolean);
              
              if (fileLinks.length) {
                console.log("🔍 AI Assistant: New file links detected:", fileLinks.length);
                attachFileListeners(fileLinks);
              }
            }
          });
        }
      });
    });
    
    // Start observing document body for added file links
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Store the observer so we can disconnect later
    this.fileObserver = observer;
    
    // Check for existing files in several ways (redundant to ensure we find it)
    setTimeout(() => {
      // Method 1: Check for .current-file
      let detectedFilePath = null;
      const currentFileLink = document.querySelector('.file-item a.current-file');
      if (currentFileLink && currentFileLink.dataset.path) {
        detectedFilePath = currentFileLink.dataset.path;
        console.log("🔍 AI Assistant: Found file via .current-file:", detectedFilePath);
      }
      
      // Method 2: Check for already rendered file title
      if (!detectedFilePath) {
        const fileTitle = document.querySelector('.file-title');
        const pathTextElement = document.querySelector('.path-text');
        if (fileTitle && fileTitle.textContent && pathTextElement && pathTextElement.textContent) {
          detectedFilePath = pathTextElement.textContent;
          console.log("🔍 AI Assistant: Found file via title element:", detectedFilePath);
        }
      }
      
      // Method 3: Check Monaco container
      if (!detectedFilePath && window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          // Try to extract file path from editor interface
          console.log("🔍 AI Assistant: Found active Monaco editor");
          
          // Look for file path in surrounding DOM
          const container = editors[0].getDomNode().closest('.editor-container');
          if (container) {
            const pathElement = container.querySelector('.file-path-container .path-text');
            if (pathElement) {
              detectedFilePath = pathElement.textContent;
              console.log("🔍 AI Assistant: Found file path from editor container:", detectedFilePath);
            }
          }
        }
      }
      
      // If we found a file path, use it
      if (detectedFilePath) {
        this.filePathValue = detectedFilePath;
        this.contextLoaded = false;
        this.fetchFileContext();
        
        // Auto-open the panel
        if (this.collapsed) {
          this.collapsed = false;
          this.updateVisibility();
        }
      } else {
        console.log("🔍 AI Assistant: Could not find an active file");
      }
    }, 1000); // Longer delay to ensure everything is loaded
  }
  
  // Tab switching functionality
  switchTab(event) {
    const tabName = event.currentTarget.dataset.tab;
    console.log("🔍 AI Assistant - Switching to tab:", tabName);
    
    // Update tab styling
    document.querySelectorAll('.ai-assistant-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Show the associated content
    document.querySelectorAll('.ai-tab-content').forEach(content => {
      content.classList.remove('active');
      content.classList.add('hidden');
    });
    
    const activeContent = document.querySelector(`.ai-tab-content[data-tab="${tabName}"]`);
    activeContent.classList.remove('hidden');
    activeContent.classList.add('active');
    
    // Load content if needed
    if (tabName === 'context') {
      if (!this.contextLoaded) {
        this.fetchFileContext();
      }
    } else if (tabName === 'challenges') {
      if (!this.challengesLoaded) {
        this.fetchLearningChallenges();
      }
    } else if (tabName === 'patterns') {
      if (!this.patternsLoaded) {
        this.fetchRelatedPatterns();
      }
    } else if (tabName === 'visualizations') {
      if (!this.visualizationsLoaded) {
        this.fetchVisualizations();
      }
    }
  }
  
  fetchLearningChallenges() {
    console.log("🔍 AI Assistant - Fetching learning challenges from API");
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasChallengesContentTarget) {
        this.challengesContentTarget.innerHTML = "<p class='error'>Please select a file first to get learning challenges.</p>";
      }
      
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      return;
    }
    
    // Always make sure loading indicator is visible first
    if (this.hasLoadingIndicatorTarget) {
      this.showLoadingIndicator();
    }
    
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add('hidden');
    }
    
    if (this.hasChallengesContentTarget) {
      // Clear existing content to make loading more obvious
      this.challengesContentTarget.innerHTML = "";
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const url = `/api/file_learning_challenges?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}`;
      console.log("🔍 AI Assistant - Request URL:", url);
      
      fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        }
      })
      .then(response => {
        console.log("🔍 AI Assistant - Learning challenges response status:", response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch learning challenges: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("🔍 AI Assistant - Received learning challenges data");
        // Add refresh button
        const refreshButton = `<div class="refresh-button"><button data-action="click->ai-assistant#refreshChallenges">Refresh</button></div>`;
        this.challengesContentTarget.innerHTML = this.formatExplanation(data.challenges) + refreshButton;
        this.challengesLoaded = true;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
      })
      .catch(error => {
        console.error('Error fetching learning challenges:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load learning challenges. Please try again.';
        }
        
        this.hideLoadingIndicator();
      });
    }, 100); // Small delay to ensure UI updates
  }
  
  fetchRelatedPatterns() {
    console.log("🔍 AI Assistant - Fetching related patterns from API");
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasPatternsContentTarget) {
        this.patternsContentTarget.innerHTML = "<p class='error'>Please select a file first to get related patterns.</p>";
      }
      
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      return;
    }
    
    // Always make sure loading indicator is visible first
    if (this.hasLoadingIndicatorTarget) {
      this.showLoadingIndicator();
    }
    
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add('hidden');
    }
    
    if (this.hasPatternsContentTarget) {
      // Clear existing content to make loading more obvious
      this.patternsContentTarget.innerHTML = "";
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const url = `/api/file_related_patterns?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}`;
      console.log("🔍 AI Assistant - Request URL:", url);
      
      fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        }
      })
      .then(response => {
        console.log("🔍 AI Assistant - Related patterns response status:", response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch related patterns: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("🔍 AI Assistant - Received related patterns data");
        // Add refresh button
        const refreshButton = `<div class="refresh-button"><button data-action="click->ai-assistant#refreshPatterns">Refresh</button></div>`;
        this.patternsContentTarget.innerHTML = this.formatExplanation(data.patterns) + refreshButton;
        this.patternsLoaded = true;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
      })
      .catch(error => {
        console.error('Error fetching related patterns:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load related patterns. Please try again.';
        }
        
        this.hideLoadingIndicator();
      });
    }, 100); // Small delay to ensure UI updates
  }
  
  fetchVisualizations() {
    console.log("🔍 AI Assistant - Fetching visualizations from API");
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasVisualizationsContentTarget) {
        this.visualizationsContentTarget.innerHTML = "<p class='error'>Please select a file first to get visualizations.</p>";
      }
      
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      return;
    }
    
    // Always make sure loading indicator is visible first
    if (this.hasLoadingIndicatorTarget) {
      this.showLoadingIndicator();
    }
    
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add('hidden');
    }
    
    if (this.hasVisualizationsContentTarget) {
      // Clear existing content to make loading more obvious
      this.visualizationsContentTarget.innerHTML = "";
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const url = `/api/file_visualizations?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}`;
      console.log("🔍 AI Assistant - Request URL:", url);
      
      fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        }
      })
      .then(response => {
        console.log("🔍 AI Assistant - Visualizations response status:", response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch visualizations: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("🔍 AI Assistant - Received visualizations data");
        // Add refresh button
        const refreshButton = `<div class="refresh-button"><button data-action="click->ai-assistant#refreshVisualizations">Refresh</button></div>`;
        this.visualizationsContentTarget.innerHTML = this.formatExplanation(data.visualizations) + refreshButton;
        this.visualizationsLoaded = true;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
      })
      .catch(error => {
        console.error('Error fetching visualizations:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load visualizations. Please try again.';
        }
        
        this.hideLoadingIndicator();
      });
    }, 100); // Small delay to ensure UI updates
  }
  
  // Helper methods to refresh content
  refreshChallenges() {
    console.log("🔍 AI Assistant - Refreshing learning challenges");
    this.challengesLoaded = false;
    this.fetchLearningChallenges();
  }
  
  refreshPatterns() {
    console.log("🔍 AI Assistant - Refreshing related patterns");
    this.patternsLoaded = false;
    this.fetchRelatedPatterns();
  }
  
  refreshVisualizations() {
    console.log("🔍 AI Assistant - Refreshing visualizations");
    this.visualizationsLoaded = false;
    this.fetchVisualizations();
  }
} 