class LanguageDetectionService
  def self.detect_language(file_path)
    filename = File.basename(file_path).downcase
    extension = File.extname(file_path).delete('.').downcase
    
    # First check for special files without extensions or with special names
    if extension.blank? || extension.length < 1
      language = detect_by_filename(filename)
      return language if language.present? && language != 'plaintext'
    end
    
    # Then check by extension
    detect_by_extension(extension)
  end
  
  def self.detect_by_filename(filename)
    case filename
    when 'makefile', 'makefile.in' then 'makefile'
    when 'dockerfile' then 'dockerfile'
    when 'vagrantfile' then 'ruby'
    when 'gemfile' then 'ruby'
    when 'rakefile' then 'ruby'
    when 'jenkinsfile' then 'groovy'
    when '.gitignore', '.dockerignore' then 'git'
    when 'package.json', 'package-lock.json' then 'json'
    when 'tsconfig.json' then 'json'
    when '.eslintrc', '.eslintrc.json' then 'json'
    when '.babelrc' then 'json'
    when 'webpack.config.js' then 'javascript'
    when '.editorconfig' then 'editorconfig'
    when 'cmakelists.txt' then 'cmake'
    when 'readme', 'readme.txt', 'readme.md' then 'markdown'
    when 'license', 'license.txt', 'license.md' then 'markdown'
    when 'contributing', 'contributing.md' then 'markdown'
    else 'plaintext'
    end
  end
  
  def self.detect_by_extension(ext)
    case ext
    # Ruby
    when 'rb', 'rake', 'gemspec' then 'ruby'
    when 'erb' then 'html'
    
    # JavaScript ecosystem
    when 'js' then 'javascript'
    when 'jsx' then 'javascript'
    when 'ts' then 'typescript'
    when 'tsx' then 'typescript'
    when 'mjs', 'cjs' then 'javascript'
    when 'json' then 'json'
    
    # Web technologies
    when 'html', 'htm', 'xhtml', 'vue' then 'html'
    when 'css' then 'css'
    when 'scss', 'sass' then 'scss'
    when 'less' then 'less'
    when 'svg' then 'xml'
    when 'xml', 'xsl', 'xslt' then 'xml'
    
    # Python
    when 'py', 'pyw' then 'python'
    when 'ipynb' then 'json'
    
    # JVM languages
    when 'java' then 'java'
    when 'kt', 'kts' then 'kotlin'
    when 'scala' then 'scala'
    when 'groovy' then 'groovy'
    when 'gradle' then 'groovy'
    
    # .NET languages
    when 'cs' then 'csharp'
    when 'vb' then 'vb'
    when 'fs' then 'fsharp'
    
    # PHP
    when 'php', 'phtml', 'php5', 'php7', 'phps' then 'php'
    
    # Other languages
    when 'c', 'h' then 'c'
    when 'cpp', 'cc', 'cxx', 'c++', 'hpp', 'hxx', 'h++' then 'cpp'
    when 'go' then 'go'
    when 'rs' then 'rust'
    when 'swift' then 'swift'
    when 'sh', 'bash', 'zsh' then 'shell'
    when 'bat', 'cmd' then 'bat'
    when 'ps1' then 'powershell'
    when 'sql' then 'sql'
    when 'r' then 'r'
    when 'dart' then 'dart'
    when 'elm' then 'elm'
    when 'ex', 'exs' then 'elixir'
    when 'erl' then 'erlang'
    when 'clj', 'cljs' then 'clojure'
    when 'hs' then 'haskell'
    when 'pl', 'pm' then 'perl'
    
    # Documentation and configuration
    when 'md', 'markdown' then 'markdown'
    when 'yml', 'yaml' then 'yaml'
    when 'toml' then 'toml'
    when 'ini' then 'ini'
    when 'conf' then 'conf'
    when 'csv' then 'csv'
    when 'lock' then 'plaintext'
    when 'env' then 'shell'
    
    # Default
    else 'plaintext'
    end
  end
end 