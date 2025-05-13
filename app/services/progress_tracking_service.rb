class ProgressTrackingService
  attr_reader :repository, :user
  
  def initialize(repository, user)
    @repository = repository
    @user = user
  end
  
  def calculate_progress
    Rails.logger.info "[ProgressTrackingService] Attempting calculate_progress for Repo ID: #{@repository&.id}, User ID: #{@user&.id}"
    # Handle case when repository or user is nil before hitting cache or calculations
    unless repository.present? && user.present?
      Rails.logger.warn "[ProgressTrackingService] Aborting calculate_progress: repository or user not present. Repo: #{@repository&.id}, User: #{@user&.id}"
      return empty_progress_data
    end

    Rails.logger.info "[ProgressTrackingService] Repository and User present, proceeding with calculation."
    cache_key = "user/#{@user.id}/repository/#{@repository.id}/progress_data_v2" # Added _v2 for potential structure changes
    
    Rails.cache.fetch(cache_key, expires_in: 5.minutes) do
      # Load repository files and viewed files in bulk to avoid N+1 queries
      viewed_file_ids_for_repo = user.file_views
                            .joins(:repository_file)
                            .where(repository_files: { repository_id: repository.id })
                            .pluck(:repository_file_id).to_set
      
      # Get the cached set of all key file IDs for the repository
      all_key_file_ids_for_repo = repository.key_file_ids_set
      
      # Calculate progress metrics
      total_files_count = repository.repository_files_count 
      viewed_files_count = viewed_file_ids_for_repo.count # Total files viewed by user in this repo
      files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
      
      key_files_count = all_key_file_ids_for_repo.count
      # Viewed key files are the intersection of all key files in repo and files viewed by user in this repo
      viewed_key_files_count = (all_key_file_ids_for_repo & viewed_file_ids_for_repo).count
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
    # This method is no longer directly used by calculate_progress for determining key files count or viewed key files.
    # It might still be used by other parts of the codebase if they need the actual paths.
    # For calculate_progress, we now rely on repository.key_file_ids_set.
    
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