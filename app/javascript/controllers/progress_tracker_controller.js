import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["filesProgress", "filesValue", "filesPercentage", "keyFilesProgress", "keyFilesValue", "keyFilesPercentage"]
  static values = {
    repositoryId: Number,
    autoUpdateInterval: { type: Number, default: 30000 } // 30 seconds default
  }
  
  initialize() {
    // Create bound method references to avoid memory leaks
    this.boundHandleFileViewRecorded = this.handleFileViewRecorded.bind(this);
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
  }
  
  connect() {
    console.log("Progress tracker controller connected with repository ID:", this.repositoryIdValue);
    
    // Listen for Turbo Stream broadcasts - This will now be handled by Turbo automatically via turbo_stream_from
    
    // Listen for file-view-recorded events
    document.addEventListener('file-view-recorded', this.boundHandleFileViewRecorded);
    
    // Listen for visibility changes to refresh when tab becomes active
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }
  
  // Trigger a manual refresh when needed (like after file view)
  requestProgressUpdate() {
    if (!this.repositoryIdValue) return;
    
    fetch(`/repositories/${this.repositoryIdValue}/progress`, {
      headers: {
        Accept: "text/vnd.turbo-stream.html",
      }
    }).catch(error => {
      console.error('Error fetching progress updates:', error);
    });
  }
  
  handleVisibilityChange() {
    // Update when tab becomes visible again
    if (document.visibilityState === 'visible') {
      this.requestProgressUpdate();
    }
  }
  
  disconnect() {
    console.log("Progress tracker controller disconnected");
    
    // Clean up event listeners
    document.removeEventListener('file-view-recorded', this.boundHandleFileViewRecorded);
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }
  
  // Handle file view recorded event
  handleFileViewRecorded(event) {
    console.log('File view recorded event detected, requesting progress update');
    // Request progress update via Turbo Streams
  }
} 