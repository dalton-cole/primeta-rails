import { Controller } from "@hotwired/stimulus";

// Notification controller for handling toast notifications
export default class extends Controller {
  static values = {
    duration: { type: Number, default: 5000 },
    id: String
  }
  
  connect() {
    // Animation - fade in
    setTimeout(() => {
      this.element.style.opacity = "1";
    }, 10);
    
    // Auto dismiss if duration is set
    if (this.durationValue > 0) {
      this.autoDismissTimeout = setTimeout(() => {
        this.dismiss();
      }, this.durationValue);
    }
  }
  
  disconnect() {
    // Clear timeout if controller is disconnected
    if (this.autoDismissTimeout) {
      clearTimeout(this.autoDismissTimeout);
    }
  }
  
  // Manually dismiss the notification
  dismiss() {
    // Clear the auto dismiss timeout
    if (this.autoDismissTimeout) {
      clearTimeout(this.autoDismissTimeout);
    }
    
    // Fade out animation
    this.element.style.opacity = "0";
    this.element.style.transform = "translateX(10px)";
    
    // Remove after animation completes
    setTimeout(() => {
      this.element.remove();
    }, 300);
  }
} 