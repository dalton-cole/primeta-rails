class RepositoriesController < ApplicationController
  before_action :authenticate_user!, except: [:index]
  before_action :set_repository, only: [:show, :track_time, :sync, :progress, :extract_key_concepts, :analyze_concept]
  before_action :require_admin, only: [:new, :create, :sync, :extract_key_concepts, :analyze_concept]

  def index
    @repositories = Repository.all
  end

  def show
    @repository = Repository.find(params[:id])
    @key_concepts = @repository.key_concepts.order(:name)
    
    # Load repository files with their file views
    @repository_files = @repository.repository_files.includes(:file_views)
    
    # Get all key files from key concepts
    @key_files_from_concepts = aggregate_key_files_from_concepts(@key_concepts)
    
    # Create a hash of file IDs that current user has viewed
    @viewed_file_ids = current_user.file_views.where(repository_file_id: @repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    
    # Calculate progress metrics
    @total_files_count = @repository_files.count
    @viewed_files_count = @viewed_file_ids.count
    @files_progress_percentage = @total_files_count > 0 ? ((@viewed_files_count.to_f / @total_files_count) * 100).round(1) : 0
    
    # Calculate new key files metrics based on concept key files
    @key_files_count = @key_files_from_concepts.count
    @viewed_key_files_count = @key_files_from_concepts.count { |file| @viewed_file_ids.include?(file.id) }
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
  
  # Extract key concepts for a repository
  def extract_key_concepts
    # First clear existing concepts to avoid duplicates
    @repository.key_concepts.destroy_all
    
    # Queue the extraction job
    ExtractKeyConceptsJob.perform_later(@repository.id)
    
    redirect_to @repository, notice: 'Key concept extraction started. This may take a few minutes.'
  end
  
  # Analyze a specific concept in the repository
  def analyze_concept
    concept_name = params[:concept_name]
    file_paths = params[:file_paths]
    
    if concept_name.blank?
      redirect_to @repository, alert: 'Please provide a concept name to analyze.'
      return
    end
    
    # Parse multiple concepts if comma-separated
    concepts = concept_name.split(',').map(&:strip).reject(&:blank?).uniq
    
    if concepts.empty?
      redirect_to @repository, alert: 'Please provide at least one valid concept name to analyze.'
      return
    end
    
    # Parse file paths if provided
    paths = nil
    if file_paths.present?
      paths = file_paths.split(',').map(&:strip).reject(&:blank?).uniq
    end
    
    # Queue the specific concept analysis job
    AnalyzeConceptJob.perform_later(@repository.id, concepts, paths)
    
    concept_message = concepts.size > 1 ? "concepts '#{concepts.join(', ')}'" : "concept '#{concepts.first}'"
    
    path_message = ""
    if paths.present?
      path_message = " in #{paths.size > 1 ? 'paths' : 'path'} '#{paths.join(', ')}'"
    end
    
    redirect_to @repository, notice: "Analysis of the #{concept_message}#{path_message} has started. This may take a few minutes."
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
    
    # Get key files from concepts
    key_concepts = @repository.key_concepts
    key_files_from_concepts = aggregate_key_files_from_concepts(key_concepts)
    
    # Create a hash of file IDs that current user has viewed
    viewed_file_ids = current_user.file_views.where(repository_file_id: repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    
    # Calculate progress metrics
    total_files_count = repository_files.count
    viewed_files_count = viewed_file_ids.count
    files_progress_percentage = total_files_count > 0 ? ((viewed_files_count.to_f / total_files_count) * 100).round(1) : 0
    
    key_files_count = key_files_from_concepts.count
    viewed_key_files_count = key_files_from_concepts.count { |file| viewed_file_ids.include?(file.id) }
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
  
  # Aggregate all unique key files from key concepts
  def aggregate_key_files_from_concepts(key_concepts)
    # Get all file paths from key concepts
    all_key_file_paths = []
    key_concepts.each do |concept|
      all_key_file_paths.concat(concept.key_files) if concept.key_files.present?
    end
    
    # Remove duplicates
    unique_file_paths = all_key_file_paths.uniq
    
    # Find matching repository files
    @repository.repository_files.where(path: unique_file_paths)
  end
end
