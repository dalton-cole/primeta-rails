class Repository < ApplicationRecord
  # Include concerns
  include GithubRepositoryIntegration
  
  # Associations
  has_many :repository_files, dependent: :destroy, counter_cache: true
  has_many :key_concepts, dependent: :destroy, counter_cache: true
  
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
    # Use the counter cache if available, otherwise perform a count
    repository_files_count.to_i > 0 ? repository_files_count : repository_files.count
  end
  
  def explorer_count
    Rails.cache.fetch("repository/#{id}/explorer_count", expires_in: 15.minutes) do
      # Find all users who have viewed any file in this repository
      User.joins(file_views: :repository_file)
          .where(repository_files: { repository_id: id })
          .distinct
          .count
    end
  end
  
  # Repository statistics
  def language_stats
    Rails.cache.fetch("repository/#{id}/language_stats", expires_in: 1.hour) do
      stats = repository_files
        .where.not(language: [nil, '', 'plaintext'])
        .group(:language)
        .count
        .sort_by { |_, count| -count }
        .take(3)
        
      # Return empty array if no language stats found
      return [] if stats.empty?
      
      # For percentage of total *relevant* files (those with language):
      total_relevant_files = repository_files.where.not(language: [nil, '', 'plaintext']).count
      return [] if total_relevant_files == 0 # Avoid division by zero if no files have language
      
      stats.map do |language, count|
        {
          language: language,
          count: count,
          percentage: ((count.to_f / total_relevant_files) * 100).round
        }
      end
    end
  end
  
  def primary_language
    languages = language_stats
    languages.first[:language] if languages.any?
  end
  
  def total_lines_of_code
    # Use the pre-calculated lines_of_code from repository_files
    repository_files.sum(:lines_of_code)
  end
  
  def total_size_in_bytes
    count = repository_files.count
    return 0 if count == 0
    
    # Get the sum of all file sizes
    total_size = repository_files.sum(:size)
    total_size
  end
  
  def quick_stats
    {
      total_files: file_count,
      total_lines: total_lines_of_code,
      explorers: explorer_count,
      languages: language_stats
    }
  end
  
  # Commit Hash Methods
  def short_commit_hash
    current_commit_hash.present? ? current_commit_hash[0..6] : nil
  end
  
  def commit_hash_url
    return nil unless github_url && current_commit_hash
    "#{github_url}/commit/#{current_commit_hash}"
  end
  
  # GitHub related methods
  def github_repo?
    git_url.present? && git_url.include?('github.com')
  end
  
  def github_owner_and_repo
    return nil unless github_repo?
    
    # Extract owner/repo from different GitHub URL formats
    # https://github.com/owner/repo.git or git@github.com:owner/repo.git
    if git_url.include?('github.com/')
      path = git_url.split('github.com/').last
    elsif git_url.include?('github.com:')
      path = git_url.split('github.com:').last
    else
      return nil
    end
    
    # Remove .git suffix and any query parameters
    path = path.gsub(/\.git$/, '').split('?').first
    owner, repo = path.split('/')
    
    return nil unless owner.present? && repo.present?
    { owner: owner, repo: repo }
  end
  
  def github_url
    info = github_owner_and_repo
    return nil unless info
    
    "https://github.com/#{info[:owner]}/#{info[:repo]}"
  end
  
  def github_avatar_url
    info = github_owner_and_repo
    return nil unless info
    
    # GitHub organization/user avatar URL
    "https://github.com/#{info[:owner]}.png?size=40"
  end
  
  private
  
  def set_default_values
    self.status ||= 'active'
    self.default_branch ||= 'main'
  end
end
