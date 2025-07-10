module Api
  module V1
    class TidesController < ApplicationController
      skip_before_action :verify_authenticity_token
      before_action :validate_coordinates, only: [ :index ]

      def index
        tide_service = TideService.new(@latitude, @longitude)
        tide_data = tide_service.fetch_tide_data

        if tide_data
          render json: {
            status: "success",
            data: {
              location: {
                latitude: @latitude,
                longitude: @longitude
              },
              tides: tide_data,
              units: {
                height: "meters",
                time: "UTC"
              },
              source: "WorldTides API",
              copyright: "Tide data provided by WorldTides",
              timestamp: Time.current.iso8601
            }
          }
        else
          render json: {
            status: "error",
            message: "Unable to fetch tide data for the specified location",
            errors: [ "Failed to retrieve tide data" ]
          }, status: :service_unavailable
        end
      end

      private

      def validate_coordinates
        @latitude = params[:lat]&.to_f
        @longitude = params[:lng]&.to_f

        unless valid_coordinates?(@latitude, @longitude)
          render json: {
            status: "error",
            message: "Invalid or missing coordinates",
            errors: [ "Please provide valid latitude and longitude parameters" ]
          }, status: :bad_request
        end
      end

      def valid_coordinates?(lat, lng)
        lat.present? && lng.present? &&
        lat.between?(-90, 90) && lng.between?(-180, 180)
      end
    end
  end
end
