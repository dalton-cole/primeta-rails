import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "tab", "content"]
  
  connect() {
    // Initialize in collapsed state
    this.collapsed = true
    this.updateVisibility()
    
    // Set initial active tab
    if (this.tabTargets.length > 0) {
      this.activeTab = 0
      this.updateTabs()
    }
  }
  
  toggle() {
    this.collapsed = !this.collapsed
    this.updateVisibility()
  }
  
  switchTab(event) {
    const clickedTab = event.currentTarget
    const index = this.tabTargets.indexOf(clickedTab)
    
    if (index !== -1) {
      this.activeTab = index
      this.updateTabs()
    }
  }
  
  updateTabs() {
    this.tabTargets.forEach((tab, index) => {
      if (index === this.activeTab) {
        tab.classList.add('active')
      } else {
        tab.classList.remove('active')
      }
    })
    
    // Update content visibility based on active tab
    if (this.contentTargets.length > this.activeTab) {
      this.contentTargets.forEach((content, index) => {
        if (index === this.activeTab) {
          content.classList.remove('hidden')
        } else {
          content.classList.add('hidden')
        }
      })
    }
  }
  
  updateVisibility() {
    if (this.collapsed) {
      this.panelTarget.classList.add("hidden")
    } else {
      this.panelTarget.classList.remove("hidden")
    }
  }
} 