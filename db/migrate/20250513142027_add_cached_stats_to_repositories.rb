class AddCachedStatsToRepositories < ActiveRecord::Migration[7.1]
  def change
    add_column :repositories, :cached_language_stats, :jsonb
    add_column :repositories, :cached_explorer_count, :integer, default: 0, null: false
  end
end
