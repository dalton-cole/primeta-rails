class AddLinesOfCodeToRepositoryFiles < ActiveRecord::Migration[8.0]
  def change
    add_column :repository_files, :lines_of_code, :integer, null: false, default: 0
  end
end
