class RepositoriesController < ApplicationController
  before_action :authenticate_user!, except: [:index]
  before_action :set_repository, only: [:show, :track_time, :sync, :progress]
  before_action :require_admin, only: [:new, :create, :sync]

  def index
    @repositories = Repository.all
  end

  def show
    @repository = Repository.find(params[:id])
    
    # Load repository files with their file views
    @repository_files = @repository.repository_files.includes(:file_views)
    
    # Get key files for the repository
    @key_files = @repository.repository_files.where(is_key_file: true).order(:path)
    
    # Create a hash of file IDs that current user has viewed
    @viewed_file_ids = current_user.file_views.where(repository_file_id: @repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    
    # Calculate progress metrics
    @total_files_count = @repository_files.count
    @viewed_files_count = @viewed_file_ids.count
    @files_progress_percentage = @total_files_count > 0 ? ((@viewed_files_count.to_f / @total_files_count) * 100).round(1) : 0
    
    @key_files_count = @key_files.count
    @viewed_key_files_count = @key_files.count { |file| @viewed_file_ids.include?(file.id) }
    @key_files_progress_percentage = @key_files_count > 0 ? ((@viewed_key_files_count.to_f / @key_files_count) * 100).round(1) : 0
    
    @directory_structure = build_directory_structure(@repository_files)
  end

  def new
    @repository = Repository.new
  end

  def create
    @repository = Repository.new(repository_params)

    if @repository.save
      # Queue background job to sync repository
      RepositorySyncJob.perform_later(@repository.id)
      
      redirect_to @repository, notice: 'Repository was successfully added. Syncing in progress...'
    else
      render :new, status: :unprocessable_entity
    end
  end
  
  # Manually trigger a repository sync
  def sync
    RepositorySyncJob.perform_later(@repository.id)
    redirect_to @repository, notice: 'Repository sync started. This may take a few minutes.'
  end
  
  # Track time spent on repository
  def track_time
    time_spent = params[:time_spent].to_i
    
    # More detailed logging
    Rails.logger.info("=== TRACKING REPOSITORY TIME ===")
    Rails.logger.info("User #{current_user.id} spent #{time_spent} seconds on repository #{@repository.id}")
    Rails.logger.info("Params received: #{params.inspect}")
    
    # Return a 204 No Content status
    head :no_content
  end

  # Return progress data as JSON for real-time updates
  def progress
    # Get repository files with their file views
    repository_files = @repository.repository_files.includes(:file_views)
    
    # Get key files for the repository
    key_files = @repository.repository_files.where(is_key_file: true).order(:path)
    
    # Create a hash of file IDs that current user has viewed
    viewed_file_ids = current_user.file_views.where(repository_file_id: repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    
    # Calculate progress metrics
    total_files_count = repository_files.count
    viewed_files_count = viewed_file_ids.count
    files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
    
    key_files_count = key_files.count
    viewed_key_files_count = key_files.count { |file| viewed_file_ids.include?(file.id) }
    key_files_progress_percentage = key_files_count > 0 ? ((viewed_key_files_count.to_f / key_files_count) * 100).round(1) : 0
    
    render json: {
      total_files_count: total_files_count,
      viewed_files_count: viewed_files_count,
      files_progress_percentage: files_progress_percentage,
      key_files_count: key_files_count,
      viewed_key_files_count: viewed_key_files_count,
      key_files_progress_percentage: key_files_progress_percentage
    }
  end

  private
  
  def set_repository
    @repository = Repository.find(params[:id])
  end

  def repository_params
    params.require(:repository).permit(:name, :url, :description, :git_url)
  end
  
  def require_admin
    unless current_user.admin?
      redirect_to repositories_path, alert: 'Only administrators can manage repositories.'
    end
  end
  
  # Build a nested hash representing the directory structure
  def build_directory_structure(repository)
    structure = {}
    
    repository.order(:path).each do |file|
      path_parts = file.path.split('/')
      current_level = structure
      
      # Navigate through directories
      path_parts[0...-1].each do |dir_name|
        current_level[dir_name] ||= {}
        current_level = current_level[dir_name]
      end
      
      # Add the file to the current directory level
      file_name = path_parts.last
      current_level[file_name] = { file_id: file.id, is_key_file: file.is_key_file }
    end
    
    structure
  end
end
