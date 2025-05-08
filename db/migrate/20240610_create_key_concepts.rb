class CreateKeyConcepts < ActiveRecord::Migration[7.0]
  def change
    create_table :key_concepts do |t|
      t.references :repository, foreign_key: true
      t.string :name, null: false
      t.text :description, null: false
      t.text :key_files # Will be serialized as an array in the model
      t.text :key_files_explanation
      t.timestamps
    end
  end
end 