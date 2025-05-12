class AddCounterCachesToModels < ActiveRecord::Migration[7.0]
  def change
    # Add counter cache for repository_files to repositories table
    add_column :repositories, :repository_files_count, :integer, default: 0
    
    # Add counter cache for key_concepts to repositories table
    add_column :repositories, :key_concepts_count, :integer, default: 0
    
    # Add counter cache for file_views to repository_files table
    add_column :repository_files, :file_views_count, :integer, default: 0
    
    # Add counter cache for file_views to users table
    add_column :users, :file_views_count, :integer, default: 0
    
    # Add index for commonly queried relationships
    add_index :file_views, [:user_id, :repository_file_id]
    add_index :repository_files, [:repository_id, :path]
  end
end
