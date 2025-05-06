class RepositoryFile < ApplicationRecord
  belongs_to :repository
  has_many :file_views, dependent: :destroy
  
  # Validations
  validates :path, presence: true
  validates :path, uniqueness: { scope: :repository_id }
  
  # Callbacks
  before_save :detect_language, if: -> { language.blank? && path.present? }
  
  # Instance Methods
  def filename
    File.basename(path)
  end
  
  def directory
    File.dirname(path)
  end
  
  def extension
    File.extname(path).delete('.')
  end
  
  private
  
  def detect_language
    ext = extension.downcase
    fname = filename.downcase
    
    # First check for special files without extensions or with special names
    if ext.blank? || ext.length < 1
      self.language = detect_language_by_filename(fname)
      return if self.language.present? && self.language != 'plaintext'
    end
    
    # Then check by extension
    self.language = extension_to_language(ext)
  end
  
  def detect_language_by_filename(fname)
    case fname
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
  
  def extension_to_language(ext)
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
