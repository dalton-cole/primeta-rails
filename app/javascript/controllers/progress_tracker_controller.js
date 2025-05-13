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
    this.boundSubscribeToStream = this.subscribeToStream.bind(this);
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
  }
  
  connect() {
    console.log("Progress tracker controller connected with repository ID:", this.repositoryIdValue);
    
    // Listen for Turbo Stream broadcasts
    this.subscribeToStream();
    
    // Listen for file-view-recorded events
    document.addEventListener('file-view-recorded', this.boundHandleFileViewRecorded);
    
    // Listen for visibility changes to refresh when tab becomes active
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }
  
  subscribeToStream() {
    if (!this.repositoryIdValue) return;
    
    // Ensure Turbo Streams are available
    if (typeof Turbo === 'undefined' || !Turbo.cable) {
      console.warn("Turbo Streams not initialized - falling back to AJAX updates");
      return;
    }
    
    // Subscribe to repository_progress channel for this repository
    this.subscription = Turbo.subscribeTo(
      `repository_${this.repositoryIdValue}_progress`,
      {
        connected() {
          console.log("Connected to progress updates stream");
        },
        disconnected() {
          console.log("Disconnected from progress updates stream");
        },
        // The actual message handling is done automatically by Turbo
      }
    );
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
    
    // Unsubscribe from Turbo Streams
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  
  // Handle file view recorded event
  handleFileViewRecorded(event) {
    console.log('File view recorded event detected, requesting progress update');
    // Request progress update via Turbo Streams
    // this.requestProgressUpdate(); // Commented out to test backend push
  }
} 