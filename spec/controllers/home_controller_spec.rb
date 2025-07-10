require 'rails_helper'

RSpec.describe HomeController, type: :controller do
  describe 'GET #index' do
    context 'when no location is provided' do
      it 'renders the index template' do
        get :index
        expect(response).to render_template(:index)
      end

      it 'does not set @tide_data' do
        get :index
        expect(assigns(:tide_data)).to be_nil
      end
    end

    context 'when a location is provided' do
      let(:location_name) { 'San Francisco, CA' }
      let(:latitude) { 37.7749 }
      let(:longitude) { -122.4194 }
      let(:tide_data) do
        [
          { x: 1.hour.ago.iso8601, y: 1.2, isHighTide: false, isLowTide: false, time: '12:00 PM', date: 'Jan 1, 2023' },
          { x: Time.current.iso8601, y: 1.5, isHighTide: true, isLowTide: false, time: '1:00 PM', date: 'Jan 1, 2023' },
          { x: 1.hour.from_now.iso8601, y: 1.1, isHighTide: false, isLowTide: true, time: '2:00 PM', date: 'Jan 1, 2023' }
        ]
      end

      before do
        # Stub Geocoder to return our test coordinates
        allow(Geocoder).to receive(:search)
          .with(location_name, any_args)
          .and_return([
            double('result',
              display_name: location_name,
              latitude: latitude,
              longitude: longitude,
              address_components: {
                'city' => [ 'San Francisco' ],
                'state' => [ 'California' ],
                'country' => [ 'United States' ]
              }
            )
          ])

        # Stub the TideService to return test data
        tide_service = instance_double(TideService)
        allow(TideService).to receive(:new).and_return(tide_service)
        allow(tide_service).to receive(:fetch_tide_data).and_return(tide_data)
      end

      it 'renders the index template' do
        get :index, params: { location: location_name }
        expect(response).to render_template(:index)
      end

      it 'sets @location with the provided location' do
        get :index, params: { location: location_name }
        location = assigns(:location)
        expect(location).to be_present
        expect(location[:name]).to eq(location_name)
        expect(location[:latitude]).to eq(latitude)
        expect(location[:longitude]).to eq(longitude)
      end

      it 'sets @tide_data with tide information' do
        get :index, params: { location: location_name }
        expect(assigns(:tide_data)).to eq(tide_data)
      end

      it 'handles coordinates in the location parameter' do
        get :index, params: { location: "#{latitude},#{longitude}" }
        location = assigns(:location)
        expect(location).to be_present
        expect(location[:latitude]).to eq(latitude)
        expect(location[:longitude]).to eq(longitude)
      end

      it 'handles JSON format for autocomplete' do
        get :index, params: { query: 'San Fran', format: :json }
        expect(response.content_type).to include('application/json')
        json = JSON.parse(response.body)
        expect(json).to have_key('suggestions')
      end
    end

    context 'when location is not found' do
      before do
        allow(Geocoder).to receive(:search).and_return([])
      end

      it 'renders the index template' do
        get :index, params: { location: 'Nonexistent Place' }
        expect(response).to render_template(:index)
      end

      it 'sets a flash alert' do
        get :index, params: { location: 'Nonexistent Place' }
        expect(flash[:alert]).to be_present
      end

      it 'does not set @tide_data' do
        get :index, params: { location: 'Nonexistent Place' }
        expect(assigns(:tide_data)).to be_nil
      end
    end

    context 'when TideService returns nil' do
      before do
        allow(Geocoder).to receive(:search).and_return([
          double('result',
            display_name: 'Test Location',
            latitude: 0,
            longitude: 0,
            address_components: {}
          )
        ])

        tide_service = instance_double(TideService)
        allow(TideService).to receive(:new).and_return(tide_service)
        allow(tide_service).to receive(:fetch_tide_data).and_return(nil)
      end

      it 'renders the index template' do
        get :index, params: { location: 'Test Location' }
        expect(response).to render_template(:index)
      end

      it 'sets a flash alert' do
        get :index, params: { location: 'Test Location' }
        expect(flash[:alert]).to be_present
      end
    end
  end

  describe 'location_suggestions' do
    let(:controller) { described_class.new }

    before do
      allow(Geocoder).to receive(:search).and_return([
        double('result',
          display_name: 'San Francisco, CA, USA',
          latitude: 37.7749,
          longitude: -122.4194,
          address_components: {
            'city' => [ 'San Francisco' ],
            'state' => [ 'California' ],
            'country' => [ 'United States' ]
          }
        )
      ])
    end

    it 'returns an array of location suggestions' do
      suggestions = controller.send(:location_suggestions, 'San Fran')
      expect(suggestions).to be_an(Array)
      expect(suggestions.first).to include(
        name: 'San Francisco, CA, USA',
        latitude: 37.7749,
        longitude: -122.4194
      )
    end

    it 'returns an empty array for blank queries' do
      expect(controller.send(:location_suggestions, '')).to eq([])
      expect(controller.send(:location_suggestions, '   ')).to eq([])
      expect(controller.send(:location_suggestions, nil)).to eq([])
    end

    it 'handles geocoding errors gracefully' do
      allow(Geocoder).to receive(:search).and_raise(StandardError.new('Geocoding error'))
      expect(Rails.logger).to receive(:error).with(/Error fetching location suggestions/)
      expect(controller.send(:location_suggestions, 'test')).to eq([])
    end
  end
end
