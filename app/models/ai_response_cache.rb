class AiResponseCache < ApplicationRecord
  belongs_to :repository
  
  validates :repository_id, presence: true
  validates :file_path, presence: true
  validates :cache_type, presence: true
  validates :content, presence: true
  
  # Find or create a cache entry
  def self.find_or_create_for(repository_id, file_path, cache_type, content)
    begin
      Rails.logger.info("Looking for cached #{cache_type} response for file #{file_path}")
      record = find_by(
        repository_id: repository_id,
        file_path: file_path,
        cache_type: cache_type
      )

      if record
        Rails.logger.info("Found existing cache record, updating...")
        record.update(content: content)
        record
      else
        Rails.logger.info("No cache record found, creating new...")
        create(
          repository_id: repository_id,
          file_path: file_path,
          cache_type: cache_type,
          content: content
        )
      end
    rescue => e
      Rails.logger.error("Error in find_or_create_for: #{e.message}")
      # Return nil instead of raising to prevent API response failures
      nil
    end
  end
  
  # New thread-safe method for caching in background
  def self.background_cache(repository_id, file_path, cache_type, content)
    CacheAiResponseJob.perform_later(repository_id, file_path, cache_type, content)
    # Return true to indicate that background caching was initiated (optional, depends on desired behavior)
    true
  end
  
  # Find cached content
  def self.find_cached_content(repository_id, file_path, cache_type)
    find_by(
      repository_id: repository_id,
      file_path: file_path,
      cache_type: cache_type
    )&.content
  end
end
