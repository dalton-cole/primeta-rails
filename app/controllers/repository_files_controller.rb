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
  end
end
