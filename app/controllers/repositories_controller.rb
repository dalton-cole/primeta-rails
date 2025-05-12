class RepositoriesController < ApplicationController
  before_action :authenticate_user!, except: [:index]
  before_action :set_repository, only: [:show, :track_time, :sync, :progress, :extract_key_concepts, :analyze_concept]
  before_action :require_admin, only: [:new, :create, :sync, :extract_key_concepts, :analyze_concept]

  def index
    @repositories = Repository.all
  end

  def show
    @key_concepts = @repository.key_concepts.order(:name)
    
    # Load repository files with eager loading to avoid N+1 queries
    @repository_files = @repository.repository_files.includes(:file_views)
    
    # Get all key files from key concepts
    @key_files_from_concepts = fetch_key_files_from_concepts(@key_concepts)
    
    # Use the ProgressTrackingService for calculating progress
    progress_service = ProgressTrackingService.new(@repository, current_user)
    progress_data = progress_service.calculate_progress
    
    # Extract progress data into instance variables
    @total_files_count = progress_data[:total_files_count]
    @viewed_files_count = progress_data[:viewed_files_count]
    @files_progress_percentage = progress_data[:files_progress_percentage]
    @key_files_count = progress_data[:key_files_count]
    @viewed_key_files_count = progress_data[:viewed_key_files_count]
    @key_files_progress_percentage = progress_data[:key_files_progress_percentage]
    
    # Create a hash of file IDs that current user has viewed - with an empty set as fallback
    if @repository_files.present? && current_user.present?
      @viewed_file_ids = current_user.file_views.where(repository_file_id: @repository_files.pluck(:id)).pluck(:repository_file_id).to_set
    else
      @viewed_file_ids = Set.new
    end
    
    @directory_structure = build_directory_structure(@repository_files || [])
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
    progress_service = ProgressTrackingService.new(@repository, current_user)
    render json: progress_service.calculate_progress
  end

  # Return the contents of a directory for lazy loading (AJAX)
  def tree
    @repository = Repository.find(params[:id])
    @repository_files = @repository.repository_files.includes(:file_views)
    @viewed_file_ids = current_user.file_views.where(repository_file_id: @repository_files.pluck(:id)).pluck(:repository_file_id).to_set

    # Get the requested path (empty string means root)
    path = params[:path].to_s

    # Build a directory structure for just the requested path
    structure = build_directory_structure(@repository_files)
    tree = path.blank? ? structure : path.split('/').reduce(structure) { |acc, part| acc[part] if acc }
    tree ||= {}

    # Render the directory_tree partial inside a Turbo Frame
    level = params[:level].present? ? params[:level].to_i : 1
    render partial: 'directory_tree_frame', locals: { tree: tree, parent_path: path, level: level }, layout: false
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
  
  # Aggregate all unique key files from key concepts
  def fetch_key_files_from_concepts(key_concepts)
    # Return empty array if no key concepts
    return [] if key_concepts.blank?
    
    # Get all file paths from key concepts
    key_file_paths = key_concepts.flat_map { |concept| concept.key_files.presence || [] }.uniq
    
    # Return empty array if no key file paths
    return [] if key_file_paths.blank?
    
    # Find matching repository files
    @repository.repository_files.where(path: key_file_paths)
  end
  
  # Build a nested hash representing the directory structure
  def build_directory_structure(repository_files)
    structure = {}
    
    # Return empty structure if repository_files is nil or empty
    return structure if repository_files.blank?
    
    # Cache the files to avoid multiple queries
    files = repository_files.to_a
    
    files.sort_by(&:path).each do |file|
      next unless file.path.present?
      
      path_parts = file.path.split('/')
      current_level = structure
      
      # Navigate through directories
      path_parts[0...-1].each do |dir_name|
        current_level[dir_name] ||= {}
        current_level = current_level[dir_name]
      end
      
      # Add the file to the current directory level
      file_name = path_parts.last
      current_level[file_name] = { 
        file_id: file.id, 
        is_key_file: file.try(:is_key_file) || false 
      }
    end
    
    structure
  end
end
