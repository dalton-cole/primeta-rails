class RepositorySyncJob < ApplicationJob
  queue_as :default
  
  def perform(repository_id)
    repository = Repository.find_by(id: repository_id)
    return unless repository
    
    begin
      repository.update(status: 'syncing')
      
      # Create a unique directory for this repository
      repo_dir = Rails.root.join('storage', 'repositories', repository.id.to_s)
      FileUtils.mkdir_p(repo_dir)
      
      if Dir.exist?(File.join(repo_dir, '.git'))
        # Repository already exists, just pull the latest changes
        Rails.logger.info("Pulling latest changes for repository: #{repository.name}")
        git_pull(repo_dir)
      else
        # Clone the repository
        Rails.logger.info("Cloning repository: #{repository.name}")
        git_clone(repository.clone_url, repo_dir)
      end
      
      # Get the current commit hash
      current_commit_hash = get_current_commit_hash(repo_dir)
      
      # Process and store all files
      process_repository_files(repository, repo_dir)
      
      # Update repository status and commit hash
      repository.update(
        status: 'active', 
        last_synced_at: Time.current,
        current_commit_hash: current_commit_hash
      )
      
    rescue => e
      Rails.logger.error("Error syncing repository #{repository.id}: #{e.message}")
      repository.update(status: 'error', error_message: e.message)
    end
  end
  
  private
  
  def git_clone(git_url, destination)
    cmd = "git clone #{git_url} #{destination}"
    system(cmd) || raise("Failed to clone repository: #{$?.exitstatus}")
  end
  
  def git_pull(repo_dir)
    Dir.chdir(repo_dir) do
      cmd = "git pull"
      system(cmd) || raise("Failed to pull repository: #{$?.exitstatus}")
    end
  end
  
  def get_current_commit_hash(repo_dir)
    Dir.chdir(repo_dir) do
      # Get the full commit hash of HEAD
      `git rev-parse HEAD`.strip
    end
  end
  
  def process_repository_files(repository, repo_dir)
    Rails.logger.info("Processing files for repository: #{repository.name} (ID: #{repository.id})")
    
    # Get files from the repository directory
    files_in_directory = []
    Dir.glob("#{repo_dir}/**/*").each do |file_path|
      next if File.directory?(file_path)
      next if file_path.include?('.git/')
      
      # Get path relative to repo directory
      relative_path = file_path.sub("#{repo_dir}/", '')
      
      # Skip binary files and large files
      next if binary_file?(file_path)
      next if File.size(file_path) > 1.megabyte
      
      files_in_directory << relative_path
    end
    
    # Find existing files that are no longer in the repository
    current_files = repository.repository_files.pluck(:path)
    files_to_delete = current_files - files_in_directory
    
    # Delete files that no longer exist
    if files_to_delete.any?
      Rails.logger.info("Deleting #{files_to_delete.count} files that no longer exist in the repository")
      repository.repository_files.where(path: files_to_delete).destroy_all
    end
    
    # Track counts of files for logging
    files_updated = 0
    files_created = 0
    files_with_errors = 0
    
    # Update or create files
    files_in_directory.each do |relative_path|
      file_path = File.join(repo_dir, relative_path)
      
      begin
        # Read file with proper line endings
        content = File.read(file_path, mode: 'r')
        
        # Normalize line endings to ensure consistency
        content = normalize_line_endings(content)
        
        # Try to find existing file
        repo_file = repository.repository_files.find_by(path: relative_path)
        
        if repo_file
          # Update existing file
          repo_file.update(
            content: content,
            size: File.size(file_path)
          )
          files_updated += 1
        else
          # Create new file
          repository.repository_files.create!(
            path: relative_path,
            content: content,
            size: File.size(file_path)
          )
          files_created += 1
        end
      rescue => e
        files_with_errors += 1
        Rails.logger.error("Error processing file #{relative_path}: #{e.message}")
      end
    end
    
    Rails.logger.info("Repository sync completed: #{files_created} files created, #{files_updated} files updated, #{files_with_errors} files with errors")
  end
  
  def normalize_line_endings(content)
    # First convert all Windows CRLF (\r\n) to Unix LF (\n)
    normalized = content.gsub(/\r\n/, "\n")
    
    # Then convert any remaining single CRs (\r) to LF (\n)
    normalized.gsub(/\r/, "\n")
  end
  
  def binary_file?(file_path)
    # More comprehensive check for binary files
    ext = File.extname(file_path).downcase
    
    # Known binary extensions
    binary_extensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz', 
      '.dmg', '.exe', '.bin', '.jar', '.class', '.so', '.dll', 
      '.pyc', '.pyo', '.o', '.obj'
    ]
    
    # If it has a known binary extension, it's binary
    return true if binary_extensions.include?(ext)
    
    # For other files, perform a sample check
    # Read the first 8192 bytes and look for null bytes
    begin
      File.open(file_path, 'rb') do |f|
        sample = f.read(8192) || ''
        return sample.include?("\x00")
      end
    rescue
      # If there's any error reading the file, consider it binary to be safe
      return true
    end
  end
end 