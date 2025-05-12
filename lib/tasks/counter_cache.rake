namespace :counter_cache do
  desc "Reset counter caches for all models"
  task reset: :environment do
    puts "Resetting counter caches..."
    
    # Update repository_files_count for repositories
    Repository.find_each do |repository|
      Repository.reset_counters(repository.id, :repository_files)
      puts "Updated repository_files_count for Repository ##{repository.id}"
    end
    
    # Update key_concepts_count for repositories
    Repository.find_each do |repository|
      Repository.reset_counters(repository.id, :key_concepts)
      puts "Updated key_concepts_count for Repository ##{repository.id}"
    end
    
    # Update file_views_count for repository_files
    RepositoryFile.find_each do |file|
      RepositoryFile.reset_counters(file.id, :file_views)
      puts "Updated file_views_count for RepositoryFile ##{file.id}" if file.id % 100 == 0
    end
    
    # Update file_views_count for users
    User.find_each do |user|
      User.reset_counters(user.id, :file_views)
      puts "Updated file_views_count for User ##{user.id}"
    end
    
    puts "Counter cache reset completed!"
  end
end 