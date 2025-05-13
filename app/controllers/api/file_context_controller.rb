module Api
  class FileContextController < ApplicationController
    before_action :authenticate_user!
    before_action :check_gemini_enabled, except: [:test_gemini, :submit_feedback]
    
    def show
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      refresh = params[:refresh] == 'true'
      
      Rails.logger.info("=== AI ASSISTANT FILE CONTEXT ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      Rails.logger.info("Refresh: #{refresh}")
      
      # Validate required parameters
      if repository_id.blank? || file_path.blank?
        error_message = []
        error_message << "Missing repository_id" if repository_id.blank?
        error_message << "Missing file_path" if file_path.blank?
        Rails.logger.error("Missing required parameters: #{error_message.join(', ')}")
        return render json: { error: "Missing required parameters: #{error_message.join(', ')}" }, status: :bad_request
      end
      
      # Normalize file path to remove any leading/trailing whitespace and colons
      file_path = file_path.strip
      
      # Remove any leading colon that may have been accidentally included
      if file_path.start_with?(':')
        file_path = file_path[1..-1]
        Rails.logger.info("Normalized file path by removing leading colon: #{file_path}")
      end
      
      # Only allow admins to force refresh
      if refresh && !current_user&.admin?
        Rails.logger.warn("Non-admin user attempted to force refresh content")
        refresh = false
      end
      
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      Rails.logger.info("Repository found: #{repository.name}")
      
      repository_file = RepositoryFile.find_by(repository_id: repository_id, path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("File not found with path: #{file_path}")
        return render json: { error: "File not found with path: #{file_path}" }, status: :not_found
      end
      
      Rails.logger.info("File found: #{repository_file.path}")
      
      # Check cache first unless refresh is requested
      unless refresh
        cache_record = AiResponseCache.find_by(
          repository_id: repository_id,
          file_path: file_path,
          cache_type: 'context'
        )
        
        if cache_record.present?
          Rails.logger.info("Found cached explanation, returning from cache")
          cached_flag = true
          cached_at = cache_record.updated_at.strftime('%Y-%m-%d %H:%M:%S')
          Rails.logger.info("Cache status: #{cached_flag.inspect} (#{cached_flag.class})")
          return render json: { 
            file_path: file_path,
            explanation: cache_record.content,
            cached: cached_flag,
            cached_at: cached_at
          }
        end
      end
      
      # Get file content using existing mechanisms
      file_content = begin
        content = fetch_file_content(repository, file_path)
        Rails.logger.info("File content retrieved, length: #{content.to_s.length} characters")
        content
      rescue => e
        Rails.logger.error("Error retrieving file content: #{e.message}")
        return render json: { error: "Unable to retrieve file content: #{e.message}" }, status: :internal_server_error
      end
      
      # Generate explanation using Gemini API
      begin
        explanation = gemini_service.explain_code(file_path, file_content)
        Rails.logger.info("Explanation generated successfully, length: #{explanation.to_s.length} characters")
        
        # Return response immediately
        cached_flag = false
        Rails.logger.info("Cache status: #{cached_flag.inspect} (#{cached_flag.class})")
        response_json = { 
          file_path: file_path,
          explanation: explanation,
          cached: cached_flag
        }
        
        # Cache the result in the background
        Thread.new do
          begin
            ActiveRecord::Base.connection_pool.with_connection do
              # Use find_by + create or update to handle race conditions
              cache_record = AiResponseCache.find_by(
                repository_id: repository_id,
                file_path: file_path,
                cache_type: 'context'
              )
              
              if cache_record
                cache_record.update(content: explanation)
              else
                AiResponseCache.create(
                  repository_id: repository_id,
                  file_path: file_path,
                  cache_type: 'context',
                  content: explanation
                )
              end
              Rails.logger.info("Explanation cached successfully in background thread")
            end
          rescue => e
            Rails.logger.error("Error caching explanation in background: #{e.message}")
          ensure
            ActiveRecord::Base.connection.close
          end
        end
        
        render json: response_json
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error generating explanation: #{e.message}" }, status: :internal_server_error
      end
    end
    
    # Get code improvement suggestions for a file
    def suggestions
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      
      Rails.logger.info("=== AI ASSISTANT CODE SUGGESTIONS ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      
      return render json: { error: "Missing required parameters" }, status: :bad_request unless repository_id.present? && file_path.present?
      
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      Rails.logger.info("Repository found: #{repository.name}")
      
      repository_file = RepositoryFile.find_by(repository_id: repository_id, path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("File not found with path: #{file_path}")
        return render json: { error: "File not found" }, status: :not_found
      end
      
      Rails.logger.info("File found: #{repository_file.path}")
      
      # Get file content
      file_content = begin
        content = fetch_file_content(repository, file_path)
        Rails.logger.info("File content retrieved, length: #{content.to_s.length} characters")
        content
      rescue => e
        Rails.logger.error("Error retrieving file content: #{e.message}")
        return render json: { error: "Unable to retrieve file content: #{e.message}" }, status: :internal_server_error
      end
      
      # Generate suggestions using Gemini API
      begin
        suggestions = gemini_service.suggest_improvements(file_path, file_content)
        Rails.logger.info("Suggestions generated successfully, length: #{suggestions.to_s.length} characters")
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error generating suggestions: #{e.message}" }, status: :internal_server_error
      end
      
      render json: { 
        file_path: file_path,
        suggestions: suggestions,
        cached: false
      }
    end
    
    # Get learning challenges for a file
    def learning_challenges
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      refresh = params[:refresh] == 'true'
      
      Rails.logger.info("=== AI ASSISTANT LEARNING CHALLENGES ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      Rails.logger.info("Refresh: #{refresh}")
      
      return render json: { error: "Missing required parameters" }, status: :bad_request unless repository_id.present? && file_path.present?
      
      # Only allow admins to force refresh
      if refresh && !current_user&.admin?
        Rails.logger.warn("Non-admin user attempted to force refresh challenges")
        refresh = false
      end
      
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      Rails.logger.info("Repository found: #{repository.name}")
      
      repository_file = RepositoryFile.find_by(repository_id: repository_id, path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("File not found with path: #{file_path}")
        return render json: { error: "File not found" }, status: :not_found
      end
      
      Rails.logger.info("File found: #{repository_file.path}")
      
      # Check cache first unless refresh is requested
      unless refresh
        cache_record = AiResponseCache.find_by(
          repository_id: repository_id,
          file_path: file_path,
          cache_type: 'challenges'
        )
        
        if cache_record.present?
          Rails.logger.info("Found cached challenges, returning from cache")
          cached_flag = true
          cached_at = cache_record.updated_at.strftime('%Y-%m-%d %H:%M:%S')
          Rails.logger.info("Cache status for challenges: #{cached_flag.inspect} (#{cached_flag.class})")
          return render json: { 
            file_path: file_path,
            challenges: cache_record.content,
            cached: cached_flag,
            cached_at: cached_at
          }
        end
      end
      
      # Get file content
      file_content = begin
        content = fetch_file_content(repository, file_path)
        Rails.logger.info("File content retrieved, length: #{content.to_s.length} characters")
        content
      rescue => e
        Rails.logger.error("Error retrieving file content: #{e.message}")
        return render json: { error: "Unable to retrieve file content: #{e.message}" }, status: :internal_server_error
      end
      
      # Generate learning challenges using Gemini API
      begin
        challenges = gemini_service.generate_learning_challenges(file_path, file_content, repository)
        Rails.logger.info("Learning challenges generated successfully, length: #{challenges.to_s.length} characters")
        
        # Return response immediately
        cached_flag = false
        Rails.logger.info("Cache status for challenges: #{cached_flag.inspect} (#{cached_flag.class})")
        response_json = { 
          file_path: file_path,
          challenges: challenges,
          cached: cached_flag
        }
        
        # Cache the result in the background
        Thread.new do
          begin
            ActiveRecord::Base.connection_pool.with_connection do
              # Use find_by + create or update to handle race conditions
              cache_record = AiResponseCache.find_by(
                repository_id: repository_id,
                file_path: file_path,
                cache_type: 'challenges'
              )
              
              if cache_record
                cache_record.update(content: challenges)
              else
                AiResponseCache.create(
                  repository_id: repository_id,
                  file_path: file_path,
                  cache_type: 'challenges',
                  content: challenges
                )
              end
              Rails.logger.info("Challenges cached successfully in background thread")
            end
          rescue => e
            Rails.logger.error("Error caching challenges in background: #{e.message}")
          ensure
            ActiveRecord::Base.connection.close
          end
        end
        
        render json: response_json
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error generating learning challenges: #{e.message}" }, status: :internal_server_error
      end
    end
    
    # Get related patterns for a file
    def related_patterns
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      
      Rails.logger.info("=== AI ASSISTANT RELATED PATTERNS ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      
      return render json: { error: "Missing required parameters" }, status: :bad_request unless repository_id.present? && file_path.present?
      
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      Rails.logger.info("Repository found: #{repository.name}")
      
      repository_file = RepositoryFile.find_by(repository_id: repository_id, path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("File not found with path: #{file_path}")
        return render json: { error: "File not found" }, status: :not_found
      end
      
      Rails.logger.info("File found: #{repository_file.path}")
      
      # Get file content
      file_content = begin
        content = fetch_file_content(repository, file_path)
        Rails.logger.info("File content retrieved, length: #{content.to_s.length} characters")
        content
      rescue => e
        Rails.logger.error("Error retrieving file content: #{e.message}")
        return render json: { error: "Unable to retrieve file content: #{e.message}" }, status: :internal_server_error
      end
      
      # Find related patterns using Gemini API
      begin
        patterns = gemini_service.find_related_patterns(file_path, file_content, repository)
        Rails.logger.info("Related patterns found successfully, length: #{patterns.to_s.length} characters")
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error finding related patterns: #{e.message}" }, status: :internal_server_error
      end
      
      render json: { 
        file_path: file_path,
        patterns: patterns,
        cached: false
      }
    end
    
    # Get conceptual visualizations for a file
    def visualizations
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      
      Rails.logger.info("=== AI ASSISTANT VISUALIZATIONS ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      
      return render json: { error: "Missing required parameters" }, status: :bad_request unless repository_id.present? && file_path.present?
      
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      Rails.logger.info("Repository found: #{repository.name}")
      
      repository_file = RepositoryFile.find_by(repository_id: repository_id, path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("File not found with path: #{file_path}")
        return render json: { error: "File not found" }, status: :not_found
      end
      
      Rails.logger.info("File found: #{repository_file.path}")
      
      # Get file content
      file_content = begin
        content = fetch_file_content(repository, file_path)
        Rails.logger.info("File content retrieved, length: #{content.to_s.length} characters")
        content
      rescue => e
        Rails.logger.error("Error retrieving file content: #{e.message}")
        return render json: { error: "Unable to retrieve file content: #{e.message}" }, status: :internal_server_error
      end
      
      # Generate visualizations using Gemini API
      begin
        visualizations = gemini_service.generate_visualizations(file_path, file_content, repository)
        Rails.logger.info("Visualizations generated successfully, length: #{visualizations.to_s.length} characters")
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error generating visualizations: #{e.message}" }, status: :internal_server_error
      end
      
      render json: { 
        file_path: file_path,
        visualizations: visualizations,
        cached: false
      }
    end
    
    # Test endpoint to verify Gemini API is working
    def test_gemini
      Rails.logger.info("=== TESTING GEMINI API ===")
      
      if Rails.application.config.gemini[:enabled]
        begin
          service = GeminiService.new
          response = service.send_to_gemini("Say 'Hello from Gemini API'")
          
          if response.dig("candidates", 0, "content", "parts", 0, "text")
            message = response.dig("candidates", 0, "content", "parts", 0, "text")
            render json: { 
              status: "success", 
              message: message,
              credentials: "API key found and valid"
            }
          else
            render json: { 
              status: "error", 
              message: "API responded but no text was returned",
              raw_response: response 
            }, status: :internal_server_error
          end
        rescue => e
          render json: { 
            status: "error", 
            message: "Error testing Gemini API: #{e.message}",
            backtrace: e.backtrace.first(5),
            credentials: Rails.application.config.gemini[:enabled] ? "API key found but invalid" : "No API key found"
          }, status: :internal_server_error
        end
      else
        render json: { 
          status: "error", 
          message: "Gemini API is not enabled in configuration" 
        }, status: :service_unavailable
      end
    end
    
    # Submit feedback for AI responses
    def submit_feedback
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      content_type = params[:content_type]
      is_helpful = params[:is_helpful]
      feedback_text = params[:feedback_text]
      
      Rails.logger.info("=== AI ASSISTANT FEEDBACK SUBMISSION ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      Rails.logger.info("Content Type: #{content_type}")
      Rails.logger.info("Is Helpful: #{is_helpful}")
      Rails.logger.info("Feedback: #{feedback_text}")
      
      return render json: { error: "Missing required parameters" }, status: :bad_request unless repository_id.present? && file_path.present? && content_type.present? && !is_helpful.nil?
      
      # Verify repository exists
      repository = Repository.find_by(id: repository_id)
      return render json: { error: "Repository not found" }, status: :not_found unless repository
      
      # Check if the user has already provided feedback for this content
      existing_feedback = AiFeedback.find_by(
        user_id: current_user&.id,
        repository_id: repository_id,
        file_path: file_path,
        content_type: content_type
      )
      
      if existing_feedback
        # Update existing feedback
        Rails.logger.info("Updating existing feedback record")
        existing_feedback.is_helpful = is_helpful == 'true' || is_helpful == true
        existing_feedback.feedback_text = feedback_text if feedback_text.present?
        success = existing_feedback.save
        feedback = existing_feedback
      else
        # Create feedback record
        Rails.logger.info("Creating new feedback record")
        feedback = AiFeedback.new(
          user_id: current_user&.id,
          repository_id: repository_id,
          file_path: file_path,
          content_type: content_type,
          is_helpful: is_helpful == 'true' || is_helpful == true,
          feedback_text: feedback_text
        )
        success = feedback.save
      end
      
      if success
        Rails.logger.info("Feedback saved successfully")
        
        # Get updated stats
        stats = AiFeedback.stats_for(repository_id, file_path, content_type)
        helpful_count = stats[true] || 0
        not_helpful_count = stats[false] || 0
        
        render json: { 
          success: true,
          message: "Feedback recorded successfully",
          stats: {
            helpful_count: helpful_count,
            not_helpful_count: not_helpful_count
          }
        }
      else
        Rails.logger.error("Error saving feedback: #{feedback.errors.full_messages.join(', ')}")
        render json: { error: "Failed to save feedback: #{feedback.errors.full_messages.join(', ')}" }, status: :unprocessable_entity
      end
    end
    
    # Check if user has already submitted feedback
    def check_feedback
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      content_type = params[:content_type]
      
      Rails.logger.info("=== AI ASSISTANT FEEDBACK CHECK ===")
      Rails.logger.info("Repository ID: #{repository_id}")
      Rails.logger.info("File Path: #{file_path}")
      Rails.logger.info("Content Type: #{content_type}")
      
      return render json: { has_feedback: false } unless current_user
      
      feedback = AiFeedback.find_by(
        user_id: current_user.id,
        repository_id: repository_id,
        file_path: file_path,
        content_type: content_type
      )
      
      if feedback
        Rails.logger.info("User has existing feedback: is_helpful=#{feedback.is_helpful}")
        # Get overall stats
        stats = AiFeedback.stats_for(repository_id, file_path, content_type)
        helpful_count = stats[true] || 0
        not_helpful_count = stats[false] || 0
        
        render json: { 
          has_feedback: true, 
          is_helpful: feedback.is_helpful,
          stats: {
            helpful_count: helpful_count,
            not_helpful_count: not_helpful_count
          }
        }
      else
        Rails.logger.info("No existing feedback found for user")
        render json: { has_feedback: false }
      end
    end
    
    private
    
    def gemini_service
      @gemini_service ||= GeminiService.new
    end
    
    def check_gemini_enabled
      unless Rails.application.config.gemini[:enabled]
        Rails.logger.error("Gemini API is not enabled. Check credentials configuration.")
        render json: { error: "AI context generation is not available. Gemini API key not configured." }, status: :service_unavailable
        return false
      end
    end
    
    # Helper to prioritize requests from important views
    def prioritize_by_headers
      priority = request.headers['X-AI-Assistant-Priority']
      
      if priority == 'high'
        Rails.logger.info("Handling high priority AI request")
        # Higher priority requests get more resources/tokens
        { maxOutputTokens: 1000 }
      else
        # Standard priority
        {}
      end
    end
    
    def fetch_file_content(repository, file_path)
      Rails.logger.info("Fetching content for #{file_path} in repository #{repository.id}")
      
      repository_file = repository.repository_files.find_by(path: file_path)
      
      if repository_file.nil?
        Rails.logger.error("RepositoryFile not found with path: #{file_path}")
        raise "File not found: #{file_path}"
      end
      
      if repository_file.content.blank?
        Rails.logger.error("RepositoryFile has no content: #{file_path}")
        raise "File content is empty: #{file_path}"
      end
      
      repository_file.content
    end
  end
end 