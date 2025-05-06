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
} 