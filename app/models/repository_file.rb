class RepositoryFile < ApplicationRecord
  belongs_to :repository
  has_many :file_views, dependent: :destroy, counter_cache: true
  
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
    self.language = LanguageDetectionService.detect_language(path)
  end
end
