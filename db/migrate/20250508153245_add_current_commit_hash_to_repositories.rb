class AddCurrentCommitHashToRepositories < ActiveRecord::Migration[8.0]
  def change
    add_column :repositories, :current_commit_hash, :string
  end
end
