class KeyConcept < ApplicationRecord
  belongs_to :repository
  serialize :key_files, coder: YAML
  
  def key_files
    value = self[:key_files]
    if value.is_a?(Array)
      value
    elsif value.nil?
      []
    else
      [value.to_s]
    end
  end
  
  def key_files=(values)
    values = case values
    when Array
      values
    when nil
      []
    else
      [values.to_s]
    end
    
    self[:key_files] = values
  end
end 