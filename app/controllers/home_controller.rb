class HomeController < ApplicationController
  def index
    if params[:location].present?
      # Handle location search
      if params[:location].match?(/^-?\d+\.\d+,-?\d+\.\d+$/) # Check if it's lat,long
        lat, long = params[:location].split(",").map(&:to_f)
        @location = { name: "#{lat}, #{long}", latitude: lat, longitude: long }
      else
        # Search by location name
        results = Geocoder.search(params[:location])
        if results.any?
          result = results.first
          @location = {
            name: result.display_name,
            latitude: result.latitude,
            longitude: result.longitude
          }
        else
          flash.now[:alert] = "Location not found"
          return
        end
      end

      # Fetch tide data
      @tide_service = TideService.new(@location[:latitude], @location[:longitude])
      @tide_data = @tide_service.fetch_tide_data

      unless @tide_data
        flash.now[:alert] = "Unable to fetch tide data for this location"
        @tide_data = []
      end
    end

    respond_to do |format|
      format.html
      format.json do
        if params[:query].present? && params[:query].length >= 3
          suggestions = location_suggestions(params[:query])
          render json: { suggestions: suggestions }
        else
          render json: { suggestions: [] }
        end
      end
    end
  end

  private

  def location_suggestions(query)
    return [] if query.blank?

    begin
      results = Geocoder.search(query, params: {
        limit: 5,
        addressdetails: 1,
        'accept-language': "en",
        namedetails: 0,
        extratags: 0,
        countrycodes: "us,ca,gb,au,nz",
        featuretype: "city,town,village,harbour,bay"
      })

      results.map do |result|
        {
          name: result.display_name,
          latitude: result.latitude,
          longitude: result.longitude
        }
      end
    rescue StandardError => e
      Rails.logger.error("Error fetching location suggestions: #{e.message}")
      []
    end
  end
end
