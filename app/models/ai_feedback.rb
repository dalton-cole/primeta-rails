class AiFeedback < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :repository, optional: true

  validates :repository_id, :file_path, :content_type, presence: true
  validates :content_type, inclusion: { in: ['context', 'challenges'] }
  validates :is_helpful, inclusion: { in: [true, false, nil] }
  
  # Ensure users can only submit feedback once per file/content type
  validates :user_id, uniqueness: { scope: [:repository_id, :file_path, :content_type], 
                                    message: "has already provided feedback for this content" }, 
                                    if: -> { user_id.present? }
  
  scope :helpful, -> { where(is_helpful: true) }
  scope :not_helpful, -> { where(is_helpful: false) }
  
  # Get feedback stats for a specific file and content type
  def self.stats_for(repository_id, file_path, content_type)
    where(repository_id: repository_id, file_path: file_path, content_type: content_type)
      .group(:is_helpful)
      .count
  end
end
