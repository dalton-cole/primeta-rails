class AddRepositoryIdToFileViews < ActiveRecord::Migration[8.0]
  def change
    add_column :file_views, :repository_id, :integer
    add_index :file_views, :repository_id
    
    # Populate existing records with their repository IDs
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE file_views
          SET repository_id = repository_files.repository_id
          FROM repository_files
          WHERE file_views.repository_file_id = repository_files.id
        SQL
      end
    end
  end
end
