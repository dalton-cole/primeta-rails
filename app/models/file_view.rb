class FileView < ApplicationRecord
  belongs_to :user
  belongs_to :repository_file
  belongs_to :repository, optional: true
  
  # Validations
  validates :view_count, numericality: { greater_than_or_equal_to: 0 }
  validates :total_time_spent, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  
  # Callbacks
  before_create :set_initial_values
  after_commit :broadcast_progress_update, on: [:create, :update]
  
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
end
