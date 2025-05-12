module Gemini
  class FileSelectionService
    # Max tokens we want to stay under for Gemini API
    MAX_TOKENS = 800_000
    
    def select_files_for_analysis(repository, file_paths = nil)
      # 1. Gather all relevant files (exclude huge, binary, or vendor files)
      files_query = repository.repository_files
        .where("LENGTH(content) < ?", 100_000)
        .where.not("path LIKE ?", "node_modules/%")
        .where.not("path LIKE ?", "vendor/%")
        .where.not("path LIKE ?", "log/%")
        .where.not("path LIKE ?", "tmp/%")
        .where.not("path LIKE ?", "public/%")
        .where.not("path LIKE ?", "dist/%")
        .where.not("path LIKE ?", "build/%")
        .where.not("path LIKE ?", "%.min.%")
        .where.not("path LIKE ?", "%.bundle.%")
      
      # Apply file path filters if provided
      if file_paths.present?
        files_query = apply_path_filters(files_query, file_paths, repository)
      end
      
      files = files_query
      Rails.logger.info("Repository has #{files.count} files for analysis")
      
      # Sort files by potential importance
      sorted_files = sort_files_by_importance(files)
      
      # Select files within token limit and prepare snippets
      selected_files, code_snippets = select_files_within_token_limit(sorted_files)
      
      # Create a manifest of selected files
      manifest = selected_files.map { |f| "#{f.path} (#{f.language})" }.join("\n")
      
      return selected_files, manifest, code_snippets
    end
    
    private
    
    def apply_path_filters(query, file_paths, repository)
      # Convert file_paths to array if it's a string
      paths = file_paths.is_a?(Array) ? file_paths : [file_paths]
      
      # Build conditions for each path (exact match or directory prefix)
      conditions = paths.map do |path|
        if path.end_with?('/')
          # If path ends with /, treat as directory and match all files in that directory
          repository.repository_files.sanitize_sql_for_conditions(["path LIKE ?", "#{path}%"])
        else
          # Otherwise, treat as exact file path
          repository.repository_files.sanitize_sql_for_conditions(["path = ?", path])
        end
      end
      
      # Join conditions with OR
      if conditions.any?
        query.where(conditions.join(' OR '))
      else
        query
      end
    end
    
    def sort_files_by_importance(files)
      files.sort_by do |f|
        size_score = f.content.length
        # Prioritize key files and common important files like app entry points
        importance_multiplier = if f.is_key_file
                                0.2
                              elsif f.path.match?(/^(app\/models\/|app\/controllers\/|lib\/|src\/|main\.)/i)
                                0.5
                              elsif f.path.match?(/^(spec\/|test\/|\.github\/|\.circleci\/)/i)
                                2.0
                              else
                                1.0
                              end
        size_score * importance_multiplier
      end
    end
    
    def select_files_within_token_limit(sorted_files)
      code_snippets = ""
      selected_files = []
      running_tokens = 0
      
      sorted_files.each do |f|
        snippet = "\n# #{f.path}\n#{f.content}"
        # Estimate tokens conservatively
        tokens = snippet.length / 3
        
        if running_tokens + tokens > MAX_TOKENS
          next
        end
        
        code_snippets << snippet
        selected_files << f
        running_tokens += tokens
        
        # Break early if we're getting close to the limit
        break if running_tokens > MAX_TOKENS * 0.95
      end
      
      Rails.logger.info("Selected #{selected_files.size} files out of #{sorted_files.size} for analysis")
      Rails.logger.info("Estimated token count: #{running_tokens}")
      
      return selected_files, code_snippets
    end
  end
end 