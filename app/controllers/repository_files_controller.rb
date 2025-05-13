class RepositoryFilesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_repository_file, except: [:track_time]
  before_action :set_repository_file_for_tracking, only: [:track_time]

  def show
    # Record file view
    @file_view = record_file_view
    
    # Prepare file content for Monaco Editor
    @language = @repository_file.language || 'plaintext'
    @content = @repository_file.content || ''
  end
  
  # Return file content as JSON
  def content
    # Record file view
    @file_view = record_file_view
    
    # Prepare file data for Monaco Editor
    language = @repository_file.language || 'plaintext'
    content = @repository_file.content || ''
    
    # Check if this file is mentioned in any key concepts
    is_concept_key_file = concept_file?(@repository_file)
    
    render json: {
      id: @repository_file.id,
      path: @repository_file.path,
      language: language,
      content: content,
      is_concept_key_file: is_concept_key_file,
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
    
    tracking_service = FileViewTrackingService.new(current_user, @repository_file)
    file_view = tracking_service.record_view(time_spent)
    
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
  
  def mark_viewed
    @repository_file = RepositoryFile.find(params[:id])
    
    # Record the view in FileView if not already viewed
    unless FileView.exists?(user: current_user, repository_file: @repository_file)
      FileView.create(
        user: current_user,
        repository_file: @repository_file,
        repository: @repository_file.repository,
        view_count: 1,
        last_viewed_at: Time.current
      )
    end
    
    # Set @repository for the view templates
    @repository = @repository_file.repository
    
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          "file_#{@repository_file.id}_status", 
          partial: "repositories/key_file_item", 
          locals: { file: @repository_file, viewed: true }
        )
      end
      format.json { head :ok }
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
  
  # Check if the file is mentioned in any key concepts
  def concept_file?(file)
    key_concepts = file.repository.key_concepts
    key_file_paths = []
    key_concepts.each do |concept|
      key_file_paths.concat(concept.key_files) if concept.key_files.present?
    end
    key_file_paths.uniq.include?(file.path)
  end
  
  def record_file_view
    tracking_service = FileViewTrackingService.new(current_user, @repository_file)
    time_spent = params[:time_spent].to_i if params[:time_spent].present?
    tracking_service.record_view(time_spent)
  end
end
