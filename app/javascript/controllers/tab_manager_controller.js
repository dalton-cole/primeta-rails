import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tabContent"]
  
  connect() {
    console.log("Tab manager connected", this.tabContentTargets.length);
    
    // Handle initial state for Turbo navigation
    // If the page is loaded via Turbo Drive, ensure tabs work correctly
    this.setupTabs();
  }
  
  setupTabs() {
    // This can be called on Turbo navigation events to ensure tabs work
    // Nothing needs to be done here as the click handler is already attached
    // via data-action in the HTML
  }
  
  switchTab(event) {
    const clickedTab = event.currentTarget;
    const tabId = clickedTab.getAttribute('data-tab');
    
    if (clickedTab.classList.contains('active')) {
      // Already active tab, do nothing
      return;
    }
    
    // Get all tab buttons and remove active class
    const allTabButtons = document.querySelectorAll('.tab-btn');
    allTabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked tab
    clickedTab.classList.add('active');
    
    // Handle content switching with animations
    this.tabContentTargets.forEach(content => {
      if (content.classList.contains('active')) {
        // Animate out current tab
        content.style.opacity = '0';
        content.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          // Hide current tab
          content.classList.remove('active');
          
          // Find and show new tab
          const newActiveContent = document.getElementById(`${tabId}-tab`);
          if (newActiveContent) {
            newActiveContent.classList.add('active');
            newActiveContent.style.opacity = '0';
            newActiveContent.style.transform = 'translateY(10px)';
            
            // Force reflow for animation
            void newActiveContent.offsetWidth;
            
            // Animate in new tab
            newActiveContent.style.opacity = '1';
            newActiveContent.style.transform = 'translateY(0)';
          }
        }, 150);
      }
    });
  }
} 