class CacheAiResponseJob < ApplicationJob
  queue_as :default

  def perform(repository_id, file_path, cache_type, content)
    # Logic moved from AiResponseCache.background_cache
    begin
      # ActiveRecord::Base.connection_pool.with_connection do # Optional for simple ActiveJob perform methods
        record = AiResponseCache.find_by(
          repository_id: repository_id,
          file_path: file_path,
          cache_type: cache_type
        )
        
        if record
          record.update(content: content)
          Rails.logger.info("AI response cache record updated for repo: #{repository_id}, path: #{file_path}, type: #{cache_type}")
        else
          AiResponseCache.create(
            repository_id: repository_id,
            file_path: file_path,
            cache_type: cache_type,
            content: content
          )
          Rails.logger.info("AI response cache record created for repo: #{repository_id}, path: #{file_path}, type: #{cache_type}")
        end
      # end # Corresponds to with_connection block
    rescue => e
      Rails.logger.error("Error in CacheAiResponseJob for repo: #{repository_id}, path: #{file_path}, type: #{cache_type}: #{e.message}")
      # Depending on the error, you might want to retry the job.
      # ActiveJob handles retries based on queue adapter settings if an exception is raised.
      # For example, to explicitly retry: raise e
    end
  end
end
