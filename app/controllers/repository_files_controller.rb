class RepositoryFilesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_repository_file, except: [:track_time]
  before_action :set_repository_file_for_tracking, only: [:track_time]

  def show
    # Record file view
    record_file_view
    
    # Prepare file content for Monaco Editor
    @language = @repository_file.language || 'plaintext'
    @content = @repository_file.content || ''
  end
  
  # Return file content as JSON
  def content
    # Record file view
    record_file_view
    
    # Prepare file data for Monaco Editor
    language = @repository_file.language || 'plaintext'
    content = @repository_file.content || ''
    
    render json: {
      id: @repository_file.id,
      path: @repository_file.path,
      language: language,
      content: content,
      is_key_file: @repository_file.is_key_file,
      file_view: {
        view_count: @file_view.view_count,
        total_time_spent: @file_view.total_time_spent,
        formatted_time_spent: @file_view.respond_to?(:formatted_time_spent) ? @file_view.formatted_time_spent : "0 minutes",
        last_viewed_at: @file_view.last_viewed_at&.strftime("%B %d, %Y at %H:%M") || "Just now"
      }
    }
  end
  
  # Track time spent on repository file
  def track_time
    time_spent = params[:time_spent].to_i
    
    # More detailed logging
    Rails.logger.info("=== TRACKING TIME ===")
    Rails.logger.info("User #{current_user.id} spent #{time_spent} seconds on file #{@repository_file.id}")
    
    if time_spent <= 0
      Rails.logger.warn("Invalid time_spent value: #{time_spent}")
      return head :bad_request
    end
    
    # Find or initialize file view record
    file_view = current_user.file_views.find_or_initialize_by(repository_file: @repository_file)
    
    # Log before updating
    Rails.logger.info("Before update: view_count=#{file_view.view_count}, total_time_spent=#{file_view.total_time_spent}")
    
    # Initialize for new records
    if file_view.new_record?
      file_view.view_count = 0
      file_view.total_time_spent = 0
      Rails.logger.info("New record initialized")
    end
    
    # Update the total time spent
    original_time = file_view.total_time_spent || 0
    file_view.total_time_spent ||= 0
    file_view.total_time_spent += time_spent
    
    # Save and log the result
    success = file_view.save
    Rails.logger.info("Save successful: #{success}")
    Rails.logger.info("After update: total_time_spent from #{original_time} to #{file_view.total_time_spent}")
    
    if !success
      Rails.logger.error("Failed to save file_view: #{file_view.errors.full_messages.join(', ')}")
      return head :internal_server_error
    end
    
    # Broadcast progress update via Turbo Streams
    if success
      repository = @repository_file.repository
      repository_files = repository.repository_files.includes(:file_views)
      key_files = repository.repository_files.where(is_key_file: true)
      viewed_file_ids = current_user.file_views.where(repository_file_id: repository_files.pluck(:id)).pluck(:repository_file_id).to_set
      
      # Calculate progress metrics
      total_files_count = repository_files.count
      viewed_files_count = viewed_file_ids.count
      files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
      
      key_files_count = key_files.count
      viewed_key_files_count = key_files.count { |file| viewed_file_ids.include?(file.id) }
      key_files_progress_percentage = key_files_count > 0 ? ((viewed_key_files_count.to_f / key_files_count) * 100).round(1) : 0
      
      # Broadcast the progress update
      Turbo::StreamsChannel.broadcast_replace_to(
        "repository_#{repository.id}_progress",
        target: "repository_progress_#{repository.id}",
        partial: "repositories/progress",
        locals: {
          repository: repository,
          total_files_count: total_files_count,
          viewed_files_count: viewed_files_count,
          files_progress_percentage: files_progress_percentage,
          key_files_count: key_files_count,
          viewed_key_files_count: viewed_key_files_count,
          key_files_progress_percentage: key_files_progress_percentage
        }
      )
    end
    
    # Return updated stats as JSON
    render json: {
      status: 'success',
      file_view: {
        view_count: file_view.view_count,
        total_time_spent: file_view.total_time_spent,
        formatted_time_spent: file_view.formatted_time_spent,
        last_viewed_at: file_view.last_viewed_at&.strftime("%B %d, %Y at %H:%M") || "Just now"
      }
    }
  end
  
  def toggle_key_file
    # Only allow admins to toggle key file status
    if current_user.admin?
      @repository_file.update(is_key_file: params[:is_key_file])
      render json: { success: true, is_key_file: @repository_file.is_key_file }
    else
      render json: { success: false, error: 'Unauthorized' }, status: :unauthorized
    end
  end
  
  private
  
  def set_repository_file
    @repository_file = RepositoryFile.find(params[:id])
    @repository = @repository_file.repository
  end
  
  def set_repository_file_for_tracking
    @repository_file = RepositoryFile.find(params[:repository_file_id] || params[:id])
    @repository = @repository_file.repository
  end
  
  def record_file_view
    # Find existing file view or create a new one
    @file_view = current_user.file_views.find_or_initialize_by(repository_file: @repository_file)
    
    # Initialize view_count for new records
    if @file_view.new_record?
      @file_view.view_count = 0
      @file_view.total_time_spent = 0
    end
    
    # Record time spent if provided
    time_spent = params[:time_spent].to_i if params[:time_spent].present?
    
    # Update file view
    @file_view.record_view(time_spent)
    
    # Broadcast progress update via Turbo Streams after the view is recorded
    repository = @repository_file.repository
    repository_files = repository.repository_files.includes(:file_views)
    key_files = repository.repository_files.where(is_key_file: true)
    viewed_file_ids = current_user.file_views.where(repository_file_id: repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    
    # Calculate progress metrics
    total_files_count = repository_files.count
    viewed_files_count = viewed_file_ids.count
    files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
    
    key_files_count = key_files.count
    viewed_key_files_count = key_files.count { |file| viewed_file_ids.include?(file.id) }
    key_files_progress_percentage = key_files_count > 0 ? ((viewed_key_files_count.to_f / key_files_count) * 100).round(1) : 0
    
    # Broadcast the progress update
    Turbo::StreamsChannel.broadcast_replace_to(
      "repository_#{repository.id}_progress",
      target: "repository_progress_#{repository.id}",
      partial: "repositories/progress",
      locals: {
        repository: repository,
        total_files_count: total_files_count,
        viewed_files_count: viewed_files_count,
        files_progress_percentage: files_progress_percentage,
        key_files_count: key_files_count,
        viewed_key_files_count: viewed_key_files_count,
        key_files_progress_percentage: key_files_progress_percentage
      }
    )
  end
end
