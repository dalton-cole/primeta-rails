class RepositoryFile < ApplicationRecord
  belongs_to :repository
  has_many :file_views, dependent: :destroy, counter_cache: true
  
  # Validations
  validates :path, presence: true
  validates :path, uniqueness: { scope: :repository_id }
  
  # Callbacks
  before_save :detect_language, if: -> { language.blank? && path.present? }
  before_save :update_lines_of_code, if: :content_changed_for_lo_c?
  
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
    self.language = LanguageDetectionService.detect_language(path)
  end

  def content_changed_for_lo_c?
    content_changed? || (new_record? && content.present?)
  end

  def update_lines_of_code
    if content.present? # Specifically, not nil and not empty string
      # Count newline characters. Add 1 because a file with 0 newlines has 1 line.
      self.lines_of_code = content.count("\n") + 1
    else
      # Covers nil content or empty string content
      self.lines_of_code = 0
    end
  end
end
