class ProfilesController < ApplicationController
  before_action :authenticate_user!, except: [:show]
  before_action :set_user, only: [:show]
  
  def show
    @repositories = Repository.joins(repository_files: { file_views: :user })
                              .where(file_views: { user_id: @user.id })
                              .distinct
    
    @repository_stats = {}
    @repositories.each do |repo|
      # Get total files in the repository
      total_files = repo.repository_files.count
      
      # Get total key files in the repository
      total_key_files = repo.repository_files.where(is_key_file: true).count
      
      # Get files viewed by user in this repository
      viewed_files = repo.repository_files
                         .joins(:file_views)
                         .where(file_views: { user_id: @user.id })
                         .distinct
                         .count
                         
      # Get key files viewed by user in this repository
      viewed_key_files = repo.repository_files
                             .where(is_key_file: true)
                             .joins(:file_views)
                             .where(file_views: { user_id: @user.id })
                             .distinct
                             .count
                             
      # Calculate total time spent on this repository
      total_time_spent = FileView.joins(:repository_file)
                                .where(user_id: @user.id, repository_files: { repository_id: repo.id })
                                .sum(:total_time_spent)
      
      # Store stats for this repository
      @repository_stats[repo.id] = {
        total_files: total_files,
        total_key_files: total_key_files,
        viewed_files: viewed_files,
        viewed_key_files: viewed_key_files,
        total_time_spent: total_time_spent,
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