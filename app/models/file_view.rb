class FileView < ApplicationRecord
  belongs_to :user
  belongs_to :repository_file
  
  # Validations
  validates :view_count, numericality: { greater_than_or_equal_to: 0 }
  validates :total_time_spent, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  
  # Callbacks
  before_create :set_initial_values
  
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
  
  private
  
  def set_initial_values
    self.view_count ||= 0
    self.last_viewed_at ||= Time.current
  end
end
