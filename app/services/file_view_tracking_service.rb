class FileViewTrackingService
  def initialize(user, repository_file)
    @user = user
    @repository_file = repository_file
    @repository = repository_file.repository
  end
  
  def record_view(time_spent = nil)
    file_view = @user.file_views.find_or_initialize_by(repository_file: @repository_file)
    
    # Initialize for new records
    if file_view.new_record?
      file_view.view_count = 0
      file_view.total_time_spent = 0
    end
    
    # Update the view count and timestamp
    file_view.view_count += 1
    file_view.last_viewed_at = Time.current
    
    # Add time spent if provided
    if time_spent.present? && time_spent.to_i > 0
      file_view.total_time_spent ||= 0
      file_view.total_time_spent += time_spent.to_i
    end
    
    success = file_view.save
    
    # Log information about the save operation
    if !success
      Rails.logger.error("Failed to save file_view: #{file_view.errors.full_messages.join(', ')}")
    end
    
    # The FileView model's after_commit callback will handle broadcasting progress updates.
    
    file_view
  end
end 