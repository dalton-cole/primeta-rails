import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="file-explorer"
export default class extends Controller {
  static targets = ["directory", "dirHeader", "dirContents"];
  static values = { repositoryId: Number };

  // Add debounce utility
  debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  connect() {
    console.log("File explorer controller connected");
    
    // Ensure all directories start collapsed
    this.directoryTargets.forEach(directory => {
      if (!directory.classList.contains('expanded')) {
        const dirContents = directory.querySelector('.directory-children');
        if (dirContents) {
          dirContents.style.display = 'none';
        }
      }
    });
    
    // Initialize all caret rotations
    this.initializeCarets();
    
    // Set up event listeners for directory headers with debouncing
    this.dirHeaderTargets.forEach(header => {
      header.addEventListener("click", this.debounce((event) => this.toggleDirectory(event), 50));
    });
    
    // Listen for custom event to expand directories to a specific file - with debouncing
    this.boundExpandToFile = this.debounce(event => {
      const filePath = event.detail.path;
      if (filePath) {
        this.expandToFile(filePath);
      }
    }, 100);
    
    document.addEventListener("expand-to-file", this.boundExpandToFile);
    
    // Observe size changes to handle scrolling properly
    this.setupResizeObserver();
  }
  
  // Initialize all carets based on expanded state
  initializeCarets() {
    this.dirHeaderTargets.forEach(header => {
      const isExpanded = header.classList.contains('expanded');
      const caretIcon = header.querySelector('.fa-caret-right');
      if (caretIcon) {
        caretIcon.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    });
  }
  
  // Setup a resize observer to adjust scrolling when content changes
  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      const fileExplorer = this.element;
      
      // Create a resize observer to handle content changes
      // Use debounced callback for performance
      const debouncedResize = this.debounce(() => {
        fileExplorer.style.overflow = 'hidden';
        setTimeout(() => {
          fileExplorer.style.overflow = 'auto';
        }, 0);
      }, 150);
      
      this.resizeObserver = new ResizeObserver(debouncedResize);
      
      // Start observing the file tree
      const fileTree = fileExplorer.querySelector('.file-tree');
      if (fileTree) {
        this.resizeObserver.observe(fileTree);
      }
    }
  }
  
  toggleDirectory(event) {
    event.preventDefault();
    event.stopPropagation();

    const header = event.currentTarget;
    const directory = header.closest(".directory");
    if (!directory) return;

    const isExpanded = !directory.classList.contains("expanded");
    directory.classList.toggle("expanded", isExpanded);
    header.classList.toggle("expanded", isExpanded);

    // Only load children if expanding
    if (isExpanded) {
      const repoId = this.repositoryIdValue;
      const dirPath = directory.dataset.path;
      const frameId = `dir_${dirPath.replaceAll('/', '_')}`;
      const frame = document.getElementById(frameId);
      
      // Get the current level from the directory's data-level attribute
      const currentLevel = parseInt(directory.dataset.level, 10);
      const childLevel = currentLevel + 1;

      if (frame && !frame.src) {
        frame.src = `/repositories/${repoId}/tree?path=${encodeURIComponent(dirPath)}&level=${childLevel}`;
      }
    }

    // Update caret icon
    const caretIcon = header.querySelector('.fa-caret-right');
    if (caretIcon) {
      void caretIcon.offsetWidth;
    }
  }
  
  // Helper to update the scroll container after content changes - now debounced
  updateScrollContainer() {
    const debouncedUpdate = this.debounce(() => {
      const fileExplorer = this.element;
      if (fileExplorer) {
        // Force recalculation of scrollable area
        requestAnimationFrame(() => {
          // Toggle overflow to recalculate scrollbars
          const currentOverflow = fileExplorer.style.overflow;
          fileExplorer.style.overflow = 'hidden';
          
          // Force reflow
          void fileExplorer.offsetHeight;
          
          // Restore overflow
          fileExplorer.style.overflow = currentOverflow || 'auto';
        });
      }
    }, 100);
    
    debouncedUpdate();
  }
  
  expandToFile(filePath) {
    if (!filePath) return;
    
    console.log(`Expanding to file: ${filePath}`);
    
    // Split the path into directories
    const parts = filePath.split('/');
    
    // Start with an empty path
    let currentPath = '';
    let expandedAnyDirectory = false;
    
    // Expand each directory in the path
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (i > 0 ? '/' : '') + parts[i];
      
      // Find the directory with this path
      const dirLabel = this.element.querySelector(`.directory-label[data-path="${currentPath}"]`);
      
      if (dirLabel) {
        const directory = dirLabel.closest('.directory');
        
        // Only expand if not already expanded
        if (directory && !directory.classList.contains('expanded')) {
          // Manually trigger the click event to expand
          dirLabel.click();
          expandedAnyDirectory = true;
        }
        
        // Add active path highlight
        if (directory) {
          directory.classList.add('directory-path-active');
        }
      }
    }
    
    // After expanding directories, try to highlight the file - optimized with setTimeout
    this.highlightFile(filePath, expandedAnyDirectory);
  }
  
  // Extracted to a separate method
  highlightFile(filePath, expandedAnyDirectory) {
    setTimeout(() => {
      const fileLink = this.element.querySelector(`a[data-path="${filePath}"]`);
      if (fileLink) {
        fileLink.classList.add('highlight-file');
        
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          fileLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        
        // Remove highlight after a delay
        setTimeout(() => {
          fileLink.classList.remove('highlight-file');
        }, 2000);
      }
    }, expandedAnyDirectory ? 300 : 10);
  }
  
  disconnect() {
    // Clean up resize observer when controller disconnects
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Clean up event listener with the same bound function
    document.removeEventListener("expand-to-file", this.boundExpandToFile);
  }
} 