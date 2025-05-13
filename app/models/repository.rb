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
    # Prefer the cached attribute if it's been populated (e.g., by sync job)
    # The default value for cached_explorer_count is 0, so we check if it's greater than 0
    # or if it has been explicitly set (even to 0 after a sync).
    # A more robust check might be to see if last_synced_at is present and the value is not nil.
    # For simplicity, we check if the attribute is non-nil. If it is nil, it means sync hasn't run or old record.
    if read_attribute(:cached_explorer_count).nil?
      # Fallback to old calculation if not synced or for older records
      Rails.logger.warn "Falling back to live explorer_count calculation for Repository ID: #{id}"
      Rails.cache.fetch("repository/#{id}/explorer_count_fallback", expires_in: 15.minutes) do
        User.joins(file_views: :repository_file)
            .where(repository_files: { repository_id: id })
            .distinct
            .count
      end
    else
      read_attribute(:cached_explorer_count)
    end
  end
  
  # Repository statistics
  def language_stats
    # Prefer the cached attribute
    if read_attribute(:cached_language_stats).nil?
      Rails.logger.warn "Falling back to live language_stats calculation for Repository ID: #{id}"
      Rails.cache.fetch("repository/#{id}/language_stats_fallback", expires_in: 1.hour) do
        stats = repository_files
          .where.not(language: [nil, '', 'plaintext'])
          .group(:language)
          .count
          .sort_by { |_, count| -count }
          .take(3)
        
        return [] if stats.empty?
        
        total_relevant_files = repository_files.where.not(language: [nil, '', 'plaintext']).count
        return [] if total_relevant_files == 0
        
        stats.map do |language, count|
          {
            language: language,
            count: count,
            percentage: ((count.to_f / total_relevant_files) * 100).round
          }
        end
      end
    else
      # If :jsonb is used, this will be a Hash/Array already.
      # If :text is used with Rails serialize, it will also be a Hash/Array.
      # If :text is used without serialize, it might be a JSON string needing parsing.
      # Assuming it's already in the correct format (Array of Hashes).
      read_attribute(:cached_language_stats)
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
    # Return the pre-calculated attribute
    super # or read_attribute(:total_size_in_bytes)
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
  
  def key_file_ids_set
    Rails.cache.fetch("repository/#{id}/key_file_ids_set_v1", expires_in: 24.hours) do
      # Fetch all arrays of key_files paths from concepts
      all_key_file_paths_arrays = key_concepts.pluck(:key_files)
      
      # Flatten and get unique paths
      # Ensure key_files are present and not empty before flat_map
      unique_key_file_paths = all_key_file_paths_arrays.compact.flat_map { |paths| paths if paths.present? }.compact.uniq
      
      if unique_key_file_paths.empty?
        Set.new
      else
        # Query RepositoryFile IDs for these paths
        repository_files.where(path: unique_key_file_paths).pluck(:id).to_set
      end
    end
  end
  
  private
  
  def set_default_values
    self.status ||= 'active'
    self.default_branch ||= 'main'
  end
end
