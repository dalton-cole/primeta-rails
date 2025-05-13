import { Controller } from "@hotwired/stimulus"
import { marked } from "marked" // Import the marked library

export default class extends Controller {
  static targets = [
    "panel", 
    "contextContent",
    "contextFilePath",
    "tabContent",
    "tabLink",
    "loadingIndicator", 
    "errorMessage",
    "staticAboutContextContent",
    "repositoryGuideContextContent",
    "dynamicFileContextContent",
  ]
  static values = {
    repositoryId: Number,
    initialFilePath: String, // Path from server on initial load (if file page)
    currentRepository: Boolean, // TODO: Still needed?
    isAdmin: Boolean,
    pageType: String // Expected: 'static', 'repository_guide', 'repository_file'
  }
  
  connect() {
    console.log("NEW_LOGIC: connect() called.");
    console.log("NEW_LOGIC: Initial Page Type from DOM:", this.element.dataset.aiAssistantPageTypeValue);
    console.log("NEW_LOGIC: Controller Initialized. Page Type (this.pageTypeValue):", this.pageTypeValue);
    console.log("NEW_LOGIC: Target Check: hasPanelTarget?", this.hasPanelTarget);
    console.log("NEW_LOGIC: Target Check: hasStaticAboutContextContentTarget?", this.hasStaticAboutContextContentTarget);
    console.log("NEW_LOGIC: Target Check: hasRepositoryGuideContextContentTarget?", this.hasRepositoryGuideContextContentTarget);
    // Add more target checks here if needed for debugging initial connection

    // --- Initialize Internal State ---
    this.isLoadingContext = false;
    this.currentDisplayFilePath = null; // Path of the file currently being displayed/loaded
    this.fetchedContextData = null;
    this.collapsed = true; 
    // Throttling for API requests (e.g., 500ms)
    this.requestThrottleMs = 500; 
    this.lastRequests = {}; // Track last request time per type

    if (this.pageTypeValue === 'repository_file' && this.hasInitialFilePathValue) {
      this.currentDisplayFilePath = this.initialFilePathValue;
      console.log("NEW_LOGIC: connect() - Set currentDisplayFilePath from initial value:", this.currentDisplayFilePath);
    }

    this.updatePanelVisibility();
    this._boundHandleFileSelected = this._handleFileSelected.bind(this);
    this.setupEventListeners();
    this.updatePanelDisplayLogic(); 
    console.log("NEW_LOGIC: connect() completed.");
  }
  
  disconnect() {
    // Cleanup Monaco listener
    if (this._boundMonacoFileSelectedHandler) {
      document.removeEventListener('monaco:file-selected', this._boundMonacoFileSelectedHandler);
    }
    
    // Cleanup file link observer
    if (this.fileObserver) {
      this.fileObserver.disconnect();
      this.fileObserver = null;
    }
    
    // Cleanup URL observer
    if (this._urlObserver) {
      this._urlObserver.disconnect();
      this._urlObserver = null;
    }
    
    // Cleanup popstate listener
    if (this._boundHandlePopState) {
      window.removeEventListener('popstate', this._boundHandlePopState);
    }
  }
  
  toggle(event) {
    if (event) event.preventDefault();
    this.collapsed = !this.collapsed;
    this.updatePanelVisibility();

    if (!this.collapsed && this.currentDisplayFilePath) { // Panel opened and a file path is set
      console.log("TOGGLE_ACTION: Panel opened with file path:", this.currentDisplayFilePath);
      // Check if data needs fetching 
      let needsFetch = false;
      if (!this.fetchedContextData && !this.isLoadingContext) {
        console.log("TOGGLE_ACTION: Triggering context fetch on open.");
        this.isLoadingContext = true;
        needsFetch = true;
        this.fetchFileContext();
      } 
      
      // Update display immediately (shows loading if fetch started, or existing content)
      this.updatePanelDisplayLogic(); 
    } else if (!this.collapsed) { // Panel opened, but no file path set
      console.log("TOGGLE_ACTION: Panel opened without file path (showing static/guide).");
      // Just ensure the display logic runs for static/guide content
      this.updatePanelDisplayLogic(); 
    } else {
      console.log("TOGGLE_ACTION: Panel closed.");
    }
  }
  
  updatePanelDisplayLogic() {
    console.log(`⭐ updatePanelDisplayLogic: Type=${this.pageTypeValue}, File=${this.currentDisplayFilePath || 'none'}, LoadingCtx=${this.isLoadingContext}`);
    
    const panel = this.hasPanelTarget ? this.panelTarget : null;
    const loadingIndicator = this.hasLoadingIndicatorTarget ? this.loadingIndicatorTarget : null;
    const errorMessage = this.hasErrorMessageTarget ? this.errorMessageTarget : null;
    const staticAboutCtx = this.hasStaticAboutContextContentTarget ? this.staticAboutContextContentTarget : null;
    const repoGuideCtx = this.hasRepositoryGuideContextContentTarget ? this.repositoryGuideContextContentTarget : null;
    const dynamicFileCtx = this.hasDynamicFileContextContentTarget ? this.dynamicFileContextContentTarget : null;

    if (!panel) return;

    const hideAllContent = () => {
      [staticAboutCtx, repoGuideCtx, dynamicFileCtx, loadingIndicator, errorMessage].forEach(target => {
        if (target) target.classList.add('hidden');
      });
    };
    hideAllContent();

    let showLoading = this.isLoadingContext; 

    if (showLoading && loadingIndicator) {
      console.log("⭐ Displaying: Loading Indicator");
      loadingIndicator.classList.remove('hidden');
    } else {
      let targetContentBlock = null;
      let errorMsgText = null;
      let isDynamicContentLoaded = false; // Flag to know if we loaded dynamic content

      if (this.pageTypeValue === 'static') {
        targetContentBlock = staticAboutCtx;
        console.log("⭐ Displaying: Static About Context");
      } else if (this.pageTypeValue === 'repository_guide' && !this.currentDisplayFilePath) {
        targetContentBlock = repoGuideCtx;
        console.log("⭐ Displaying: Repository Guide Context");
      } else if (this.currentDisplayFilePath && this.fetchedContextData !== null) {
        targetContentBlock = dynamicFileCtx;
        if (targetContentBlock) {
          let formattedContent = this.formatExplanation(this.fetchedContextData);
          if (typeof formattedContent !== 'string') {
            formattedContent = "";
          }
          const feedbackHtml = this.createFeedbackUI('context');
          targetContentBlock.innerHTML = formattedContent + feedbackHtml;
          isDynamicContentLoaded = true;
          console.log("⭐ Displaying: Dynamic File Context");
        }
      } else if (this.currentDisplayFilePath && !this.isLoadingContext) {
         errorMsgText = "Context not available for the selected file.";
         console.warn("⭐ Context state: File selected, no data, not loading.");
      } else if (!this.currentDisplayFilePath && this.pageTypeValue === 'repository_file') {
          errorMsgText = "No file selected.";
          console.warn("⭐ Context state: On file page, but no file selected/loading.");
      } else if (this.pageTypeValue !== 'static') { 
          targetContentBlock = repoGuideCtx;
          console.log("⭐ Displaying: Repository Guide Context (Fallback)");
      }
      
      if (targetContentBlock) {
        targetContentBlock.classList.remove('hidden');
        if (isDynamicContentLoaded) {
          this.checkExistingFeedback('context');
        }
      } else if (errorMessage) {
        errorMessage.textContent = errorMsgText || "AI Assistant content not available for this state.";
        errorMessage.classList.remove('hidden');
        console.warn("⭐ Displaying: Error Message - ", errorMessage.textContent);
      }
    }
    console.log("⭐ updatePanelDisplayLogic completed.");
  }
  
  updatePanelVisibility() {
    console.log("PANEL_VIS: updatePanelVisibility called. Collapsed:", this.collapsed, "Has Panel Target?", this.hasPanelTarget);
    if (this.hasPanelTarget) {
      if (this.collapsed) {
        this.panelTarget.classList.add("hidden");
        console.log("PANEL_VIS: Added 'hidden' to panel.");
      } else {
        this.panelTarget.classList.remove("hidden");
        console.log("PANEL_VIS: Removed 'hidden' from panel.");
      }
    } else {
      console.error("PANEL_VIS_ERROR: Panel target not found!");
    }
  }
  
  fetchFileContext() {
    console.log("fetchFileContext called");
    // Use internal state currentDisplayFilePath instead of initialFilePathValue or targets
    const filePath = this.currentDisplayFilePath;
    const repositoryId = this.repositoryIdValue;

    console.log("Current Display File Path:", filePath);
    console.log("repositoryIdValue:", repositoryId);
    
    if (!this.canMakeRequest('file_context')) {
      console.log("Request throttled, ignoring");
      this.isLoadingContext = false; 
      this.updatePanelDisplayLogic(); 
      return;
    }
    
    // Update the last request timestamp for this type
    this.lastRequests['file_context'] = Date.now();
    
    const adminMode = this.hasIsAdminValue && this.isAdminValue;
    const refreshParam = adminMode ? '&refresh=true' : '' // Simplified for now
    
    console.log("Final values for API call:", { filePath, repositoryId });
    
    // Validation to prevent malformed requests
    if (!repositoryId || !filePath) {
      console.error("Missing required parameters for API call", { repositoryId, filePath });
      this.isLoadingContext = false; // Ensure loading state is cleared
      if(this.hasErrorMessageTarget) {
           this.errorMessageTarget.textContent = "Cannot load context: file path or repository ID is missing.";
      }
      this.updatePanelDisplayLogic(); 
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
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log("Fetch successful, received data for:", filePath);
        // Explicitly check if explanation exists and is a string
        if (data && typeof data.explanation === 'string') {
          this.fetchedContextData = data.explanation;
          console.log("NEW_LOGIC: Assigned data.explanation to fetchedContextData.");
        } else {
          console.warn("API Response for context missing or invalid 'explanation' field. Data:", data);
          this.fetchedContextData = ""; // Assign empty string instead of undefined/null
        }
        this.isLoadingContext = false;
        this.updatePanelDisplayLogic(); // Update UI with fetched data or empty string
      })
      .catch(error => {
        console.error("Error fetching file context:", error);
        this.fetchedContextData = null; // Clear any potentially stale data
        this.isLoadingContext = false;
        // Update UI via central logic to show error
        if(this.hasErrorMessageTarget) {
             this.errorMessageTarget.textContent = `Error loading context: ${error.message}`;
        }
        this.updatePanelDisplayLogic(); 
      });
  }
  
  _handleFileSelected(filePath) {
    if (!filePath) {
      console.warn("NEW_LOGIC: _handleFileSelected called with no filePath.");
      return;
    }
    
    console.log("NEW_LOGIC: _handleFileSelected processing file:", filePath);

    // Skip if this file is already displayed and loaded (and not currently loading)
    if (this.currentDisplayFilePath === filePath && this.fetchedContextData !== null && !this.isLoadingContext) {
      console.log("NEW_LOGIC: Skipping redundant selection for already loaded file:", filePath);
      if (this.collapsed) { // Still open panel if user clicked again
        this.collapsed = false;
        this.updatePanelVisibility();
        this.updatePanelDisplayLogic(); // Ensure content is shown
      }
      return;
    }
    
    // Skip if we are currently trying to load this exact file path
    if (this.currentDisplayFilePath === filePath && this.isLoadingContext) {
      console.log("NEW_LOGIC: Skipping selection, already loading this file:", filePath);
      if (this.collapsed) { // Still open panel if user clicked again
        this.collapsed = false;
        this.updatePanelVisibility();
        this.updatePanelDisplayLogic(); // updatePanelDisplayLogic will show loading if already loading
      }
      return;
    }
    
    console.log(`NEW_LOGIC: Processing new file selection. Old path: ${this.currentDisplayFilePath}, New path: ${filePath}`);

    this.currentDisplayFilePath = filePath;
    this.fetchedContextData = null;
    this.isLoadingContext = true;

    // Update the hidden input target if it exists (e.g. for forms or other controllers)
    if (this.hasContextFilePathTarget) {
      this.contextFilePathTarget.value = filePath;
    }

    if (this.collapsed) {
      this.collapsed = false;
      this.updatePanelVisibility();
    }

    // Update UI to show loading state via the main display logic function
    console.log("NEW_LOGIC: _handleFileSelected calling updatePanelDisplayLogic to show loading.");
    this.updatePanelDisplayLogic();

    // Initiate the fetch for the new file's context
    console.log("NEW_LOGIC: _handleFileSelected calling fetchFileContext.");
    this.fetchFileContext();
  }
  
  // Method to try to repair the file path
  tryRepairFilePath() {
    console.log("NEW_LOGIC: tryRepairFilePath called.");
    const extractedPath = this.extractFilePathFromURL();
    if (extractedPath) {
      console.log("NEW_LOGIC: Path extracted by tryRepairFilePath:", extractedPath);
      // Use the new bound class method
      this._boundHandleFileSelected(extractedPath);
        return;
      }
    const manuallyEnteredPath = prompt("Please enter the file path:", this.currentDisplayFilePath || "");
    if (manuallyEnteredPath) {
       // Use the new bound class method
      this._boundHandleFileSelected(manuallyEnteredPath);
    }
  }
  
  setupEventListeners() {
    console.log("NEW_LOGIC: Setting up event listeners.");

    // Helper to attach click listeners to file links
    const attachFileListeners = (elements) => {
      elements.forEach(link => {
        if (!link.hasAttribute('data-ai-listener-attached')) {
          link.setAttribute('data-ai-listener-attached', 'true');
          link.addEventListener('click', (event) => {
            const filePathFromLink = link.dataset.path || link.textContent.trim();
            console.log("NEW_LOGIC: Direct file click detected on:", filePathFromLink);
            // Use the bound class method, possibly with a slight delay for Turbo
            setTimeout(() => this._boundHandleFileSelected(filePathFromLink), 50); 
          });
        }
      });
    };
    
    // Monaco editor event listener
    this._boundMonacoFileSelectedHandler = (event) => {
      console.log("NEW_LOGIC: Monaco 'monaco:file-selected' event", event.detail);
      if (event.detail && event.detail.filePath) {
        this._boundHandleFileSelected(event.detail.filePath);
      }
    };
    document.addEventListener('monaco:file-selected', this._boundMonacoFileSelectedHandler);

    // Initial attachment and MutationObserver for file links
    attachFileListeners(document.querySelectorAll('.file-item a'));
    this.fileObserver = new MutationObserver((mutations) => { // Store on 'this' for disconnect
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const fileLinks = [
                ...(node.classList?.contains('file-item') ? [node.querySelector('a')] : []),
                ...node.querySelectorAll('.file-item a')
              ].filter(Boolean);
              if (fileLinks.length) {
                attachFileListeners(fileLinks);
              }
            }
          });
        }
      });
    });
    this.fileObserver.observe(document.body, { childList: true, subtree: true });

    // Initial file detection on load
    setTimeout(() => {
      if (this.pageTypeValue === 'repository_file' && !this.currentDisplayFilePath && !this.isLoadingContext) {
      let detectedFilePath = null;
      const currentFileLink = document.querySelector('.file-item a.current-file');
      if (currentFileLink && currentFileLink.dataset.path) {
        detectedFilePath = currentFileLink.dataset.path;
        } else {
          const fileTitle = document.querySelector('.file-title .path-text'); // Be specific
          if (fileTitle && fileTitle.textContent) {
            detectedFilePath = fileTitle.textContent.trim();
          }
        }
        
        if (detectedFilePath) {
          console.log("NEW_LOGIC: Initial file detected on load:", detectedFilePath);
          // If connect() already set currentDisplayFilePath from initialFilePathValue, this won't run.
          // If initialFilePathValue was NOT present, and we detect a file, we select it.
          // This allows auto-selection if the page loads on a file view without initialFilePathValue being set.
          if (!this.currentDisplayFilePath) {
             console.log("NEW_LOGIC: Triggering selection for initially detected file as currentDisplayFilePath was null.", detectedFilePath);
             this._boundHandleFileSelected(detectedFilePath);
          } else {
            console.log("NEW_LOGIC: currentDisplayFilePath already set, not re-triggering for detected file.", this.currentDisplayFilePath)
          }
        } else {
          console.log("NEW_LOGIC: No initial file detected on load for repository_file page type, or path already set.");
        }
      } else {
         console.log("NEW_LOGIC: Skipping initial file detection (not repo_file page, or file/loading already in progress, or currentDisplayFilePath already set).");
      }
    }, 1000);

    // Setup URL observation listeners
    this._urlObserver = new MutationObserver(() => {
        const currentUrlPath = window.location.pathname;
        if (this._lastObservedUrlPath !== currentUrlPath) {
            const previousPath = this._lastObservedUrlPath;
            this._lastObservedUrlPath = currentUrlPath;
            console.log(`NEW_LOGIC: URL MutationObserver detected change from ${previousPath} to ${currentUrlPath}`);
            this._handleUrlChange(currentUrlPath);
        }
    });
    this._urlObserver.observe(document.body, { childList: true, subtree: true });
    this._lastObservedUrlPath = window.location.pathname; // Initialize for the observer

    this._boundHandlePopState = this.handlePopState.bind(this);
    window.addEventListener('popstate', this._boundHandlePopState);
  }

  handlePopState(event) {
    console.log("NEW_LOGIC: popstate event detected. Current URL path:", window.location.pathname);
    setTimeout(() => {
      this._handleUrlChange(window.location.pathname);
    }, 50); 
  }

  _handleUrlChange(newUrlPath) {
      if (newUrlPath.includes('/files/')) {
          const extractedPath = this.extractFilePathFromURL();
          // Check if extracted path is valid and different from the currently displayed file
          if (extractedPath && extractedPath !== this.currentDisplayFilePath) {
              console.log("NEW_LOGIC: URL change detected a new file path:", extractedPath);
              // Use the main handler
              this._boundHandleFileSelected(extractedPath); 
          } else if (extractedPath && extractedPath === this.currentDisplayFilePath) {
              console.log("NEW_LOGIC: URL changed, but path is the same as current. Ignoring.");
          } else if (!extractedPath && this.currentDisplayFilePath) {
              // Navigated away from a file view to a non-file view (e.g., repo root)
              console.log("NEW_LOGIC: URL changed away from file view. Clearing current file path.");
              this._clearCurrentFileState();
          }
      } else if (this.currentDisplayFilePath) {
          // URL changed to something that doesn't include '/files/', and we previously had a file loaded
          console.log("NEW_LOGIC: URL changed to non-file view. Clearing current file path.");
          this._clearCurrentFileState();
      }
  }
  
  _clearCurrentFileState() {
      this.currentDisplayFilePath = null;
      this.fetchedContextData = null;
      this.isLoadingContext = false;
      if (this.hasContextFilePathTarget) { this.contextFilePathTarget.value = ''; }
      this.updatePanelDisplayLogic(); // Update display (likely show repo guide or static)
  }
  
  // Tab switching functionality - Keep stub for single tab? Or remove? Let's remove.
  // switchTab(event) { 
  //   // No-op if only one tab
  // }
  
  // Create feedback UI component (Remains generic)
  createFeedbackUI(contentType) {
    // contentType will always be 'context' now, but keep param for potential future flexibility
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
  
  // Mark response as helpful (Remains generic)
  markHelpful(event) {
    const contentType = event.currentTarget.dataset.contentType; // Will be 'context'
    this.handleFeedbackSelection(event.currentTarget, true, contentType);
  }
  
  // Mark response as not helpful (Remains generic)
  markNotHelpful(event) {
    const contentType = event.currentTarget.dataset.contentType; // Will be 'context'
    this.handleFeedbackSelection(event.currentTarget, false, contentType);
  }
  
  // Handle feedback button selection (Remains generic)
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
  
  // Submit feedback (Remains generic, uses contentType)
  submitFeedback(event) {
    const contentType = event.currentTarget.dataset.contentType; // Will be 'context'
    const container = event.currentTarget.closest('.ai-feedback');
    
    if (!this._feedbackSelection || this._feedbackSelection.contentType !== contentType) {
      console.error("🔍 AI Assistant - No feedback selection found for:", contentType);
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
        file_path: this.currentDisplayFilePath, // Use internal state
        content_type: contentType, // Submit 'context'
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
      console.log(`🔍 AI Assistant - Feedback submitted successfully for ${contentType}:`, data);
      
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
        this.updateFeedbackStats(contentType, data.stats); // Pass contentType
      }
      
      // Clear feedback selection
      this._feedbackSelection = null;
    })
    .catch(error => {
      console.error(`Error submitting feedback for ${contentType}:`, error);
      
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
  
  // Add this new method to check for existing feedback (Remains generic, uses contentType)
  checkExistingFeedback(contentType) {
    // Use internal state currentDisplayFilePath
    const filePath = this.currentDisplayFilePath;
    const repositoryId = this.repositoryIdValue;
    
    if (!repositoryId || !filePath) return;
    
    const url = `/api/check_feedback?repository_id=${repositoryId}&file_path=${encodeURIComponent(filePath)}&content_type=${contentType}`;
    
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
        // Use a more specific selector that includes the target file path or ID if possible
        // For now, assume only one feedback UI is visible for the given contentType
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
  
  // Add this helper method to update feedback stats (Remains generic, uses contentType)
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
  
  formatExplanation(text) { 
    // Basic implementation: Check for null/undefined and return text or empty string
    if (typeof text === 'string' && text.trim().length > 0) {
      try {
        // Use marked to parse the Markdown text into HTML
        // Add basic sanitation options if needed, e.g., marked.parse(text, { sanitize: true });
        // For now, assuming API provides safe content.
        const html = marked.parse(text);
        return html;
      } catch (e) {
        console.error("Error parsing Markdown:", e);
        // Fallback to plain text if parsing fails
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
      }
    }
    return ""; // Return empty string if input is not a string or is empty
  }

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

  extractFilePathFromURL() {
    try {
      const url = window.location.pathname;
      // More specific regex to avoid matching other IDs
      const matches = url.match(/\/repositories\/\d+\/files\/(.+)/);
      if (matches && matches[1]) {
        // Decode URI component and remove potential trailing slash
        return decodeURIComponent(matches[1]).replace(/\/$/, '');
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
} 