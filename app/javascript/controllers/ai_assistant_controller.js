import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "content", "contextContent", "challengesContent", "loadingIndicator", "errorMessage"]
  static values = {
    repositoryId: Number,
    filePath: String,
    currentRepository: Boolean,
    staticInfo: Boolean,
    repositoryNoFile: Boolean,
    isAdmin: Boolean
  }
  
  connect() {
    console.log("🔍 AI Assistant: Controller connected");
    console.log("🔍 Has repositoryId:", this.hasRepositoryIdValue, "Value:", this.repositoryIdValue);
    console.log("🔍 Has filePath:", this.hasFilePathValue, "Value:", this.filePathValue);
    console.log("🔍 Is current repository:", this.hasCurrentRepositoryValue);
    console.log("🔍 Has static info:", this.hasStaticInfoValue);
    console.log("🔍 Has contextContent:", this.hasContextContentTarget);
    console.log("🔍 Has panel:", this.hasPanelTarget);
    console.log("🔍 Has content:", this.hasContentTarget);
    
    // Initialize in collapsed state
    this.collapsed = true
    this.updateVisibility()
    
    // Don't try to load context if we don't have both repository ID and file path
    this.contextLoaded = false
    this.challengesLoaded = false
    
    // For static info pages, we already have the content loaded
    if (this.hasStaticInfoValue && this.staticInfoValue) {
      this.contextLoaded = true
      this.challengesLoaded = true
      // Hide loading indicator immediately for static content
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      // Ensure static content is preserved in both tabs
      this._preserveStaticContent();
      
      // Add a delayed check to make sure static content is still intact after any potential race conditions
      setTimeout(() => {
        if (this.hasStaticInfoValue && this.staticInfoValue) {
          console.log("🔍 AI Assistant: Running delayed static content preservation check");
          this._preserveStaticContent();
        }
      }, 500);
    }
    
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
    
    // Disconnect the static content observer if it exists
    if (this._staticContentObserver) {
      console.log("🔍 AI Assistant: Disconnecting static content observer");
      this._staticContentObserver.disconnect();
      this._staticContentObserver = null;
    }
  }
  
  checkForFileData() {
    console.log("🔍 AI Assistant: Checking for file data after page load");
    console.log("🔍 Has repositoryId:", this.hasRepositoryIdValue, "Value:", this.repositoryIdValue);
    console.log("🔍 Has filePath:", this.hasFilePathValue, "Value:", this.filePathValue);
    
    if (this.hasRepositoryIdValue && this.hasFilePathValue) {
      console.log("🔍 AI Assistant: File data is available");
      
      // If a file path is set, we're no longer on a repository guide page
      if (this.hasRepositoryNoFileValue) {
        console.log("🔍 AI Assistant: File selected, turning off repository-no-file mode");
        this.repositoryNoFileValue = false;
      }
      
      // Reset context loaded flag when new file is loaded
      this.contextLoaded = false;
      this.challengesLoaded = false;
      
      // Automatically fetch context for the new file
      this.fetchFileContext();
      
      // Auto-open the panel when a file is loaded
      if (this.collapsed) {
        this.collapsed = false;
        this.updateVisibility();
      }
    } else if (this.hasRepositoryIdValue && !this.hasFilePathValue) {
      // We're on a repository page but no file is selected
      if (!this.hasRepositoryNoFileValue) {
        console.log("🔍 AI Assistant: Repository page with no file, enabling repository-no-file mode");
        this.repositoryNoFileValue = true;
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
    
    // Special handling for repository guide pages (repository with no file selected)
    if (this.hasRepositoryNoFileValue && this.repositoryNoFileValue) {
      console.log("🔍 AI Assistant: On repository guide page, no need to load context");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      return;
    }
    
    // For static information pages, just hide the loading indicator and preserve content
    if (this.hasStaticInfoValue && this.staticInfoValue) {
      console.log("🔍 AI Assistant: On static info page, preserving content");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      
      // Ensure static content is preserved by restoring from backup if needed
      if (this._staticContextContent && this.hasContextContentTarget && 
          this.contextContentTarget.textContent.includes("Please select a file first")) {
        console.log("🔍 AI Assistant: Restoring static context content in loadContextIfNeeded");
        this.contextContentTarget.innerHTML = this._staticContextContent;
      }
      return;
    }
    
    if (this.hasRepositoryIdValue && this.hasFilePathValue && this.hasContextContentTarget) {
      console.log("🔍 AI Assistant - Repository ID:", this.repositoryIdValue);
      console.log("🔍 AI Assistant - File Path:", this.filePathValue);
      
      if (!this.contextLoaded) {
        // Always show loading indicator first
        if (this.hasLoadingIndicatorTarget) {
          console.log("🔍 AI Assistant - Showing loading indicator");
          this.showLoadingIndicator();
          
          // Clear any previous content to make the loading more visible ONLY if we're loading new content
          if (this.hasContextContentTarget && this.contextContentTarget.innerHTML.trim() === "") {
            this.contextContentTarget.innerHTML = "";
          }
        } else {
          console.warn("🔍 AI Assistant - Loading indicator target not found");
        }
        
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
  
  fetchFileContext(forceRefresh = false) {
    console.log("🔍 AI Assistant - Fetching context from API");
    
    // Check for repository guide page
    if (this.hasRepositoryNoFileValue && this.repositoryNoFileValue) {
      console.log("🔍 AI Assistant - On repository guide page, skipping file context fetch");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      return;
    }
    
    // Always check first if we're on a static info page and exit early if so
    if (this.hasStaticInfoValue && this.staticInfoValue) {
      console.log("🔍 AI Assistant - On static info page, skipping file context fetch");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      return;
    }
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasContextContentTarget && !this.hasStaticInfoValue) {
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
    
    // Save current content before potentially clearing it
    if (this.hasContextContentTarget && !this._contextContentBackup) {
      this._contextContentBackup = this.contextContentTarget.innerHTML;
    }
    
    if (this.hasContextContentTarget) {
      // Only clear content if we're loading a new file or the content is empty
      if (!this.contextLoaded || this.contextContentTarget.innerHTML.trim() === "") {
        this.contextContentTarget.innerHTML = "";
      }
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const url = `/api/file_context?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}${refreshParam}`;
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
        console.log("🔍 AI Assistant - Cached flag:", data.cached, "Type:", typeof data.cached);
        
        // Add refresh button only for admins
        const refreshButton = this.hasIsAdminValue && this.isAdminValue ? 
          `<div class="refresh-button"><button data-action="click->ai-assistant#refreshContext">Refresh</button></div>` : '';
        const feedbackUI = this.createFeedbackUI('context');
        
        this.contextContentTarget.innerHTML = this.formatExplanation(data.explanation) + refreshButton + feedbackUI;
        this.contextLoaded = true;
        
        // Cache indicator has been removed but we still log whether content was cached
        if (data.cached === true || data.cached === 'true') {
          console.log("🔍 AI Assistant - Content loaded from cache");
        } else {
          console.log("🔍 AI Assistant - Fresh content loaded");
        }
        
        // Clear backup after successful load
        this._contextContentBackup = null;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
        
        // Check if user has already submitted feedback
        this.checkExistingFeedback('context');
      })
      .catch(error => {
        console.error('Error fetching file context:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load context. Please try again.';
        }
        
        // Restore content from backup if available
        if (this.hasContextContentTarget && this._contextContentBackup) {
          this.contextContentTarget.innerHTML = this._contextContentBackup;
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
    // Mark as not loaded to force reload
    this.contextLoaded = false;
    // Clear existing content to show the loading state
    if (this.hasContextContentTarget) {
      // Save a backup of the content in case the refresh fails
      this._contextContentBackup = this.contextContentTarget.innerHTML;
      // Only show loading if the tab is currently active
      if (document.querySelector('[data-tab="context"].active')) {
        this.contextContentTarget.innerHTML = "";
      }
    }
    // Force refresh from server (bypass cache)
    this.fetchFileContext(true);
  }
  
  formatExplanation(text) {
    // Process text in steps for more consistent markdown-like formatting
    
    // Step 1: Capture multi-line code blocks first (```code```)
    const multiLineCodeBlocks = [];
    let processedText = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      const placeholder = `__MULTI_LINE_CODE_BLOCK_${multiLineCodeBlocks.length}__`;
      multiLineCodeBlocks.push(code);
      return placeholder;
    });
    
    // Step 2: Capture inline code blocks (`code`)
    const inlineCodeBlocks = [];
    processedText = processedText.replace(/`([^`]*?)`/g, (match, code) => {
      const placeholder = `__INLINE_CODE_BLOCK_${inlineCodeBlocks.length}__`;
      inlineCodeBlocks.push(code);
      return placeholder;
    });
    
    // Step 3: Process headings (improved to handle all header levels)
    processedText = processedText
      .replace(/^#{1}\s+(.*?)$/gm, '<h1 class="ai-heading ai-h1">$1</h1>')
      .replace(/^#{2}\s+(.*?)$/gm, '<h2 class="ai-heading ai-h2">$1</h2>')
      .replace(/^#{3}\s+(.*?)$/gm, '<h3 class="ai-heading ai-h3">$1</h3>')
      .replace(/^#{4}\s+(.*?)$/gm, '<h4 class="ai-heading ai-h4">$1</h4>')
      .replace(/^#{5,6}\s+(.*?)$/gm, '<h5 class="ai-heading ai-h5">$1</h5>');
    
    // Step 4: Process lists properly
    // First identify all list items
    let listItemsFound = processedText.match(/^-\s+(.*?)$/gm);
    if (listItemsFound) {
      // We have list items, wrap each in <li> tags
      processedText = processedText.replace(/^-\s+(.*?)$/gm, '<li class="ai-list-item">$1</li>');
      
      // Then wrap consecutive <li> elements in a single <ul>
      // First, split by line breaks
      const lines = processedText.split('\n');
      let inList = false;
      let newLines = [];
      
      for (const line of lines) {
        if (line.startsWith('<li class="ai-list-item">')) {
          if (!inList) {
            newLines.push('<ul class="ai-list">');
            inList = true;
          }
          newLines.push(line);
        } else {
          if (inList) {
            newLines.push('</ul>');
            inList = false;
          }
          newLines.push(line);
        }
      }
      
      // Close any remaining open list
      if (inList) {
        newLines.push('</ul>');
      }
      
      processedText = newLines.join('\n');
    }
    
    // Step 5: Process bold and italic
    processedText = processedText
      .replace(/\*\*(.*?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="ai-italic">$1</em>');
    
    // Step 6: Restore inline code blocks
    inlineCodeBlocks.forEach((code, index) => {
      processedText = processedText.replace(
        `__INLINE_CODE_BLOCK_${index}__`, 
        `<code class="ai-code-inline">${code}</code>`
      );
    });
    
    // Step 7: Restore multi-line code blocks with proper formatting
    multiLineCodeBlocks.forEach((code, index) => {
      processedText = processedText.replace(
        `__MULTI_LINE_CODE_BLOCK_${index}__`, 
        `<pre class="ai-code-block"><code>${code}</code></pre>`
      );
    });
    
    // Step 8: Process paragraphs (convert double line breaks to paragraph breaks)
    processedText = processedText.replace(/\n\n/g, '<br><br>');
    
    return processedText;
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
    
    // If a file path is set, we're no longer on a repository guide page
    if (this.filePathValue) {
      console.log("🔍 AI Assistant - File selected, turning off repository-no-file mode");
      if (this.hasRepositoryNoFileValue) {
        this.repositoryNoFileValue = false;
      }
    }
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
                
                // If a file is selected, we're no longer on a repository guide page
                if (this.hasRepositoryNoFileValue) {
                  console.log("🔍 AI Assistant: File selected via click, turning off repository-no-file mode");
                  this.repositoryNoFileValue = false;
                }
                
                this.contextLoaded = false;
                this.challengesLoaded = false;
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
        
        // If a file is selected, we're no longer on a repository guide page
        if (this.hasRepositoryNoFileValue) {
          console.log("🔍 AI Assistant: File selected via Monaco, turning off repository-no-file mode");
          this.repositoryNoFileValue = false;
        }
        
        // Load context for the selected file
        this.contextLoaded = false;
        this.challengesLoaded = false;
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
    // Get the tab that was clicked
    const clickedTab = event.currentTarget;
    const tabName = clickedTab.dataset.tab;
    
    console.log("🔍 AI Assistant: Switching to tab:", tabName);
    
    // Update tab classes
    const tabs = document.querySelectorAll('.ai-assistant-tab');
    tabs.forEach(tab => {
      if (tab === clickedTab) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update content visibility using CSS classes only, not direct styles
    const contents = document.querySelectorAll('.ai-tab-content');
    contents.forEach(content => {
      if (content.dataset.tab === tabName) {
        content.classList.add('active');
        content.classList.remove('hidden');
      } else {
        content.classList.remove('active');
        // Don't add hidden class, just remove active
      }
    });
    
    // Special handling for repository guide pages (repository with no file selected)
    if (this.hasRepositoryNoFileValue && this.repositoryNoFileValue) {
      console.log("🔍 AI Assistant: On repository guide page, preserving content");
      
      // Check if current tab has repository guide flag
      const currentTab = document.querySelector(`.ai-tab-content[data-tab="${tabName}"]`);
      if (currentTab && currentTab.dataset.isRepositoryGuide === "true") {
        console.log("🔍 AI Assistant: Current tab is a repository guide tab");
        // No need to load anything, the content is already in the HTML
        return;
      }
    }
    
    // If we're on a page with static info, we just need to ensure the correct tab content is shown
    if (this.hasStaticInfoValue && this.staticInfoValue) {
      // Make sure static content in both tabs is preserved
      if (this.hasContextContentTarget && this.hasChallengesContentTarget) {
        // We don't need to load anything, just make sure both tabs have their static info
        console.log("🔍 AI Assistant - On static info page, preserving tab content");
        
        // If we're on the context tab and it has an error message, restore the static content
        if (tabName === 'context' && this._staticContextContent && 
            this.contextContentTarget.textContent.includes("Please select a file first")) {
          console.log("🔍 AI Assistant: Restoring static context content in switchTab");
          this.contextContentTarget.innerHTML = this._staticContextContent;
        }
        
        // If we're on the challenges tab and it has an error message, restore the static content
        if (tabName === 'challenges' && this._staticChallengesContent && 
            this.challengesContentTarget.textContent.includes("Please select a file first")) {
          console.log("🔍 AI Assistant: Restoring static challenges content in switchTab");
          this.challengesContentTarget.innerHTML = this._staticChallengesContent;
        }
      }
      return;
    }
    
    // For repository pages with file selected, load appropriate content
    if (tabName === 'context') {
      this.loadContextIfNeeded();
    } else if (tabName === 'challenges') {
      if (!this.challengesLoaded && this.hasRepositoryIdValue && this.hasFilePathValue) {
        this.fetchLearningChallenges();
      }
    }
  }
  
  fetchLearningChallenges(forceRefresh = false) {
    console.log("🔍 AI Assistant - Fetching learning challenges from API");
    
    // Check for repository guide page
    if (this.hasRepositoryNoFileValue && this.repositoryNoFileValue) {
      console.log("🔍 AI Assistant - On repository guide page, skipping learning challenges fetch");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      return;
    }
    
    // Always check first if we're on a static info page and exit early if so
    if (this.hasStaticInfoValue && this.staticInfoValue) {
      console.log("🔍 AI Assistant - On static info page, skipping learning challenges fetch");
      if (this.hasLoadingIndicatorTarget) {
        this.hideLoadingIndicator();
      }
      return;
    }
    
    // Don't proceed if we don't have the required data
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) {
      console.log("🔍 AI Assistant - Missing required values for API call:",
        { hasRepositoryId: this.hasRepositoryIdValue, hasFilePath: this.hasFilePathValue });
      
      if (this.hasChallengesContentTarget && !this.hasStaticInfoValue) {
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
    
    // Save current content before potentially clearing it
    if (this.hasChallengesContentTarget && !this._challengesContentBackup) {
      this._challengesContentBackup = this.challengesContentTarget.innerHTML;
    }
    
    if (this.hasChallengesContentTarget) {
      // Only clear content if it's empty or not already loaded
      if (!this.challengesLoaded || this.challengesContentTarget.innerHTML.trim() === "") {
        this.challengesContentTarget.innerHTML = "";
      }
    }
    
    // Force a small delay to ensure the loading state is rendered
    setTimeout(() => {
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const url = `/api/file_learning_challenges?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}${refreshParam}`;
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
        console.log("🔍 AI Assistant - Received learning challenges data:", data);
        console.log("🔍 AI Assistant - Challenges cached flag:", data.cached, "Type:", typeof data.cached);
        
        // Add refresh button only for admins
        const refreshButton = this.hasIsAdminValue && this.isAdminValue ? 
          `<div class="refresh-button"><button data-action="click->ai-assistant#refreshChallenges">Refresh</button></div>` : '';
        const feedbackUI = this.createFeedbackUI('challenges');
        
        this.challengesContentTarget.innerHTML = this.formatExplanation(data.challenges) + refreshButton + feedbackUI;
        this.challengesLoaded = true;
        
        // Cache indicator has been removed but we still log whether content was cached
        if (data.cached === true || data.cached === 'true') {
          console.log("🔍 AI Assistant - Challenges loaded from cache");
        } else {
          console.log("🔍 AI Assistant - Fresh challenges loaded");
        }
        
        // Clear backup after successful load
        this._challengesContentBackup = null;
        
        // Ensure loading indicator is completely hidden
        this.hideLoadingIndicator();
        
        // Check if user has already submitted feedback
        this.checkExistingFeedback('challenges');
      })
      .catch(error => {
        console.error('Error fetching learning challenges:', error);
        
        if (this.hasErrorMessageTarget) {
          this.errorMessageTarget.classList.remove('hidden');
          this.errorMessageTarget.textContent = 'Failed to load learning challenges. Please try again.';
        }
        
        // Restore content from backup if available
        if (this.hasChallengesContentTarget && this._challengesContentBackup) {
          this.challengesContentTarget.innerHTML = this._challengesContentBackup;
        }
        
        this.hideLoadingIndicator();
      });
    }, 100); // Small delay to ensure UI updates
  }
  
  refreshChallenges() {
    console.log("🔍 AI Assistant - Refreshing learning challenges");
    this.challengesLoaded = false;
    // Clear existing content to show the loading state
    if (this.hasChallengesContentTarget) {
      // Save a backup of the content in case the refresh fails
      this._challengesContentBackup = this.challengesContentTarget.innerHTML;
      // Only show loading if the tab is currently active
      if (document.querySelector('[data-tab="challenges"].active')) {
        this.challengesContentTarget.innerHTML = "";
      }
    }
    // Force refresh from server (bypass cache)
    this.fetchLearningChallenges(true);
  }
  
  // Create feedback UI component
  createFeedbackUI(contentType) {
    return `
      <div class="ai-feedback" data-content-type="${contentType}">
        <div class="ai-feedback-question">Was this response helpful?</div>
        <div class="ai-feedback-buttons">
          <button class="ai-feedback-button helpful" data-action="click->ai-assistant#markHelpful" data-content-type="${contentType}">
            <i class="bi bi-hand-thumbs-up"></i> Yes
          </button>
          <button class="ai-feedback-button not-helpful" data-action="click->ai-assistant#markNotHelpful" data-content-type="${contentType}">
            <i class="bi bi-hand-thumbs-down"></i> No
          </button>
        </div>
        <div class="ai-feedback-textarea" data-content-type="${contentType}">
          <textarea placeholder="Please tell us why (optional)" rows="3" data-content-type="${contentType}"></textarea>
          <button class="ai-feedback-submit" data-action="click->ai-assistant#submitFeedback" data-content-type="${contentType}">Submit Feedback</button>
        </div>
        <div class="ai-feedback-thanks" data-content-type="${contentType}">
          Thank you for your feedback!
        </div>
        <div class="ai-feedback-stats" data-content-type="${contentType}">
          <!-- Stats will be populated when feedback is received -->
        </div>
      </div>
    `;
  }
  
  // Mark response as helpful
  markHelpful(event) {
    const contentType = event.currentTarget.dataset.contentType;
    this.handleFeedbackSelection(event.currentTarget, true, contentType);
  }
  
  // Mark response as not helpful
  markNotHelpful(event) {
    const contentType = event.currentTarget.dataset.contentType;
    this.handleFeedbackSelection(event.currentTarget, false, contentType);
  }
  
  // Handle feedback button selection
  handleFeedbackSelection(button, isHelpful, contentType) {
    // Get all buttons for this content type
    const container = button.closest('.ai-feedback');
    const helpfulButton = container.querySelector('.ai-feedback-button.helpful');
    const notHelpfulButton = container.querySelector('.ai-feedback-button.not-helpful');
    
    // Reset both buttons
    helpfulButton.classList.remove('selected');
    notHelpfulButton.classList.remove('selected');
    
    // Select clicked button
    button.classList.add('selected');
    
    // Show textarea for additional feedback (especially for not helpful)
    const textarea = container.querySelector('.ai-feedback-textarea');
    if (textarea) {
      textarea.classList.add('visible');
      
      // If "Yes/Helpful" was clicked, provide option to submit without comments
      const submitButton = textarea.querySelector('.ai-feedback-submit');
      if (submitButton) {
        if (isHelpful) {
          submitButton.textContent = 'Submit';
        } else {
          submitButton.textContent = 'Submit Feedback';
        }
      }
    }
    
    // Store the selection for later submission
    this._feedbackSelection = {
      contentType: contentType,
      isHelpful: isHelpful
    };
  }
  
  // Submit feedback
  submitFeedback(event) {
    const contentType = event.currentTarget.dataset.contentType;
    const container = event.currentTarget.closest('.ai-feedback');
    
    if (!this._feedbackSelection || this._feedbackSelection.contentType !== contentType) {
      console.error("🔍 AI Assistant - No feedback selection found");
      return;
    }
    
    // Get textarea value
    const textarea = container.querySelector('textarea');
    const feedbackText = textarea ? textarea.value.trim() : '';
    
    // Disable submit button during submission
    const submitButton = event.currentTarget;
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    
    // Submit feedback to API
    fetch('/api/submit_feedback', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      },
      body: JSON.stringify({
        repository_id: this.repositoryIdValue,
        file_path: this.filePathValue,
        content_type: contentType,
        is_helpful: this._feedbackSelection.isHelpful,
        feedback_text: feedbackText
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("🔍 AI Assistant - Feedback submitted successfully:", data);
      
      // Hide textarea and show thank you message
      const textareaDiv = container.querySelector('.ai-feedback-textarea');
      if (textareaDiv) {
        textareaDiv.classList.remove('visible');
      }
      
      const thanksDiv = container.querySelector('.ai-feedback-thanks');
      if (thanksDiv) {
        thanksDiv.classList.add('visible');
      }
      
      // Update stats if available
      if (data.stats) {
        const statsDiv = container.querySelector('.ai-feedback-stats');
        if (statsDiv) {
          const helpfulCount = data.stats.helpful_count || 0;
          const notHelpfulCount = data.stats.not_helpful_count || 0;
          
          statsDiv.innerHTML = `
            <div class="ai-feedback-stat ai-feedback-stat-helpful">
              <i class="bi bi-hand-thumbs-up"></i> ${helpfulCount}
            </div>
            <div class="ai-feedback-stat ai-feedback-stat-not-helpful">
              <i class="bi bi-hand-thumbs-down"></i> ${notHelpfulCount}
            </div>
          `;
        }
      }
      
      // Clear feedback selection
      this._feedbackSelection = null;
    })
    .catch(error => {
      console.error('Error submitting feedback:', error);
      
      // Re-enable submit button
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Feedback';
      
      // Show error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'ai-error';
      errorDiv.textContent = 'Failed to submit feedback. Please try again.';
      
      // Remove existing error message if any
      const existingError = container.querySelector('.ai-error');
      if (existingError) {
        existingError.remove();
      }
      
      // Add error message before textarea
      const textareaDiv = container.querySelector('.ai-feedback-textarea');
      if (textareaDiv) {
        container.insertBefore(errorDiv, textareaDiv);
      } else {
        container.appendChild(errorDiv);
      }
    });
  }
  
  // Add this new method to check for existing feedback
  checkExistingFeedback(contentType) {
    if (!this.hasRepositoryIdValue || !this.hasFilePathValue) return;
    
    const url = `/api/check_feedback?repository_id=${this.repositoryIdValue}&file_path=${encodeURIComponent(this.filePathValue)}&content_type=${contentType}`;
    
    fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log(`🔍 AI Assistant - Existing feedback check for ${contentType}:`, data);
      
      if (data.has_feedback) {
        const container = document.querySelector(`.ai-feedback[data-content-type="${contentType}"]`);
        if (container) {
          // Disable buttons and show thank you message
          const buttons = container.querySelectorAll('.ai-feedback-button');
          buttons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
          });
          
          // Mark the selected option
          if (data.is_helpful) {
            container.querySelector('.ai-feedback-button.helpful').classList.add('selected');
          } else {
            container.querySelector('.ai-feedback-button.not-helpful').classList.add('selected');
          }
          
          // Show thank you message
          const thanksDiv = container.querySelector('.ai-feedback-thanks');
          if (thanksDiv) {
            thanksDiv.classList.add('visible');
            thanksDiv.textContent = "You've already provided feedback. Thank you!";
          }
          
          // Update stats
          this.updateFeedbackStats(contentType, data.stats);
        }
      }
    })
    .catch(error => {
      console.error(`Error checking existing feedback for ${contentType}:`, error);
    });
  }
  
  // Add this helper method to update feedback stats
  updateFeedbackStats(contentType, stats) {
    if (!stats) return;
    
    const container = document.querySelector(`.ai-feedback[data-content-type="${contentType}"]`);
    if (!container) return;
    
    const statsDiv = container.querySelector('.ai-feedback-stats');
    if (statsDiv) {
      const helpfulCount = stats.helpful_count || 0;
      const notHelpfulCount = stats.not_helpful_count || 0;
      
      statsDiv.innerHTML = `
        <div class="ai-feedback-stat ai-feedback-stat-helpful">
          <i class="bi bi-hand-thumbs-up"></i> ${helpfulCount}
        </div>
        <div class="ai-feedback-stat ai-feedback-stat-not-helpful">
          <i class="bi bi-hand-thumbs-down"></i> ${notHelpfulCount}
        </div>
      `;
    }
  }
  
  // Helper method to ensure static content is preserved when switching tabs
  _preserveStaticContent() {
    // Only needed for static content pages
    if (!this.hasStaticInfoValue || !this.staticInfoValue) return;
    
    console.log("🔍 AI Assistant: Setting up static content preservation");
    
    // Make sure both tabs are initialized with their content
    if (this.hasContextContentTarget && this.hasChallengesContentTarget) {
      // Save references to the static content in each tab if not already saved
      if (!this._staticContextContent) {
        console.log("🔍 AI Assistant: Saving static context content");
        this._staticContextContent = this.contextContentTarget.innerHTML;
      }
      
      if (!this._staticChallengesContent) {
        console.log("🔍 AI Assistant: Saving static challenges content");
        this._staticChallengesContent = this.challengesContentTarget.innerHTML;
      }
      
      // Immediately restore if either tab contains an error message
      if (this.contextContentTarget.textContent.includes("Please select a file first")) {
        console.log("🔍 AI Assistant: Found error in context tab, restoring");
        this.contextContentTarget.innerHTML = this._staticContextContent;
      }
      
      if (this.challengesContentTarget.textContent.includes("Please select a file first")) {
        console.log("🔍 AI Assistant: Found error in challenges tab, restoring");
        this.challengesContentTarget.innerHTML = this._staticChallengesContent;
      }
      
      // Add a mutation observer to restore content if it gets removed
      this._setupStaticContentObserver();
    }
  }
  
  // Set up observer to ensure static content isn't lost when switching tabs
  _setupStaticContentObserver() {
    if (!this._staticContextContent || !this._staticChallengesContent) return;
    
    // Observe the AI assistant content container for changes
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // Check if any of our tab content was modified
        if (mutation.type === 'childList' && mutation.target.classList.contains('ai-tab-content')) {
          // If context tab is empty but should have static content, restore it
          if (
            this.hasContextContentTarget && 
            this.contextContentTarget.innerHTML.trim() === '' && 
            this._staticContextContent
          ) {
            console.log("🔍 AI Assistant: Restoring static context content");
            this.contextContentTarget.innerHTML = this._staticContextContent;
          }
          
          // If challenges tab is empty but should have static content, restore it
          if (
            this.hasChallengesContentTarget && 
            this.challengesContentTarget.innerHTML.trim() === '' && 
            this._staticChallengesContent
          ) {
            console.log("🔍 AI Assistant: Restoring static challenges content");
            this.challengesContentTarget.innerHTML = this._staticChallengesContent;
          }
        }
      });
    });
    
    // Start observing both tabs
    if (this.hasContextContentTarget) {
      observer.observe(this.contextContentTarget, { childList: true, subtree: true });
    }
    if (this.hasChallengesContentTarget) {
      observer.observe(this.challengesContentTarget, { childList: true, subtree: true });
    }
    
    // Store observer so we can disconnect later if needed
    this._staticContentObserver = observer;
  }
} 