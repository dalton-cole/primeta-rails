import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]
  
  connect() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.closeIfClickedOutside)
  }
  
  disconnect() {
    document.removeEventListener('click', this.closeIfClickedOutside)
  }
  
  toggle(event) {
    event.stopPropagation()
    this.menuTarget.classList.toggle('show')
  }
  
  closeIfClickedOutside = (event) => {
    if (!this.element.contains(event.target) && this.menuTarget.classList.contains('show')) {
      this.menuTarget.classList.remove('show')
    }
  }
} 