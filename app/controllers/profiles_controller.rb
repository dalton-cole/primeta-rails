class ProfilesController < ApplicationController
  before_action :authenticate_user!, except: [:show]
  before_action :set_user, only: [:show]
  
  def show
    @user = User.find_by(id: params[:id]) || current_user
    
    # Get repositories that the user has actually interacted with
    viewed_file_ids = @user.file_views.pluck(:repository_file_id)
    viewed_repository_ids = RepositoryFile.where(id: viewed_file_ids).pluck(:repository_id).uniq
    @repositories = Repository.where(id: viewed_repository_ids)
    
    # Calculate statistics for each repository
    @repository_stats = {}
    
    @repositories.each do |repo|
      total_files = repo.repository_files.count
      viewed_files = @user.file_views.where(repository_file_id: repo.repository_files.pluck(:id)).count
      
      # Get key files from concepts
      key_concepts = repo.key_concepts
      key_file_paths = []
      key_concepts.each do |concept|
        key_file_paths.concat(concept.key_files) if concept.key_files.present?
      end
      key_file_paths.uniq!
      
      # Handle case where there are no key files
      total_key_files = key_file_paths.present? ? 
                        repo.repository_files.where(path: key_file_paths).count : 0
      
      viewed_key_files = key_file_paths.present? ? 
                         repo.repository_files
                           .where(path: key_file_paths)
                           .joins(:file_views)
                           .where(file_views: { user_id: @user.id })
                           .distinct
                           .count : 0
      
      total_time_spent = @user.file_views
        .where(repository_file_id: repo.repository_files.pluck(:id))
        .sum(:total_time_spent)
      
      formatted_time = view_context.format_time_spent(total_time_spent)
      
      @repository_stats[repo.id] = {
        total_files: total_files,
        viewed_files: viewed_files,
        total_key_files: total_key_files,
        viewed_key_files: viewed_key_files,
        total_time_spent: total_time_spent,
        formatted_time_spent: formatted_time,
        file_completion: total_files > 0 ? (viewed_files.to_f / total_files * 100).round : 0,
        key_file_completion: total_key_files > 0 ? (viewed_key_files.to_f / total_key_files * 100).round : 0
      }
    end
  end
  
  private
  
  def set_user
    @user = params[:id] ? User.find(params[:id]) : current_user
    redirect_to root_path, alert: "User not found" unless @user
  end
end 