Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Root route
  root "home#index"

  # Home controller routes
  get "home/index"

  # Location suggestions endpoint
  get "suggestions", to: "home#suggestions", as: :location_suggestions

  # For API requests
  namespace :api do
    namespace :v1 do
      get "tides", to: "tides#index"
    end
  end

  # Handle 404s and other exceptions
  match "/404", to: "errors#not_found", via: :all
  match "/500", to: "errors#internal_server_error", via: :all
end
