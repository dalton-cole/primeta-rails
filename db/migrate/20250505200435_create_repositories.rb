class CreateRepositories < ActiveRecord::Migration[8.0]
  def change
    create_table :repositories do |t|
      t.string :name
      t.string :url
      t.text :description
      t.string :git_url
      t.string :default_branch
      t.datetime :last_synced_at
      t.string :status

      t.timestamps
    end
  end
end
