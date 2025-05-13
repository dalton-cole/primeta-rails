class ProgressTrackingService
  attr_reader :repository, :user
  
  def initialize(repository, user)
    @repository = repository
    @user = user
  end
  
  def calculate_progress
    # Handle case when repository or user is nil before hitting cache or calculations
    return empty_progress_data unless repository.present? && user.present?

    cache_key = "user/\#{user.id}/repository/\#{repository.id}/progress_data_v2" # Added _v2 for potential structure changes
    
    Rails.cache.fetch(cache_key, expires_in: 5.minutes) do
      # Load repository files and viewed files in bulk to avoid N+1 queries
      # repository_files_relation = repository.repository_files # Avoid loading all into memory unless needed
      viewed_file_ids = user.file_views
                            .joins(:repository_file)
                            .where(repository_files: { repository_id: repository.id })
                            .pluck(:repository_file_id).to_set
      
      # Get key file paths from concepts in a single pass
      key_file_paths = fetch_key_file_paths
      
      # Find key files in a single query
      key_files = key_file_paths.present? ? repository.repository_files.where(path: key_file_paths) : []
      
      # Calculate progress metrics
      # Use counter cache for total files count for efficiency
      total_files_count = repository.repository_files_count 
      viewed_files_count = viewed_file_ids.count
      files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
      
      key_files_count = key_files.count
      viewed_key_files_count = key_files.count { |file| viewed_file_ids.include?(file.id) }
      key_files_progress_percentage = key_files_count > 0 ? ((viewed_key_files_count.to_f / key_files_count) * 100).round(1) : 0
      
      {
        # repository: repository, # Avoid caching full AR objects if not strictly needed for the partial
        repository_id: repository.id, # Pass ID instead
        total_files_count: total_files_count,
        viewed_files_count: viewed_files_count,
        files_progress_percentage: files_progress_percentage,
        key_files_count: key_files_count,
        viewed_key_files_count: viewed_key_files_count,
        key_files_progress_percentage: key_files_progress_percentage
      }
    end
  end
  
  def broadcast_progress_update
    progress_data = calculate_progress
    
    # Broadcast to multiple channels based on context
    [
      "repository_#{@repository.id}",          # General repository stream
      "repository_#{@repository.id}_progress", # Specific progress stream
      "user_#{@user.id}"                       # User-specific stream
    ].each do |stream_name|
      Turbo::StreamsChannel.broadcast_replace_to(
        stream_name,
        target: "repository_progress_#{@repository.id}",
        partial: "repositories/progress",
        locals: { repository: @repository }.merge(progress_data)
      )
    end
    
    # Also broadcast a notification for new file view
    Turbo::StreamsChannel.broadcast_append_to(
      "repository_#{@repository.id}_notifications",
      target: "repository_notifications",
      partial: "shared/notification",
      locals: { 
        message: "Progress updated: #{progress_data[:files_progress_percentage]}% complete",
        type: "info",
        duration: 3000
      }
    )
    
    progress_data
  end
  
  private
  
  def empty_progress_data
    {
      repository_id: repository.id,
      total_files_count: 0,
      viewed_files_count: 0,
      files_progress_percentage: 0,
      key_files_count: 0,
      viewed_key_files_count: 0,
      key_files_progress_percentage: 0
    }
  end
  
  def fetch_key_file_paths
    # Handle case when repository is nil
    return [] unless repository.present?
    
    # Efficiently collect all key file paths from concepts
    key_concepts = repository.key_concepts.includes(:repository)
    
    # Handle case when key_concepts is nil
    return [] unless key_concepts.present?
    
    # Map and flatten in a single pass to avoid multiple iterations
    key_concepts.flat_map { |concept| concept.try(:key_files).presence || [] }.uniq
  end
end 