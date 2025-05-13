class AddTotalSizeToRepositories < ActiveRecord::Migration[7.1]
  def change
    add_column :repositories, :total_size_in_bytes, :integer, limit: 8, default: 0, null: false
  end
end
