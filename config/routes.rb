Rails.application.routes.draw do
  # Devise routes with OmniAuth callbacks
  devise_for :users, controllers: {
    omniauth_callbacks: 'users/omniauth_callbacks'
  }
  
  # Home controller route
  get "home/index"
  
  # Repository routes
  resources :repositories, only: [:index, :show, :new, :create] do
    resources :repository_files, only: [:index], controller: 'repositories/repository_files'
    post :track_time, on: :member
    post :sync, on: :member
  end
  
  # Repository file routes
  resources :repository_files, only: [:show] do
    post :track_time, on: :member
    get :content, on: :member
  end
  
  # Define the root path route ("/")
  root "home#index"

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
