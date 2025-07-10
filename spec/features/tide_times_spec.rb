require 'rails_helper'

RSpec.feature 'Tide Times', type: :feature, js: true do
  let(:location_name) { 'San Francisco, CA, USA' }
  let(:latitude) { 37.7749 }
  let(:longitude) { -122.4194 }
  let(:tide_data) do
    [
      {
        x: 1.hour.ago.iso8601,
        y: 1.2,
        isHighTide: false,
        isLowTide: false,
        time: '12:00 PM',
        date: Date.current.strftime('%b %-d, %Y')
      },
      {
        x: Time.current.iso8601,
        y: 1.8,
        isHighTide: true,
        isLowTide: false,
        time: '1:00 PM',
        date: Date.current.strftime('%b %-d, %Y')
      },
      {
        x: 1.hour.from_now.iso8601,
        y: 1.5,
        isHighTide: false,
        isLowTide: false,
        time: '2:00 PM',
        date: Date.current.strftime('%b %-d, %Y')
      }
    ]
  end

  before do
    # Stub Geocoder for location search
    allow(Geocoder).to receive(:search).and_return([
      double('result',
        display_name: location_name,
        latitude: latitude,
        longitude: longitude,
        address_components: {
          'city' => ['San Francisco'],
          'state' => ['California'],
          'country' => ['United States']
        }
      )
    ])

    # Stub TideService
    tide_service = instance_double(TideService)
    allow(TideService).to receive(:new).and_return(tide_service)
    allow(tide_service).to receive(:fetch_tide_data).and_return(tide_data)
  end

  scenario 'User searches for a location and views tide data' do
    visit root_path

    # Check initial state
    expect(page).to have_field('location', type: 'text')
    expect(page).to have_button('Get Tides', disabled: false)
    expect(page).not_to have_css('.tide-chart')

    # Enter a location and submit
    fill_in 'location', with: 'San Francisco'
    
    # Wait for autocomplete to appear
    expect(page).to have_css('[data-location-search-target="suggestions"]')
    
    # Select the suggestion
    find('[data-location-search-target="suggestions"] div', text: location_name).click
    
    # Form should auto-submit when selecting a suggestion
    expect(page).to have_css('.tide-chart')
    
    # Check that the chart is displayed with the correct data
    expect(page).to have_content('Tide Chart for San Francisco')
    
    # Check that the tide data table is displayed
    within('.tide-table') do
      expect(page).to have_content('Time')
      expect(page).to have_content('Height (m)')
      expect(page).to have_content('Type')
      
      # Should show the high tide
      expect(page).to have_content('1:00 PM')
      expect(page).to have_content('1.8')
      expect(page).to have_content('High')
    end
    
    # Check that the location is pre-filled in the search box
    expect(find_field('location').value).to eq(location_name)
  end

  scenario 'User enters invalid location' do
    # Override the Geocoder stub for this test
    allow(Geocoder).to receive(:search).and_return([])
    
    visit root_path
    
    # Submit an invalid location
    fill_in 'location', with: 'Nonexistent Place'
    click_button 'Get Tides'
    
    # Should show an error message
    expect(page).to have_content('Location not found')
    
    # Chart should not be displayed
    expect(page).not_to have_css('.tide-chart')
  end

  scenario 'User uses location detection', js: true do
    # Mock the browser's geolocation API
    page.execute_script(
      "navigator.geolocation = {
        getCurrentPosition: function(success) {
          success({
            coords: {
              latitude: #{latitude},
              longitude: #{longitude}
            }
          });
        }
      };"
    )
    
    visit root_path
    
    # Click the location button
    find('[data-action="click->location-search#getCurrentLocation"]').click
    
    # Should show the chart for the detected location
    expect(page).to have_css('.tide-chart')
    expect(page).to have_content('Tide Chart for San Francisco')
  end

  scenario 'User views the page with location in URL' do
    # Visit the page with a location parameter
    visit root_path(location: "#{latitude},#{longitude}")
    
    # Should show the chart immediately
    expect(page).to have_css('.tide-chart')
    expect(page).to have_content('Tide Chart for San Francisco')
  end

  scenario 'User interacts with the chart' do
    visit root_path(location: "#{latitude},#{longitude}")
    
    # Check that the chart canvas is present
    expect(page).to have_css('canvas')
    
    # Check that the chart legend is displayed
    expect(page).to have_content('Tide Height')
    expect(page).to have_content('Current Tide')
    
    # Check that the tide events are displayed
    within('.tide-events') do
      expect(page).to have_content('High Tide')
      expect(page).to have_content('1.8m')
    end
  end
end
