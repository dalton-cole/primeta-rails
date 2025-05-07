module Api
  class FileContextController < ApplicationController
    before_action :authenticate_user!
    before_action :check_gemini_enabled, except: [:test_gemini]
    
    def show
      repository_id = params[:repository_id]
      file_path = params[:file_path]
      
      Rails.logger.info("=== AI ASSISTANT FILE CONTEXT ===")
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
      rescue => e
        Rails.logger.error("Gemini API error: #{e.message}")
        return render json: { error: "Error generating explanation: #{e.message}" }, status: :internal_server_error
      end
      
      render json: { 
        file_path: file_path,
        explanation: explanation
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
    
    def fetch_file_content(repository, file_path)
      # Get content directly from the repository_file
      repository_file = RepositoryFile.find_by(repository_id: repository.id, path: file_path)
      
      if repository_file && repository_file.content.present?
        repository_file.content
      else
        # Fallback implementation
        repo_path = File.join(Rails.root, 'public', 'repos', repository.name)
        file_full_path = File.join(repo_path, file_path)
        File.read(file_full_path)
      end
    end
  end
end 