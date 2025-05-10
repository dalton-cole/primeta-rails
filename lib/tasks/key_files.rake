namespace :key_files do
  desc "Update is_key_file flags for all repository files mentioned in key concepts"
  task update_flags: :environment do
    puts "Updating is_key_file flags for all repository files in key concepts..."
    
    # First, reset all is_key_file flags to false
    RepositoryFile.update_all(is_key_file: false)
    
    # Then set is_key_file = true for all files in key concepts
    KeyConcept.find_each do |concept|
      if concept.key_files.present?
        # Get the repository for this concept
        repository = concept.repository
        
        # Update the is_key_file flag for all files in this concept
        updated_count = repository.repository_files.where(path: concept.key_files).update_all(is_key_file: true)
        
        puts "Updated #{updated_count} files for concept '#{concept.name}' in repository '#{repository.name}'"
      end
    end
    
    # Print summary
    total_key_files = RepositoryFile.where(is_key_file: true).count
    puts "Completed! Total key files marked: #{total_key_files}"
  end
end 