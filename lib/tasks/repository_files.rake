namespace :repository_files do
  desc "Update language detection for all repository files"
  task update_languages: :environment do
    puts "Updating language detection for all repository files..."
    
    total_files = RepositoryFile.count
    updated_count = 0
    
    RepositoryFile.find_each do |file|
      next if file.path.blank?
      
      old_language = file.language
      
      # Clear language to trigger detection
      file.language = nil
      file.save
      
      if file.language != old_language
        updated_count += 1
        puts "Updated '#{file.path}': #{old_language || 'nil'} → #{file.language}"
      end
    end
    
    puts "Done! Updated language detection for #{updated_count} out of #{total_files} files."
  end
  
  desc "Reset counter caches for all repositories"
  task reset_counter_caches: :environment do
    puts "Resetting counter caches for all repositories..."
    
    Repository.find_each do |repository|
      puts "Resetting counter for repository: #{repository.name} (ID: #{repository.id})"
      
      # Get the actual count
      file_count = repository.repository_files.count
      
      # Update the counter cache manually
      repository.update_column(:repository_files_count, file_count)
      
      puts "  Updated repository_files_count to #{file_count}"
    end
    
    puts "Counter caches have been reset for all repositories."
  end
end 