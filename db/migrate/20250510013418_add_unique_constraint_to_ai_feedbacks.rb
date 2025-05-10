class AddUniqueConstraintToAiFeedbacks < ActiveRecord::Migration[8.0]
  def change
    # Add unique index to ensure one feedback entry per user per file content type
    add_index :ai_feedbacks, [:user_id, :repository_id, :file_path, :content_type], 
              unique: true, 
              name: 'index_ai_feedbacks_on_user_content_uniqueness'
  end
end
