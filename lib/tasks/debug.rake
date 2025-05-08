namespace :debug do
  desc "Extract key concepts for a repository"
  task extract_key_concepts: :environment do
    # Get repository by ID or use first one
    repo_id = ENV['REPO_ID'] || Repository.first.id
    repo = Repository.find(repo_id)
    
    puts "Extracting key concepts for repository: #{repo.name}"
    
    # Clear existing concepts
    repo.key_concepts.destroy_all
    puts "Cleared existing key concepts"
    
    # Create Gemini service
    service = GeminiService.new
    puts "Created Gemini service"
    
    # Log some basic stats about the repository
    file_count = repo.repository_files.count
    puts "Repository has #{file_count} files"
    
    # Extract key concepts
    puts "Starting extraction..."
    
    # Get a representative sample of files
    max_files = 15  # Reduced from 30 to 15
    
    # Start with important directories that typically contain actual application logic
    important_paths = [
      'src/', 'lib/', 'app/', 'core/', 'include/', 'source/',  # Source code
      'test/', 'spec/', 'tests/'                              # Tests often show usage
    ]
    
    # Filter to include both important and some random files
    all_files = repo.repository_files
    
    # First, prioritize files from important directories
    important_files = all_files.where(
      important_paths.map { |path| "path LIKE '#{path}%'" }.join(' OR ')
    ).where("path NOT LIKE '%.md'")
     .where("LENGTH(content) < ?", 20000)  # Limit file size
     .order('RANDOM()').limit(max_files * 0.7)
    
    # Get some random files too to ensure diversity
    random_files = all_files.where.not(id: important_files.pluck(:id))
      .where("path NOT LIKE '%.md'")
      .where("LENGTH(content) < ?", 20000)  # Limit file size
      .order('RANDOM()').limit(max_files * 0.3)
    
    # Combine the sets
    files = important_files + random_files
    
    puts "Using #{files.count} files for extraction:"
    files.each_with_index do |f, i|
      puts "  #{i+1}. #{f.path} (#{f.content.size} chars)"
    end
    
    code_snippets = files.map { |f| "\n# #{f.path}\n#{f.content}" }.join("\n\n")
    manifest = files.map { |f| "#{f.path} (#{f.language})" }.join("\n")
    
    prompt = <<~PROMPT
      Based on the provided code files, identify 4-5 key technical concepts that are essential to understanding this codebase.

      For each concept:
      - Give it a clear descriptive name
      - Explain how it's implemented in this specific codebase (not general programming concepts)
      - List the relevant files involved
      - Explain how these files work together

      Format your response as a JSON array with objects containing these keys: "name", "description", "key_files", "key_files_explanation".
      Do not include any markdown formatting or code blocks in your response.

      Files:
      #{manifest}

      Code:
      #{code_snippets}
    PROMPT
    
    puts "Sending prompt to Gemini API..."
    response = service.send_to_gemini(prompt)
    
    text = response.dig("candidates", 0, "content", "parts", 0, "text")
    puts "Response text:"
    puts text.to_s[0..300] + "..." # First 300 chars
    
    # Clean the text to handle cases where it includes markdown code blocks
    cleaned_text = if text.present?
      # Remove code block markers if present
      text = text.gsub(/```(json|javascript|ruby)?/, '')
      # Trim whitespace
      text = text.strip
      # Handle cases where the first character isn't a [
      text = text[text.index('[')..] if text.present? && text.include?('[') && !text.start_with?('[')
      text
    else
      "[]"
    end
    
    begin
      concepts = JSON.parse(cleaned_text)
      puts "Parsed #{concepts.size} concepts"
      
      # Save concepts
      concepts.each do |concept|
        KeyConcept.create!(
          repository: repo,
          name: concept["name"],
          description: concept["description"],
          key_files: concept["key_files"],
          key_files_explanation: concept["key_files_explanation"]
        )
        puts "Created concept: #{concept["name"]}"
      end
      
      puts "Done! Created #{concepts.size} key concepts"
    rescue => e
      puts "Error parsing JSON response: #{e.message}"
      puts "Cleaned text (first 100 chars): #{cleaned_text[0..100]}"
    end
  end
end 