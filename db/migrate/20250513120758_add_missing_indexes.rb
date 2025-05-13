class AddMissingIndexes < ActiveRecord::Migration[8.0]
  def change
    # Indexes for users table
    add_index :users, :file_views_count
    add_index :users, :github_username # Optional, but good if you query by it
    add_index :users, [:provider, :uid] # For OmniAuth

    # Indexes for repositories table
    add_index :repositories, :repository_files_count
    add_index :repositories, :key_concepts_count
    add_index :repositories, :git_url, unique: true

    # Indexes for repository_files table
    add_index :repository_files, [:repository_id, :language] # Composite index
    add_index :repository_files, :language # Also index language alone if frequently queried without repo_id
    add_index :repository_files, :file_views_count
    add_index :repository_files, :size # Optional, if queried/sorted by size
  end
end
