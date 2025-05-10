class CreateAiFeedbacks < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_feedbacks do |t|
      t.integer :user_id
      t.integer :repository_id
      t.string :file_path
      t.string :content_type
      t.boolean :is_helpful
      t.text :feedback_text

      t.timestamps
    end
    
    add_index :ai_feedbacks, :user_id
    add_index :ai_feedbacks, :repository_id
    add_index :ai_feedbacks, [:repository_id, :file_path, :content_type]
    add_index :ai_feedbacks, :is_helpful
  end
end
