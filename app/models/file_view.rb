class FileView < ApplicationRecord
  belongs_to :user
  belongs_to :repository_file
  belongs_to :repository, optional: true
  
  # Validations
  validates :view_count, numericality: { greater_than_or_equal_to: 0 }
  validates :total_time_spent, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :user_id, uniqueness: { scope: :repository_file_id, message: "has already viewed this file" }
  
  # Callbacks
  before_create :set_initial_values
  after_commit :broadcast_progress_update, on: [:create, :update]
  after_create :increment_view_count
  after_create :broadcast_progress
  after_destroy :decrement_view_count
  after_destroy :broadcast_progress_on_destroy
  after_save :bust_progress_cache
  after_destroy :bust_progress_cache
  
  # Instance Methods
  def record_view(time_spent = nil)
    # Initialize view_count to 0 if nil
    self.view_count ||= 0
    self.view_count += 1
    self.last_viewed_at = Time.current
    
    if time_spent.present? && time_spent.to_i > 0
      self.total_time_spent ||= 0
      self.total_time_spent += time_spent.to_i
    end
    
    save
  end
  
  def formatted_time_spent
    return 'Not tracked' if total_time_spent.blank?
    
    minutes = total_time_spent / 60
    seconds = total_time_spent % 60
    
    if minutes > 60
      hours = minutes / 60
      minutes = minutes % 60
      "#{hours}h #{minutes}m #{seconds}s"
    elsif minutes > 0
      "#{minutes}m #{seconds}s"
    else
      "#{seconds}s"
    end
  end
  
  # Broadcasts the file view update to relevant Turbo Streams
  def broadcast_file_status_update
    # Get the repository file's repository
    repo = repository_file.repository
    
    # Update the file status in the UI
    Turbo::StreamsChannel.broadcast_replace_to(
      "repository_#{repo.id}",
      target: "file_#{repository_file.id}_status",
      partial: "repositories/key_file_item",
      locals: { file: repository_file, viewed: true }
    )
  end
  
  def self.viewed_by_user_for_repository(user, repository)
    # Implementation of the method
  end
  
  private
  
  def set_initial_values
    self.view_count ||= 0
    self.last_viewed_at ||= Time.current
    # Ensure repository is set properly
    self.repository ||= repository_file&.repository
  end
  
  def broadcast_progress_update
    Rails.logger.info "[FileView] Attempting broadcast_progress_update for FileView ID: #{id}"
    unless repository_file&.repository.present?
      Rails.logger.warn "[FileView] Aborting broadcast: repository_file or repository not present. File: #{repository_file&.id}, Repo: #{repository_file&.repository&.id}"
      return
    end
    
    Rails.logger.info "[FileView] Repository present (ID: #{repository_file.repository.id}), proceeding to call ProgressTrackingService."
    
    # Get the repository
    repo = repository_file.repository
    
    # Create a progress tracking service
    progress_service = ProgressTrackingService.new(repo, user)
    
    # Broadcast the updated progress to appropriate channels
    progress_service.broadcast_progress_update
  end
  
  def increment_view_count
    # Implementation of the method
  end
  
  def decrement_view_count
    # Implementation of the method
  end
  
  def broadcast_progress
    # Ensure repository and user are available, similar to ProgressTrackingService
    if repository_file&.repository && user
      ProgressTrackingService.new(repository_file.repository, user).broadcast_progress_update
    else
      Rails.logger.warn "[FileView broadcast_progress] Skipping broadcast due to missing repository or user. FileView ID: #{id}"
    end
  end
  
  def broadcast_progress_on_destroy
    # For destroy, we need to access associated objects before they are gone or use IDs
    # Assuming repository_file and user are still accessible or their IDs are stored if needed
    # This example assumes they are accessible for simplicity; adjust if using_deleted_identity or similar
    if repository_file&.repository && user 
      ProgressTrackingService.new(repository_file.repository, user).broadcast_progress_update
    else
      # Log with caution as associated objects might be nil
      Rails.logger.warn "[FileView broadcast_progress_on_destroy] Skipping broadcast, repository or user might be nil. FileView ID: #{id}"
    end
  end
  
  def bust_progress_cache
    if user_id.present? && repository_file&.repository_id.present?
      cache_key = "user/#{user_id}/repository/#{repository_file.repository_id}/progress_data_v2"
      deleted_successfully = Rails.cache.delete(cache_key)
      Rails.logger.info "[FileView bust_progress_cache] Attempted to bust cache for key: #{cache_key}. Success: #{deleted_successfully}"
    else
      Rails.logger.warn "[FileView bust_progress_cache] Could not bust cache due to missing user_id or repository_id. FileView ID: #{id}"
    end
  end
end
