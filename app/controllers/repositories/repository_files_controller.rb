class Repositories::RepositoryFilesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_repository

  def index
    @repository_files = @repository.repository_files.order(:path)
    
    # Filter by directory if provided
    if params[:directory].present?
      directory = params[:directory].to_s
      @repository_files = @repository_files.where("path LIKE ?", "#{directory}/%")
    end
    
    # Get unique directories at the current level
    all_paths = @repository.repository_files.pluck(:path)
    @directories = extract_directories(all_paths, params[:directory])
  end
  
  private
  
  def set_repository
    @repository = Repository.find(params[:repository_id])
  end
  
  def extract_directories(paths, current_directory = nil)
    # Initialize base directory
    base = current_directory.present? ? "#{current_directory}/" : ""
    
    # Extract directories at the current level
    directories = paths.select { |p| p.start_with?(base) }
                        .map { |p| p.sub(base, "") }
                        .map { |p| p.split("/").first }
                        .reject(&:blank?)
                        .uniq
                        .select { |d| paths.any? { |p| p.start_with?("#{base}#{d}/") } }
    
    directories.sort
  end
end
