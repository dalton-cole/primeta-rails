import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="file-explorer"
export default class extends Controller {
  static targets = ["directory", "dirHeader", "dirContents"];

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
    
    // Set up event listeners for directory headers
    this.dirHeaderTargets.forEach(header => {
      header.addEventListener("click", (event) => this.toggleDirectory(event));
    });
    
    // Listen for custom event to expand directories to a specific file
    document.addEventListener("expand-to-file", (event) => {
      const filePath = event.detail.path;
      if (filePath) {
        this.expandToFile(filePath);
      }
    });
    
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
      this.resizeObserver = new ResizeObserver(entries => {
        // After content changes, ensure scrollbar reflects new content
        fileExplorer.style.overflow = 'hidden';
        setTimeout(() => {
          fileExplorer.style.overflow = 'auto';
        }, 0);
      });
      
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
    
    console.log("📁 Directory clicked");
    
    // Find the directory container and header
    const header = event.currentTarget;
    const directory = header.closest(".directory");
    
    if (!directory) {
      console.error("Could not find parent directory element");
      return;
    }
    
    // Get the directory contents
    const dirContents = directory.querySelector('.directory-children');
    if (!dirContents) {
      console.error("Could not find directory contents element");
      return;
    }
    
    // Log initial state of directory
    console.log("📁 Directory initial state:", {
      hasExpandedClass: directory.classList.contains("expanded"),
      headerHasExpandedClass: header.classList.contains("expanded"),
      contentsDisplayStyle: dirContents.style.display
    });
    
    // Toggle expanded state
    const isExpanded = !directory.classList.contains("expanded");
    
    // Toggle the expanded class on both the directory and header
    directory.classList.toggle("expanded", isExpanded);
    header.classList.toggle("expanded", isExpanded);
    
    // Log after toggling classes
    console.log("📁 Directory after class toggle:", {
      isExpanded: isExpanded,
      hasExpandedClass: directory.classList.contains("expanded"),
      headerHasExpandedClass: header.classList.contains("expanded")
    });
    
    // Toggle display of directory contents
    if (isExpanded) {
      // Simply display content without animations
      dirContents.style.display = 'block';
      
      // Clear any inline max-height to let it expand naturally
      dirContents.style.maxHeight = 'none';
      
      // Log expanded state
      console.log("📁 Directory expanded, display:", dirContents.style.display);
      
      // Ensure parent container scrolls to accommodate new content
      this.updateScrollContainer();
    } else {
      // Immediately hide when collapsed, no animations
      dirContents.style.display = 'none';
      
      // Log collapsed state
      console.log("📁 Directory collapsed, display:", dirContents.style.display);
      
      // Update scroll container after hiding content
      this.updateScrollContainer();
    }
    
    // Update caret icon explicitly to ensure it rotates correctly
    const caretIcon = header.querySelector('.fa-caret-right');
    if (caretIcon) {
      // Use CSS transform instead of inline style for better performance
      // The CSS classes will handle the rotation
      console.log("📁 Setting caret rotation for state:", isExpanded ? "expanded" : "collapsed");
      
      // Force a reflow to make sure the CSS transition happens
      void caretIcon.offsetWidth;
    }
  }
  
  // Helper to update the scroll container after content changes
  updateScrollContainer() {
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
    
    // After expanding directories, try to highlight the file
    setTimeout(() => {
      const fileLink = this.element.querySelector(`a[data-path="${filePath}"]`);
      if (fileLink) {
        fileLink.classList.add('highlight-file');
        
        // Scroll the file into view, with a slight delay to ensure expansion is complete
        setTimeout(() => {
          fileLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, expandedAnyDirectory ? 300 : 0);
        
        // Remove highlight after a delay
        setTimeout(() => {
          fileLink.classList.remove('highlight-file');
        }, 2000);
      }
    }, 300);
  }
  
  disconnect() {
    // Clean up resize observer when controller disconnects
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Clean up event listener
    document.removeEventListener("expand-to-file", this.expandToFile);
  }
} 