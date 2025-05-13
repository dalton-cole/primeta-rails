class RepositoriesController < ApplicationController
  before_action :authenticate_user!, except: [:index]
  before_action :set_repository, only: [:show, :track_time, :sync, :progress, :extract_key_concepts, :analyze_concept, :key_files]
  before_action :require_admin, only: [:new, :create, :sync, :extract_key_concepts, :analyze_concept]

  def index
    @repositories = Repository.all
  end

  def show
    @key_concepts = @repository.key_concepts.order(:name)
    
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
    if current_user.present?
      @viewed_file_ids = current_user.file_views
                                   .joins(:repository_file)
                                   .where(repository_files: { repository_id: @repository.id })
                                   .pluck(:repository_file_id).to_set
    else
      @viewed_file_ids = Set.new
    end
    
    # For initial view, get the top-level structure
    @directory_level_structure = build_level_specific_directory_structure(@repository, "")
  end

  def key_files
    # @repository is set by before_action :set_repository
    @key_concepts = @repository.key_concepts.order(:name) # Or just load concepts if needed by fetch_key_files_from_concepts
    @key_files_from_concepts = fetch_key_files_from_concepts(@key_concepts)
    @viewed_file_ids = current_user.present? ? current_user.file_views
                              .joins(:repository_file)
                              .where(repository_files: { repository_id: @repository.id })
                              .pluck(:repository_file_id).to_set : Set.new
    # Ensure the layout is not rendered for this partial action
    render partial: 'repositories/key_files_list_content', locals: { 
      repository: @repository, 
      key_files_from_concepts: @key_files_from_concepts, 
      viewed_file_ids: @viewed_file_ids 
    }
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
    # calculate_progress will now use caching internally
    progress_data = progress_service.calculate_progress 
    
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          "repository_progress_#{@repository.id}",
          partial: "repositories/progress",
          locals: { repository: @repository }.merge(progress_data)
        )
      end
      
      # Keep JSON for backward compatibility (ensure it has what it needs)
      # If JSON consumers also need repository_id, progress_data already has it.
      format.json { render json: progress_data }
    end
  end

  # Return the contents of a directory for lazy loading (AJAX)
  def tree
    @repository = Repository.find(params[:id])
    requested_path = params[:path].to_s

    # Fetch and build structure for the current requested level only
    @directory_level_structure = build_level_specific_directory_structure(@repository, requested_path)
    
    # For the partial, we need to know which files the user has viewed among those being displayed
    # This can be optimized further if @directory_level_structure contains file objects or IDs
    # For now, let's assume the partial can handle this or we pass necessary file IDs.
    # If `build_level_specific_directory_structure` returns file objects or enough info,
    # this might not be needed or can be more targeted.
    # For simplicity, keeping a way to check viewed status, but this is broad:
    @viewed_file_ids = current_user.file_views
                                 .joins(:repository_file)
                                 .where(repository_files: { repository_id: @repository.id })
                                 .pluck(:repository_file_id).to_set

    level = params[:level].present? ? params[:level].to_i : 0 # Assuming root is level 0
    render partial: 'directory_tree_frame', locals: { 
                                              repository: @repository, # Pass repository for URLs/IDs
                                              tree_level_data: @directory_level_structure, 
                                              parent_path: requested_path, 
                                              level: level, 
                                              viewed_file_ids: @viewed_file_ids 
                                            }, layout: false
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

  # Build a nested hash representing one level of the directory structure
  def build_level_specific_directory_structure(repository, base_path)
    cache_key = "repository/#{repository.id}/tree_level/#{Digest::MD5.hexdigest(base_path)}" # Hash base_path if it can be very long
    Rails.cache.fetch(cache_key, expires_in: 1.hour) do
      structure = {}
      current_path_prefix = base_path.blank? ? "" : "#{base_path}/"
      # depth = base_path.blank? ? 1 : base_path.count('/') + 2 # Not actively used, can remove if confirmed

      # Fetch all paths that start with the current_path_prefix
      paths_under_prefix = repository.repository_files
                                  .where("path LIKE ?", "#{current_path_prefix}%")
                                  .pluck(:path)

      direct_children_names = Set.new
      paths_under_prefix.each do |full_path|
        relative_path = full_path.sub(current_path_prefix, '')
        next if relative_path.blank?

        first_part = relative_path.split('/').first
        direct_children_names.add(first_part) if first_part.present?
      end

      potential_file_paths = direct_children_names.map { |name| current_path_prefix + name }
      
      child_files_map = repository.repository_files
                                  .where(path: potential_file_paths)
                                  # .includes(:file_views) # Careful with caching complex objects; file_views might not be needed here
                                  .select(:id, :path, :is_key_file) # Select only necessary attributes for caching
                                  .index_by(&:path)

      direct_children_names.sort.each do |name|
        full_child_path = current_path_prefix + name
        is_directory = paths_under_prefix.any? { |p| p.start_with?("#{full_child_path}/") }

        if is_directory
          structure[name] = { type: :directory, path: full_child_path } 
        elsif (file_record = child_files_map[full_child_path])
          structure[name] = {
            type: :file,
            id: file_record.id,
            path: file_record.path,
            is_key_file: file_record.is_key_file || false
          }
        else
          Rails.logger.warn "Could not fully resolve child: #{name} under #{current_path_prefix} during cache population for key #{cache_key}"
        end
      end
      structure
    end # End Rails.cache.fetch
  end
end
