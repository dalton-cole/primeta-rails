namespace :repositories do
  desc "Backfills cached stats (total size, language stats, explorer count) for existing repositories"
  task backfill_cached_stats: :environment do
    puts "Starting backfill for repository cached stats..."
    
    Repository.find_each do |repo|
      begin
        # Calculate total_size_in_bytes
        total_size = repo.repository_files.sum(:size)
        
        # Calculate language_stats
        lang_stats_data = []
        # Using the raw calculation logic here as it was in RepositorySyncJob helper
        temp_stats = repo.repository_files
                         .where.not(language: [nil, '', 'plaintext'])
                         .group(:language).count.sort_by { |_, count| -count }.take(3)
                         
        if temp_stats.any?
          total_relevant_files = repo.repository_files.where.not(language: [nil, '', 'plaintext']).count
          if total_relevant_files > 0
            lang_stats_data = temp_stats.map do |language, count|
              {
                language: language,
                count: count,
                percentage: ((count.to_f / total_relevant_files) * 100).round
              }
            end
          end
        end
        
        # Calculate explorer_count
        # Using the raw calculation logic here as it was in RepositorySyncJob helper
        exp_count = User.joins(file_views: :repository_file)
                        .where(repository_files: { repository_id: repo.id })
                        .distinct.count

        repo.update_columns(
          total_size_in_bytes: total_size,
          cached_language_stats: lang_stats_data,
          cached_explorer_count: exp_count
        )
        puts "Updated stats for Repository ID: #{repo.id} - #{repo.name}"
      rescue => e
        puts "Error updating Repository ID: #{repo.id} - #{repo.name}: #{e.message}"
      end
    end
    puts "Backfill completed."
  end
end 