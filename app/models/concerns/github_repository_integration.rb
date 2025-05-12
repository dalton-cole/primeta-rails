module GithubRepositoryIntegration
  extend ActiveSupport::Concern
  
  # GitHub related methods
  def github_repo?
    git_url.present? && git_url.include?('github.com')
  end
  
  def github_owner_and_repo
    return nil unless github_repo?
    
    # Extract owner/repo from different GitHub URL formats
    if git_url.include?('github.com/')
      path = git_url.split('github.com/').last
    elsif git_url.include?('github.com:')
      path = git_url.split('github.com:').last
    else
      return nil
    end
    
    # Remove .git suffix and any query parameters
    path = path.gsub(/\.git$/, '').split('?').first
    owner, repo = path.split('/')
    
    return nil unless owner.present? && repo.present?
    { owner: owner, repo: repo }
  end
  
  def github_url
    info = github_owner_and_repo
    return nil unless info
    
    "https://github.com/#{info[:owner]}/#{info[:repo]}"
  end
  
  def github_avatar_url
    info = github_owner_and_repo
    return nil unless info
    
    # GitHub organization/user avatar URL
    "https://github.com/#{info[:owner]}.png?size=40"
  end
  
  def commit_hash_url
    return nil unless github_url && current_commit_hash
    "#{github_url}/commit/#{current_commit_hash}"
  end
  
  def short_commit_hash
    current_commit_hash.present? ? current_commit_hash[0..6] : nil
  end
end 