import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    // Check if authentication is required for this element
    if (this.element.dataset.requireAuth === "true") {
      // Add click event listener to handle redirect
      this.element.addEventListener("click", this.handleAuthRedirect.bind(this))
    }
  }
  
  handleAuthRedirect(event) {
    event.preventDefault()
    
    // Get the redirect path from data attribute
    const redirectPath = this.element.dataset.redirect || "/"
    
    // Add a flash message parameter to the redirect
    const redirectUrl = new URL(redirectPath, window.location.origin)
    redirectUrl.searchParams.append("auth_message", "Please sign in to access this repository")
    
    // Redirect to the landing page with the message
    window.location.href = redirectUrl.toString()
  }
  
  disconnect() {
    // Clean up event listener when controller is disconnected
    if (this.element.dataset.requireAuth === "true") {
      this.element.removeEventListener("click", this.handleAuthRedirect.bind(this))
    }
  }
} 