import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["filesProgress", "filesValue", "filesPercentage", "keyFilesProgress", "keyFilesValue", "keyFilesPercentage"]
  static values = {
    repositoryId: Number
  }
  
  connect() {
    console.log("Progress tracker controller connected");
    console.log("Targets found:", {
      filesProgress: this.hasFilesProgressTarget,
      filesValue: this.hasFilesValueTarget,
      filesPercentage: this.hasFilesPercentageTarget,
      keyFilesProgress: this.hasKeyFilesProgressTarget,
      keyFilesValue: this.hasKeyFilesValueTarget,
      keyFilesPercentage: this.hasKeyFilesPercentageTarget
    });
    
    // Listen for file-view-recorded events
    if (this.repositoryIdValue) {
      this.element.addEventListener('file-view-recorded', this.handleFileViewRecorded.bind(this));
    }
  }
  
  disconnect() {
    console.log("Progress tracker controller disconnected");
    // Remove event listener
    this.element.removeEventListener('file-view-recorded', this.handleFileViewRecorded.bind(this));
  }
  
  // Fetch progress updates from the server
  async fetchProgressUpdate() {
    try {
      const response = await fetch(`/repositories/${this.repositoryIdValue}/progress`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      this.updateProgress(data);
    } catch (error) {
      console.error('Error fetching progress updates:', error);
    }
  }
  
  // Update the progress UI with new data
  updateProgress(data) {
    console.log("Updating progress with data:", data);
    console.log("Targets available:", {
      filesProgress: this.hasFilesProgressTarget,
      filesValue: this.hasFilesValueTarget,
      filesPercentage: this.hasFilesPercentageTarget,
      keyFilesProgress: this.hasKeyFilesProgressTarget,
      keyFilesValue: this.hasKeyFilesValueTarget,
      keyFilesPercentage: this.hasKeyFilesPercentageTarget
    });
    
    // Update files progress
    if (this.hasFilesProgressTarget && data.files_progress_percentage !== undefined) {
      this.filesProgressTarget.style.width = `${data.files_progress_percentage}%`;
    }
    
    if (this.hasFilesValueTarget && data.viewed_files_count !== undefined) {
      this.filesValueTarget.textContent = `${data.viewed_files_count} / ${data.total_files_count}`;
    }
    
    if (this.hasFilesPercentageTarget && data.files_progress_percentage !== undefined) {
      this.filesPercentageTarget.textContent = `${data.files_progress_percentage}%`;
    }
    
    // Update key files progress if applicable
    if (data.key_files_count > 0) {
      if (this.hasKeyFilesProgressTarget && data.key_files_progress_percentage !== undefined) {
        this.keyFilesProgressTarget.style.width = `${data.key_files_progress_percentage}%`;
      }
      
      if (this.hasKeyFilesValueTarget && data.viewed_key_files_count !== undefined) {
        this.keyFilesValueTarget.textContent = `${data.viewed_key_files_count} / ${data.key_files_count}`;
      }
      
      if (this.hasKeyFilesPercentageTarget && data.key_files_progress_percentage !== undefined) {
        this.keyFilesPercentageTarget.textContent = `${data.key_files_progress_percentage}%`;
      }
    }
  }
  
  // Handle file view recorded event
  handleFileViewRecorded(event) {
    console.log('File view recorded event detected, updating progress');
    // Fetch updated progress when a file view is recorded
    this.fetchProgressUpdate();
  }
} 