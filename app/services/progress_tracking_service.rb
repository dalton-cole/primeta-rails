class ProgressTrackingService
  attr_reader :repository, :user
  
  def initialize(repository, user)
    @repository = repository
    @user = user
  end
  
  def calculate_progress
    # Handle case when repository or user is nil
    return empty_progress_data unless repository.present? && user.present?
    
    # Load repository files and viewed files in bulk to avoid N+1 queries
    repository_files = repository.repository_files || []
    viewed_file_ids = if repository_files.present?
      user.file_views.where(repository_file_id: repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    else
      Set.new
    end
    
    # Get key file paths from concepts in a single pass
    key_file_paths = fetch_key_file_paths
    
    # Find key files in a single query
    key_files = key_file_paths.present? ? repository.repository_files.where(path: key_file_paths) : []
    
    # Calculate progress metrics
    total_files_count = repository_files.count
    viewed_files_count = viewed_file_ids.count
    files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
    
    key_files_count = key_files.count
    viewed_key_files_count = key_files.count { |file| viewed_file_ids.include?(file.id) }
    key_files_progress_percentage = key_files_count > 0 ? ((viewed_key_files_count.to_f / key_files_count) * 100).round(1) : 0
    
    {
      repository: repository,
      total_files_count: total_files_count,
      viewed_files_count: viewed_files_count,
      files_progress_percentage: files_progress_percentage,
      key_files_count: key_files_count,
      viewed_key_files_count: viewed_key_files_count,
      key_files_progress_percentage: key_files_progress_percentage
    }
  end
  
  def broadcast_progress_update
    progress_data = calculate_progress
    
    Turbo::StreamsChannel.broadcast_replace_to(
      "repository_#{repository.id}_progress",
      target: "repository_progress_#{repository.id}",
      partial: "repositories/progress",
      locals: progress_data
    )
    
    progress_data
  end
  
  private
  
  def empty_progress_data
    {
      repository: repository,
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