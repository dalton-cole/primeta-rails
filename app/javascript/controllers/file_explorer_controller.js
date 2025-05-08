import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="file-explorer"
export default class extends Controller {
  static targets = ["directory", "toggle", "dirHeader", "dirContents"];

  connect() {
    // Set up initial state
    this.setupInitialState();
    
    // Add event listeners
    this.dirHeaderTargets.forEach(header => {
      header.addEventListener("click", this.toggleDirectory.bind(this));
    });
    
    // Listen for a custom event to expand directories to a specific file
    document.addEventListener("expand-to-file", (event) => {
      const filePath = event.detail.path;
      if (filePath) {
        this.expandToFile(filePath);
      }
    });
  }
  
  setupInitialState() {
    // Ensure all directory toggles have correct initial content
    this.toggleTargets.forEach(toggle => {
      if (!toggle.textContent.trim()) {
        toggle.textContent = "+";
      }
    });
  }
  
  toggleDirectory(event) {
    // Find the directory item
    const header = event.currentTarget;
    const dirItem = header.closest(".dir-item");
    
    // Toggle expanded state
    const isExpanded = dirItem.classList.toggle("expanded");
    
    // Update toggle content
    const toggle = header.querySelector(".dir-toggle");
    if (toggle) {
      toggle.textContent = isExpanded ? "-" : "+";
    }
    
    // Prevent event from bubbling to parent directories
    event.stopPropagation();
  }
  
  expandToFile(filePath) {
    if (!filePath) return;
    
    // Split the path into directories
    const parts = filePath.split('/');
    
    // Start with an empty path
    let currentPath = '';
    
    // Expand each directory in the path
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (i > 0 ? '/' : '') + parts[i];
      
      // Find the directory item with this path
      const dirItem = this.findDirectoryByPath(currentPath);
      if (dirItem) {
        // Expand this directory
        dirItem.classList.add('expanded');
        const toggle = dirItem.querySelector('.dir-toggle');
        if (toggle) {
          toggle.textContent = "-";
        }
      }
    }
  }
  
  findDirectoryByPath(path) {
    // Look through all directory items
    for (const dirItem of this.directoryTargets) {
      const dirHeader = dirItem.querySelector('.dir-header');
      const dirName = dirHeader?.querySelector('.dir-name')?.textContent?.trim();
      
      // Get parent path from data attribute or construct it
      const parentPath = dirItem.getAttribute('data-parent-path') || '';
      const fullPath = parentPath ? `${parentPath}/${dirName}` : dirName;
      
      if (fullPath === path) {
        return dirItem;
      }
    }
    return null;
  }
} 