class AddKeyFileToRepositoryFiles < ActiveRecord::Migration[8.0]
  def change
    add_column :repository_files, :is_key_file, :boolean, default: false
    add_index :repository_files, :is_key_file
  end
end
