class CreateRepositoryFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :repository_files do |t|
      t.references :repository, null: false, foreign_key: true
      t.string :path
      t.text :content
      t.integer :size
      t.string :language
      t.datetime :last_updated_at

      t.timestamps
    end
  end
end
