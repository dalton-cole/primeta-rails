class AiResponseCache < ApplicationRecord
  belongs_to :repository
  
  validates :repository_id, :file_path, :cache_type, :content, presence: true
  validates :cache_type, inclusion: { in: ['context', 'challenges'] }
  
  # Find or create a cache entry
  def self.find_or_create_for(repository_id, file_path, cache_type, content)
    cache_record = find_or_initialize_by(
      repository_id: repository_id,
      file_path: file_path,
      cache_type: cache_type
    )
    
    # Update content if it's a new record or content has changed
    if cache_record.new_record? || cache_record.content != content
      cache_record.content = content
      cache_record.save
    end
    
    cache_record
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
