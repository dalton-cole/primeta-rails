class Repository < ApplicationRecord
  # Associations
  has_many :repository_files, dependent: :destroy
  
  # Constants
  STATUS_OPTIONS = %w[active syncing error].freeze
  
  # Validations
  validates :name, presence: true
  validates :git_url, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUS_OPTIONS }
  
  # Callbacks
  before_validation :set_default_values, on: :create
  
  # Instance Methods
  def sync_status
    "Last synced: #{last_synced_at&.strftime('%Y-%m-%d %H:%M:%S') || 'Never'} (#{status})"
  end
  
  def clone_url
    url || git_url
  end
  
  def file_count
    repository_files.count
  end
  
  private
  
  def set_default_values
    self.status ||= 'active'
    self.default_branch ||= 'main'
  end
end
