require 'httparty'

class TideService
  BASE_URL = 'https://www.worldtides.info/api/v2'.freeze
  
  def initialize(latitude, longitude)
    @latitude = latitude
    @longitude = longitude
    @api_key = ENV['WORLD_TIDES_API_KEY']
  end
  
  def fetch_tide_data
    return nil unless valid_coordinates? && @api_key.present?
    
    begin
      response = HTTParty.get(BASE_URL, query: request_params)
      
      if response.success?
        process_tide_data(response.parsed_response)
      else
        Rails.logger.error("Tide API Error: #{response.code} - #{response.body}")
        nil
      end
    rescue StandardError => e
      Rails.logger.error("Error fetching tide data: #{e.message}")
      nil
    end
  end
  
  private
  
  def valid_coordinates?
    @latitude.present? && @longitude.present? &&
    @latitude.between?(-90, 90) && @longitude.between?(-180, 180)
  end
  
  def request_params
    end_time = Time.current + 24.hours
    
    {
      lat: @latitude,
      lon: @longitude,
      start: Time.current.to_i,
      end: end_time.to_i,
      step: 3600, # 1 hour steps
      datum: 'LAT', # Lowest Astronomical Tide
      timezone: 'UTC',
      key: @api_key
    }
  end
  
  def process_tide_data(data)
    return [] unless data.is_a?(Hash) && data['heights'].is_a?(Array)
    
    tide_events = find_tide_events(data['heights'])
    
    data['heights'].map do |point|
      time = Time.at(point['dt']).utc
      is_high_tide = tide_events[:high_tides].include?(time)
      is_low_tide = tide_events[:low_tides].include?(time)
      
      {
        x: point['dt'],
        y: point['height'].round(2),
        isHighTide: is_high_tide,
        isLowTide: is_low_tide,
        time: time.strftime('%-I:%M %p'),
        date: time.strftime('%b %-d, %Y')
      }
    end
  end
  
  def find_tide_events(heights)
    return { high_tides: [], low_tides: [] } if heights.size < 3
    
    high_tides = []
    low_tides = []
    
    # Skip first and last points to avoid edge cases
    (1..heights.size-2).each do |i|
      prev = heights[i-1]
      current = heights[i]
      nex = heights[i+1]
      
      time = Time.at(current['dt']).utc
      
      # Check for high tide (local maximum)
      if current['height'] > prev['height'] && current['height'] > nex['height']
        high_tides << time
      # Check for low tide (local minimum)
      elsif current['height'] < prev['height'] && current['height'] < nex['height']
        low_tides << time
      end
    end
    
    { high_tides: high_tides, low_tides: low_tides }
  end
end
