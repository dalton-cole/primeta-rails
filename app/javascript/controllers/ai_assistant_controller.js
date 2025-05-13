import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "panel", 
    "content", 
    "contextContent",
    "contextFilePath",
    "challengesContent", 
    "learningContent",
    "learningTabLink",
    "tabContent",
    "tabLink",
    "loadingIndicator", 
    "errorMessage"
  ]
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
    
    // Store pending requests to prevent duplicate fetch calls
    this.pendingRequests = {}
    
    // Track last request timestamps to throttle repeated calls
    this.lastRequestTimestamps = {}
    this.lastRequests = {} // Add this for the canMakeRequest method
    
    // Initialize request queue for prioritization
    this.requestQueue = []
    
    // Set up URL change observation
    this.observeURLChanges();
    
    // Request throttling configuration
    this.requestThrottleMs = 3000 // Don't make the same request more than once per 3 seconds
    
    // Set file path in hidden input if available in values but not in target
    if (this.hasContextFilePathTarget && this.hasFilePathValue && !this.contextFilePathTarget.value) {
      console.log("Setting file path in hidden input:", this.filePathValue);
      this.contextFilePathTarget.value = this.filePathValue;
    }

    // Try to extract file path from the URL if it's not available
    if (this.hasContextFilePathTarget && !this.contextFilePathTarget.value && !this.filePathValue) {
      const extractedPath = this.extractFilePathFromURL();
      if (extractedPath) {
        console.log("Extracted file path from URL:", extractedPath);
        this.contextFilePathTarget.value = extractedPath;
        if (this.hasFilePathValue) {
          this.filePathValue = extractedPath;
        }
      }
    }
    
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
      // Show loading placeholder immediately for better UX
      this.showLoadingPlaceholder();
      // Queue the context fetch with priority
      this.queueContextFetch();
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
    
    // Clean up URL observer if it exists
    if (this._urlObserver) {
      this._urlObserver.disconnect();
      this._urlObserver = null;
    }
    
    // Remove popstate listener
    window.removeEventListener('popstate', this.handlePopState.bind(this));
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
  
  fetchFileContext() {
    console.log("fetchFileContext called");
    console.log("Has contextFilePathTarget:", this.hasContextFilePathTarget);
    console.log("Has filePathValue:", this.hasFilePathValue);
    console.log("repositoryIdValue:", this.repositoryIdValue);
    
    if (this.hasContextFilePathTarget) {
      console.log("contextFilePathTarget value:", this.contextFilePathTarget.value);
    }
    
    if (this.hasFilePathValue) {
      console.log("filePathValue:", this.filePathValue);
    }
    
    if (!this.canMakeRequest('file_context')) {
      console.log("Request throttled, ignoring");
      return;
    }
    
    // Update the last request timestamp for this type
    this.lastRequests['file_context'] = Date.now();
    
    // Reset error state
    this.contextError = false;
    this.contextErrorMessage = '';
    
    // Show the loading state
    this.showLoadingIndicator();
    
    // Try to set file path again if it's missing
    if (this.hasContextFilePathTarget && !this.contextFilePathTarget.value && this.hasFilePathValue) {
      this.contextFilePathTarget.value = this.filePathValue;
    } else if (!this.filePathValue && this.hasContextFilePathTarget && this.contextFilePathTarget.value) {
      this.filePathValue = this.contextFilePathTarget.value;
    } else if (!this.filePathValue && !this.contextFilePathTarget.value) {
      // Last resort - try to extract from URL
      const extractedPath = this.extractFilePathFromURL();
      if (extractedPath) {
        console.log("Extracted file path from URL as last resort:", extractedPath);
        if (this.hasContextFilePathTarget) {
          this.contextFilePathTarget.value = extractedPath;
        }
        if (this.hasFilePathValue) {
          this.filePathValue = extractedPath;
        }
      }
    }
    
    // Get the current file path
    const filePath = this.hasContextFilePathTarget ? this.contextFilePathTarget.value : this.filePathValue;
    const repositoryId = this.repositoryIdValue;
    const adminMode = this.hasIsAdminValue && this.isAdminValue;
    const refreshParam = adminMode && this.forceRefreshValue ? '&refresh=true' : '';
    
    console.log("Final values for API call:", { filePath, repositoryId });
    
    // Validation to prevent malformed requests
    if (!repositoryId || !filePath) {
      console.error("Missing required parameters for API call", { repositoryId, filePath });
      this.hideLoadingIndicator();
      this.contextContentTarget.innerHTML = `
        <div class="ai-error">
          <h3>Error loading context</h3>
          <p>Missing required repository ID (${repositoryId}) or file path (${filePath}).</p>
          <button data-action="click->ai-assistant#tryRepairFilePath" class="retry-button">Try to Repair</button>
        </div>
      `;
      return;
    }
    
    // Check if we already have content loaded
    if (this.contextLoaded && !this.forceRefreshValue) {
      console.log("Context already loaded, skipping API call");
      this.hideLoadingIndicator();
      return;
    }

    // Make the fetch request with properly encoded parameters
    const encodedFilePath = encodeURIComponent(filePath);
    const url = `/api/file_context?repository_id=${repositoryId}&file_path=${encodedFilePath}${refreshParam}`;
    
    console.log("Fetching file context from API:", url);
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Unknown error occurred');
          });
        }
        return response.json();
      })
      .then(data => {
        this.handleApiResponse(data);
      })
      .catch(error => {
        console.error("Error fetching file context:", error);
        this.contextError = true;
        this.contextErrorMessage = error.message;
        this.hideLoadingIndicator();
        this.contextContentTarget.innerHTML = `
          <div class="ai-error">
            <h3>Error loading context</h3>
            <p>${error.message}</p>
            <button data-action="click->ai-assistant#fetchFileContext" class="retry-button">Retry</button>
          </div>
        `;
      });
  }
  
  handleApiResponse(data) {
    this.hideLoadingIndicator();
    
    // Debug logging to see raw format from API
    console.log("Raw API response:", {
      responseStart: data.explanation?.substring(0, 30) || 'none',
      responseEnd: data.explanation?.substring(data.explanation.length - 30) || 'none',
      hasMarkdownWrapper: data.explanation?.startsWith('```markdown') && data.explanation?.endsWith('```')
    });
    
    // Check if we have a valid response
    if (data && data.explanation) {
      // Add refresh button only for admins
      const refreshButton = this.hasIsAdminValue && this.isAdminValue ? 
        `<div class="refresh-button"><button data-action="click->ai-assistant#refreshFileContext">Force Refresh</button></div>` : '';
        
      // Add cache indicator if response was cached
      const cacheIndicator = data.cached ? 
        `<div class="cache-indicator">(Cached at ${data.cached_at})</div>` : '';
      
      // Create feedback UI
      const feedbackUI = this.createFeedbackUI('context');
      
      // Apply the formatted explanation to the content area
      this.contextContentTarget.innerHTML = this.formatExplanation(data.explanation) + refreshButton + cacheIndicator + feedbackUI;
      this.contextContentTarget.classList.add('loaded');
      this.contextLoaded = true;
      
      // Check if feedback UI should be shown
      this.checkExistingFeedback('context');
    } else {
      this.contextContentTarget.innerHTML = `
        <div class="ai-error">
          <h3>Invalid response</h3>
          <p>The API returned an invalid response.</p>
          <button data-action="click->ai-assistant#fetchFileContext" class="retry-button">Retry</button>
        </div>
      `;
    }
  }
  
  // New method to prefetch challenges in background
  prefetchChallenges() {
    if (this.challengesLoaded || !this.hasRepositoryIdValue || !this.hasFilePathValue) {
      return;
    }
    
    console.log("🔍 AI Assistant - Prefetching challenges in background");
    // Queue with lower priority
    this.queueContextFetch(false, 'low');
  }
  
  // Method to retry fetching context
  retryContextFetch() {
    console.log("🔍 AI Assistant - Retrying context fetch");
    this.showLoadingIndicator();
    this.fetchFileContext();
  }
  
  // Queue context fetch with priority handling
  queueContextFetch(forceRefresh = false, priority = 'high') {
    // Create a unique request identifier to check for duplicate/recent requests
    const requestId = `context_${this.repositoryIdValue}_${this.filePathValue}_${forceRefresh}`;
    
    // Check if this request was made too recently (throttling)
    const now = Date.now();
    const lastRequestTime = this.lastRequestTimestamps[requestId] || 0;
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < this.requestThrottleMs && !forceRefresh) {
      console.log(`🔍 AI Assistant - Queue request throttled (made ${timeSinceLastRequest}ms ago, minimum interval is ${this.requestThrottleMs}ms)`);
      return;
    }
    
    const request = {
      type: 'context',
      priority: priority,
      execute: () => this.fetchFileContext(forceRefresh),
      timestamp: Date.now()
    };
    
    this.requestQueue.push(request);
    this.processNextRequest();
  }
  
  // Process next request from queue
  processNextRequest() {
    if (this.requestQueue.length === 0) {
      return;
    }
    
    // Sort queue by priority (high first) then by timestamp (oldest first)
    this.requestQueue.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return a.timestamp - b.timestamp;
    });
    
    // Process highest priority request
    const request = this.requestQueue.shift();
    request.execute();
  }
  
  // Show a loading placeholder for better UX
  showLoadingPlaceholder() {
    if (this.hasContextContentTarget && !this.contextLoaded) {
      this.contextContentTarget.innerHTML = this.getLoadingPlaceholder();
    }
  }
  
  // Get a loading placeholder template
  getLoadingPlaceholder() {
    return `
      <div class="ai-loading-placeholder">
        <div class="placeholder-line" style="width: 90%"></div>
        <div class="placeholder-line" style="width: 75%"></div>
        <div class="placeholder-paragraph">
          <div class="placeholder-line" style="width: 100%"></div>
          <div class="placeholder-line" style="width: 95%"></div>
          <div class="placeholder-line" style="width: 98%"></div>
          <div class="placeholder-line" style="width: 85%"></div>
        </div>
        <div class="placeholder-paragraph">
          <div class="placeholder-line" style="width: 100%"></div>
          <div class="placeholder-line" style="width: 93%"></div>
          <div class="placeholder-line" style="width: 89%"></div>
        </div>
      </div>
    `;
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
    // If no text provided, return empty string to avoid errors
    if (!text) return '';
    
    console.log("Formatting text, first 100 chars:", text.substring(0, 100));
    
    // If text is already wrapped in a markdown code block, extract the content
    if (text.startsWith('```markdown') && text.endsWith('```')) {
      console.log("Detected markdown wrapper, extracting content");
      // Extract the actual content from inside the markdown block
      text = text.substring('```markdown'.length, text.length - 3).trim();
    }
    
    // Process text in steps for more consistent markdown-like formatting
    
    // Step 1: Escape HTML in the original text for security
    // But don't escape existing HTML entities like &lt; and &gt;
    let processedText = String(text).replace(/[<>]/g, function(match) {
      return match === '<' ? '&lt;' : '&gt;';
    });
    
    // Before processing, check if the entire text is a single code block
    // This handles case where Gemini returns just a code block without markdown wrapper
    if (processedText.trim().startsWith('```') && processedText.trim().endsWith('```')) {
      const content = processedText.trim().slice(3, -3).trim();
      // Check if it has a language specifier
      const firstLineBreak = content.indexOf('\n');
      if (firstLineBreak > 0) {
        const possibleLang = content.substring(0, firstLineBreak).trim();
        if (/^[a-zA-Z0-9_]+$/.test(possibleLang)) {
          // It's a language specifier, so format as a code block
          return `<pre class="ai-code-block"><code class="ai-code language-${possibleLang}">${content.substring(firstLineBreak+1).replace(/\n/g, '<br>')}</code></pre>`;
        }
      }
      // No language specifier, just a code block
      return `<pre class="ai-code-block"><code class="ai-code">${content.replace(/\n/g, '<br>')}</code></pre>`;
    }
    
    // Step 2: Capture multi-line code blocks first (```code```)
    const multiLineCodeBlocks = [];
    processedText = processedText.replace(/```(?:([a-zA-Z0-9_]+)\n)?([\s\S]*?)```/g, (match, language, code) => {
      const placeholder = `__MULTI_LINE_CODE_BLOCK_${multiLineCodeBlocks.length}__`;
      multiLineCodeBlocks.push({ language: language || '', content: code });
      return placeholder;
    });
    
    // Step 3: Capture inline code blocks (`code`)
    const inlineCodeBlocks = [];
    processedText = processedText.replace(/`([^`]*?)`/g, (match, code) => {
      const placeholder = `__INLINE_CODE_BLOCK_${inlineCodeBlocks.length}__`;
      inlineCodeBlocks.push(code);
      return placeholder;
    });
    
    // Step 4: Process headings (improved to handle all header levels)
    processedText = processedText
      .replace(/^#{1}\s+(.*?)$/gm, '<h1 class="ai-heading ai-h1">$1</h1>')
      .replace(/^#{2}\s+(.*?)$/gm, '<h2 class="ai-heading ai-h2">$1</h2>')
      .replace(/^#{3}\s+(.*?)$/gm, '<h3 class="ai-heading ai-h3">$1</h3>')
      .replace(/^#{4}\s+(.*?)$/gm, '<h4 class="ai-heading ai-h4">$1</h4>')
      .replace(/^#{5,6}\s+(.*?)$/gm, '<h5 class="ai-heading ai-h5">$1</h5>');
    
    // Step 5: Process lists properly
    // First identify all list items (both - and * bullets)
    let orderedListRegex = /^(\d+\.)\s+(.*?)$/gm;
    let unorderedListRegex = /^[\-\*]\s+(.*?)$/gm;
    
    // Handle ordered lists
    if (processedText.match(orderedListRegex)) {
      // We have ordered list items, wrap each in <li> tags
      processedText = processedText.replace(orderedListRegex, '<li class="ai-list-item">$2</li>');
      
      // Process the lines for ordered lists
      const lines = processedText.split('\n');
      let inOrderedList = false;
      let newLines = [];
      
      for (const line of lines) {
        if (line.startsWith('<li class="ai-list-item">')) {
          if (!inOrderedList) {
            newLines.push('<ol class="ai-ordered-list">');
            inOrderedList = true;
          }
          newLines.push(line);
        } else {
          if (inOrderedList) {
            newLines.push('</ol>');
            inOrderedList = false;
          }
          newLines.push(line);
        }
      }
      
      // Close any remaining open ordered list
      if (inOrderedList) {
        newLines.push('</ol>');
      }
      
      processedText = newLines.join('\n');
    }
    
    // Handle unordered lists
    if (processedText.match(unorderedListRegex)) {
      // We have unordered list items, wrap each in <li> tags
      processedText = processedText.replace(unorderedListRegex, '<li class="ai-list-item">$1</li>');
      
      // Process the lines for unordered lists
      const lines = processedText.split('\n');
      let inUnorderedList = false;
      let newLines = [];
      
      for (const line of lines) {
        if (line.startsWith('<li class="ai-list-item">')) {
          if (!inUnorderedList) {
            newLines.push('<ul class="ai-list">');
            inUnorderedList = true;
          }
          newLines.push(line);
        } else {
          if (inUnorderedList) {
            newLines.push('</ul>');
            inUnorderedList = false;
          }
          newLines.push(line);
        }
      }
      
      // Close any remaining open unordered list
      if (inUnorderedList) {
        newLines.push('</ul>');
      }
      
      processedText = newLines.join('\n');
    }
    
    // Step 6: Process bold and italic
    processedText = processedText
      .replace(/\*\*(.*?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="ai-italic">$1</em>');
    
    // Step 7: Restore inline code blocks
    inlineCodeBlocks.forEach((code, index) => {
      processedText = processedText.replace(
        `__INLINE_CODE_BLOCK_${index}__`, 
        `<code class="ai-code-inline">${code}</code>`
      );
    });
    
    // Step 8: Restore multi-line code blocks with proper formatting
    multiLineCodeBlocks.forEach((codeObj, index) => {
      // Add proper class for syntax highlighting based on the language if specified
      const languageClass = codeObj.language ? ` language-${codeObj.language.toLowerCase()}` : '';
      
      // Ensure the content is properly displayed with line breaks
      const formattedCode = codeObj.content.replace(/\n/g, '<br>');
      
      processedText = processedText.replace(
        `__MULTI_LINE_CODE_BLOCK_${index}__`, 
        `<pre class="ai-code-block"><code class="ai-code${languageClass}">${formattedCode}</code></pre>`
      );
    });
    
    // Step 9: Process paragraphs (convert double line breaks to paragraph breaks)
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
    
    // Clear the existing content while loading new context
    if (this.hasContextContentTarget) {
      this.contextContentTarget.innerHTML = "";
    }
    if (this.hasChallengesContentTarget) {
      this.challengesContentTarget.innerHTML = "";
    }
    
    // Show loading indicator
    if (this.hasLoadingIndicatorTarget) {
      this.showLoadingIndicator();
    }
    
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
    
    // Track the most recently detected file path to prevent redundant loading
    this._lastDetectedFilePath = null;
    
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
                // Skip if we're already loading this file
                if (this._lastDetectedFilePath === filePath) {
                  console.log("🔍 AI Assistant: Skipping duplicate file selection for:", filePath);
                  return;
                }
                
                this._lastDetectedFilePath = filePath;
                this.filePathValue = filePath;
                
                // Update the hidden input field
                if (this.hasContextFilePathTarget) {
                  this.contextFilePathTarget.value = filePath;
                }
                
                // If a file is selected, we're no longer on a repository guide page
                if (this.hasRepositoryNoFileValue) {
                  console.log("🔍 AI Assistant: File selected via click, turning off repository-no-file mode");
                  this.repositoryNoFileValue = false;
                }
                
                // Reset loading state
                this.contextLoaded = false;
                this.challengesLoaded = false;
                
                // Clear the existing content while waiting for new content
                if (this.hasContextContentTarget) {
                  this.contextContentTarget.innerHTML = "";
                }
                if (this.hasChallengesContentTarget) {
                  this.challengesContentTarget.innerHTML = "";
                }
                
                // Show loading indicator
                if (this.hasLoadingIndicatorTarget) {
                  this.showLoadingIndicator();
                }
                
                // Load context for the selected file
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
        const filePath = event.detail.filePath;
        
        // Skip if we're already loading this file
        if (this._lastDetectedFilePath === filePath) {
          console.log("🔍 AI Assistant: Skipping duplicate monaco:file-selected event for:", filePath);
          return;
        }
        
        // Update tracking
        this._lastDetectedFilePath = filePath;
        
        // Update the file path value
        this.filePathValue = filePath;
        
        // Update the hidden input field
        if (this.hasContextFilePathTarget) {
          this.contextFilePathTarget.value = filePath;
        }
        
        console.log("🔍 AI Assistant: Updated file path to", this.filePathValue);
        
        // If a file is selected, we're no longer on a repository guide page
        if (this.hasRepositoryNoFileValue) {
          console.log("🔍 AI Assistant: File selected via Monaco, turning off repository-no-file mode");
          this.repositoryNoFileValue = false;
        }
        
        // Reset loading state
        this.contextLoaded = false;
        this.challengesLoaded = false;
        
        // Clear the existing content while waiting for new content
        if (this.hasContextContentTarget) {
          this.contextContentTarget.innerHTML = "";
        }
        if (this.hasChallengesContentTarget) {
          this.challengesContentTarget.innerHTML = "";
        }
        
        // Show loading indicator
        if (this.hasLoadingIndicatorTarget) {
          this.showLoadingIndicator();
        }
        
        // Load context for the selected file
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
      // Skip auto-detection if we already have a file path from a more direct source
      if (this.filePathValue && this.filePathValue.trim() !== '') {
        console.log("🔍 AI Assistant: Already have file path, skipping auto-detection:", this.filePathValue);
        return;
      }
      
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
      if (detectedFilePath && detectedFilePath !== this._lastDetectedFilePath) {
        this._lastDetectedFilePath = detectedFilePath;
        this.filePathValue = detectedFilePath;
        this.contextLoaded = false;
        this.queueContextFetch(); // Use queue instead of direct fetch
        
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
  
  fetchLearningChallenges() {
    if (!this.canMakeRequest('learning_challenges')) {
      console.log("Request throttled, ignoring");
      return;
    }
    
    // Update the last request timestamp for this type
    this.lastRequests['learning_challenges'] = Date.now();
    
    // Show the learning tab content and switch to it
    this.tabContentTargets.forEach(content => content.classList.remove('active'));
    this.learningContentTarget.classList.add('active');
    
    this.tabLinkTargets.forEach(link => link.classList.remove('active'));
    this.learningTabLinkTarget.classList.add('active');
    
    // Show loading indicator
    this.learningContentTarget.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>Generating learning challenges...</p></div>';
    
    // Get request parameters
    const filePath = this.contextFilePathTarget.value;
    const repositoryId = this.repositoryIdValue;
    const adminMode = this.hasIsAdminValue && this.isAdminValue;
    const refreshParam = adminMode && this.forceRefreshValue ? '&refresh=true' : '';
    
    // Make the API request
    const url = `/api/file_context/learning_challenges?repository_id=${repositoryId}&file_path=${encodeURIComponent(filePath)}${refreshParam}`;
    
    console.log("Fetching learning challenges from API:", url);
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || 'Unknown error occurred');
          });
        }
        return response.json();
      })
      .then(data => {
        // Add refresh button for admin users
        const refreshButton = this.hasIsAdminValue && this.isAdminValue ? 
          `<div class="refresh-button"><button data-action="click->ai-assistant#refreshLearningChallenges">Force Refresh</button></div>` : '';
          
        // Add cache indicator if the response was cached
        const cacheIndicator = data.cached ? 
          `<div class="cache-indicator">(Cached at ${data.cached_at})</div>` : '';
        
        // Create feedback UI
        const feedbackUI = this.createFeedbackUI('challenges');
        
        // Apply the formatted challenges to the learning tab
        this.learningContentTarget.innerHTML = this.formatExplanation(data.challenges) + refreshButton + cacheIndicator + feedbackUI;
        this.learningLoaded = true;
        
        // Check if feedback UI should be shown
        this.checkExistingFeedback('challenges');
      })
      .catch(error => {
        console.error("Error fetching learning challenges:", error);
        this.learningContentTarget.innerHTML = `
          <div class="ai-error">
            <h3>Error loading learning challenges</h3>
            <p>${error.message}</p>
            <button data-action="click->ai-assistant#fetchLearningChallenges" class="retry-button">Retry</button>
          </div>
        `;
      });
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
  
  // Add the missing canMakeRequest method
  canMakeRequest(requestType) {
    const now = Date.now();
    const lastRequestTime = this.lastRequests[requestType] || 0;
    const timeSinceLastRequest = now - lastRequestTime;
    
    // Don't throttle if this is the first request or it's been long enough since the last one
    if (lastRequestTime === 0 || timeSinceLastRequest >= this.requestThrottleMs) {
      console.log(`AI Assistant: Request for ${requestType} allowed`);
      return true;
    }
    
    console.log(`AI Assistant: Request for ${requestType} throttled (made ${timeSinceLastRequest}ms ago)`);
    return false;
  }

  // Extract file path from URL
  extractFilePathFromURL() {
    try {
      const url = window.location.pathname;
      const matches = url.match(/\/repositories\/\d+\/files\/(.+)/);
      if (matches && matches[1]) {
        return decodeURIComponent(matches[1]);
      }
      
      // If direct pattern match fails, try to find it in the breadcrumbs
      const breadcrumbs = document.querySelector('.breadcrumbs');
      if (breadcrumbs) {
        const pathParts = breadcrumbs.textContent.trim().split('/');
        if (pathParts.length > 2) {
          return pathParts.slice(2).join('/').trim();
        }
      }
      
      // Try to get from Monaco editor if available
      const monacoElement = document.querySelector('[data-controller="monaco"]');
      if (monacoElement && monacoElement.dataset.monacoFilePathValue) {
        return monacoElement.dataset.monacoFilePathValue;
      }
      
      return null;
    } catch (e) {
      console.error("Error extracting file path from URL:", e);
      return null;
    }
  }

  // Method to try to repair the file path
  tryRepairFilePath() {
    console.log("Trying to repair file path...");
    
    // Try to extract from URL
    const extractedPath = this.extractFilePathFromURL();
    if (extractedPath) {
      console.log("Successfully extracted file path:", extractedPath);
      if (this.hasContextFilePathTarget) {
        this.contextFilePathTarget.value = extractedPath;
      }
      if (this.hasFilePathValue) {
        this.filePathValue = extractedPath;
      }
      
      // Try to fetch again
      this.fetchFileContext();
      return;
    }
    
    // If extraction fails, show a prompt to manually enter file path
    const filePath = prompt("Please enter the file path:", "");
    if (filePath) {
      console.log("Manually entered file path:", filePath);
      if (this.hasContextFilePathTarget) {
        this.contextFilePathTarget.value = filePath;
      }
      if (this.hasFilePathValue) {
        this.filePathValue = filePath;
      }
      
      // Try to fetch again
      this.fetchFileContext();
    }
  }

  // Add a new method to observe URL changes for file changes
  observeURLChanges() {
    // Use MutationObserver to watch for DOM changes that might indicate navigation
    const observer = new MutationObserver((mutations) => {
      // Only process once per batch of mutations
      const currentPath = window.location.pathname;
      if (this._lastObservedPath !== currentPath) {
        this._lastObservedPath = currentPath;
        
        // Check if this is a file path
        if (currentPath.includes('/files/')) {
          console.log("🔍 AI Assistant: URL changed to", currentPath);
          
          // Try to extract file path
          const extractedPath = this.extractFilePathFromURL();
          if (extractedPath && this._lastDetectedFilePath !== extractedPath) {
            console.log("🔍 AI Assistant: File changed via URL to:", extractedPath);
            
            this._lastDetectedFilePath = extractedPath;
            this.filePathValue = extractedPath;
            
            if (this.hasContextFilePathTarget) {
              this.contextFilePathTarget.value = extractedPath;
            }
            
            // Reset loading state and fetch new context
            this.contextLoaded = false;
            this.challengesLoaded = false;
            
            // Clear existing content while waiting for new content
            if (this.hasContextContentTarget) {
              this.contextContentTarget.innerHTML = "";
            }
            if (this.hasChallengesContentTarget) {
              this.challengesContentTarget.innerHTML = "";
            }
            
            // Show loading indicator
            if (this.hasLoadingIndicatorTarget) {
              this.showLoadingIndicator();
            }
            
            this.fetchFileContext();
          }
        }
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { childList: true, subtree: true });
    this._urlObserver = observer;
    this._lastObservedPath = window.location.pathname;
    
    // Also listen for popstate events (browser back/forward)
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }
  
  // Handle browser navigation
  handlePopState(event) {
    console.log("🔍 AI Assistant: popstate event detected");
    
    const currentPath = window.location.pathname;
    if (currentPath.includes('/files/')) {
      // Wait a moment for the DOM to update
      setTimeout(() => {
        const extractedPath = this.extractFilePathFromURL();
        if (extractedPath && this._lastDetectedFilePath !== extractedPath) {
          console.log("🔍 AI Assistant: File changed via browser navigation to:", extractedPath);
          
          this._lastDetectedFilePath = extractedPath;
          this.filePathValue = extractedPath;
          
          if (this.hasContextFilePathTarget) {
            this.contextFilePathTarget.value = extractedPath;
          }
          
          // Reset loading state and fetch new context
          this.contextLoaded = false;
          this.challengesLoaded = false;
          
          // Clear existing content while waiting for new content
          if (this.hasContextContentTarget) {
            this.contextContentTarget.innerHTML = "";
          }
          if (this.hasChallengesContentTarget) {
            this.challengesContentTarget.innerHTML = "";
          }
          
          // Show loading indicator
          if (this.hasLoadingIndicatorTarget) {
            this.showLoadingIndicator();
          }
          
          this.fetchFileContext();
        }
      }, 300);
    }
  }
} 