require 'rails_helper'

RSpec.describe TideService, type: :service, vcr: true do
  let(:latitude) { 37.7749 }  # San Francisco
  let(:longitude) { -122.4194 }
  let(:service) { described_class.new(latitude, longitude) }
  
  before do
    # Set a test API key if not already set
    ENV['WORLD_TIDES_API_KEY'] ||= 'test_api_key'
  end
  
  describe '#fetch_tide_data' do
    context 'with valid coordinates' do
      it 'returns an array of tide data points' do
        VCR.use_cassette('tide_service/valid_coordinates') do
          result = service.fetch_tide_data
          
          expect(result).to be_an(Array)
          expect(result).not_to be_empty
          
          # Check the structure of the first data point
          first_point = result.first
          expect(first_point).to have_key(:x)          # Timestamp
          expect(first_point).to have_key(:y)          # Tide height
          expect(first_point).to have_key(:isHighTide)  # Boolean
          expect(first_point).to have_key(:isLowTide)   # Boolean
          expect(first_point).to have_key(:time)        # Formatted time
          expect(first_point).to have_key(:date)        # Formatted date
        end
      end
      
      it 'includes both high and low tide points' do
        VCR.use_cassette('tide_service/tide_extremes') do
          result = service.fetch_tide_data
          
          high_tides = result.select { |p| p[:isHighTide] }
          low_tides = result.select { |p| p[:isLowTide] }
          
          expect(high_tides).not_to be_empty
          expect(low_tides).not_to be_empty
          
          # Verify high tides are higher than adjacent points
          high_tides.each do |ht|
            idx = result.find_index(ht)
            next if idx == 0 || idx == result.length - 1
            
            expect(ht[:y]).to be > result[idx - 1][:y]
            expect(ht[:y]).to be > result[idx + 1][:y]
          end
          
          # Verify low tides are lower than adjacent points
          low_tides.each do |lt|
            idx = result.find_index(lt)
            next if idx == 0 || idx == result.length - 1
            
            expect(lt[:y]).to be < result[idx - 1][:y]
            expect(lt[:y]).to be < result[idx + 1][:y]
          end
        end
      end
    end
    
    context 'with invalid coordinates' do
      let(:latitude) { 91 }  # Invalid latitude
      let(:longitude) { 181 } # Invalid longitude
      
      it 'returns nil' do
        VCR.use_cassette('tide_service/invalid_coordinates') do
          expect(service.fetch_tide_data).to be_nil
        end
      end
    end
    
    context 'when the API key is missing' do
      before do
        @original_key = ENV['WORLD_TIDES_API_KEY']
        ENV['WORLD_TIDES_API_KEY'] = nil
      end
      
      after { ENV['WORLD_TIDES_API_KEY'] = @original_key }
      
      it 'raises an error' do
        expect {
          service.fetch_tide_data
        }.to raise_error(RuntimeError, /Tide data service is not properly configured/)
      end
    end
    
    context 'when the API returns an error' do
      before do
        stub_request(:get, /www.worldtides.info/)
          .to_return(status: 500, body: 'Internal Server Error', headers: {})
      end
      
      it 'returns nil' do
        expect(service.fetch_tide_data).to be_nil
      end
    end
  end
  
  describe 'private methods' do
    let(:sample_data) do
      {
        'heights' => [
          { 'dt' => (Time.now - 1.hour).to_i, 'height' => 1.2 },
          { 'dt' => Time.now.to_i, 'height' => 1.5 },  # local max
          { 'dt' => (Time.now + 1.hour).to_i, 'height' => 1.3 },
          { 'dt' => (Time.now + 2.hours).to_i, 'height' => 0.8 },  # local min
          { 'dt' => (Time.now + 3.hours).to_i, 'height' => 1.0 }
        ]
      }
    end
    
    describe '#process_tide_data' do
      it 'processes the API response into the expected format' do
        result = service.send(:process_tide_data, sample_data)
        
        expect(result).to be_an(Array)
        expect(result.size).to eq(5)
        
        # Check the structure of each point
        result.each do |point|
          expect(point).to include(
            :x, :y, :isHighTide, :isLowTide, :time, :date
          )
        end
        
        # Check that high and low tides are correctly identified
        high_tides = result.select { |p| p[:isHighTide] }
        low_tides = result.select { |p| p[:isLowTide] }
        
        expect(high_tides.size).to eq(1)
        expect(low_tides.size).to eq(1)
        
        expect(high_tides.first[:y]).to eq(1.5)
        expect(low_tides.first[:y]).to eq(0.8)
      end
      
      it 'handles empty data' do
        expect(service.send(:process_tide_data, {})).to eq([])
        expect(service.send(:process_tide_data, { 'heights' => [] })).to eq([])
      end
    end
    
    describe '#find_tide_events' do
      it 'identifies high and low tides' do
        result = service.send(:find_tide_events, sample_data['heights'])
        
        expect(result).to be_a(Hash)
        expect(result).to have_key(:high_tides)
        expect(result).to have_key(:low_tides)
        
        # Should find one high tide and one low tide in the sample data
        expect(result[:high_tides].size).to eq(1)
        expect(result[:low_tides].size).to eq(1)
        
        # Verify the timestamps match our expectations
        expect(Time.at(sample_data['heights'][1]['dt'])).to eq(result[:high_tides].first)
        expect(Time.at(sample_data['heights'][3]['dt'])).to eq(result[:low_tides].first)
      end
    end
  end
end
