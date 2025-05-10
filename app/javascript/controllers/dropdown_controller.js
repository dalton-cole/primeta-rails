import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]
  
  connect() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeIfClickedOutside)
    
    // Close dropdown when pressing Escape
    document.addEventListener('keydown', this.handleKeydown)
    
    console.log("Dropdown controller connected")
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeIfClickedOutside)
    document.removeEventListener('keydown', this.handleKeydown)
  }
  
  toggle(event) {
    event.preventDefault()
    event.stopPropagation()
    this.menuTarget.classList.toggle('show')
    
    // For accessibility: focus first element when opened
    if (this.menuTarget.classList.contains('show')) {
      setTimeout(() => {
        const firstFocusable = this.menuTarget.querySelector('a, button')
        if (firstFocusable) firstFocusable.focus()
      }, 50)
    }
  }
  
  closeIfClickedOutside = (event) => {
    if (!this.element.contains(event.target) && this.menuTarget.classList.contains('show')) {
      this.menuTarget.classList.remove('show')
    }
  }
  
  handleKeydown = (event) => {
    if (event.key === 'Escape' && this.menuTarget.classList.contains('show')) {
      this.menuTarget.classList.remove('show')
    }
  }
} 