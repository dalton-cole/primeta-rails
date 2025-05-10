class CreateAiResponseCaches < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_response_caches do |t|
      t.integer :repository_id
      t.string :file_path
      t.string :cache_type
      t.text :content

      t.timestamps
    end
    
    add_index :ai_response_caches, [:repository_id, :file_path, :cache_type], unique: true, name: 'index_ai_response_caches_on_repo_file_and_type'
  end
end
